"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SampleService = void 0;
const sample_model_1 = require("../models/sample.model");
const errorHandler_1 = require("../middleware/errorHandler");
const workflow_1 = require("../constants/workflow");
class SampleService {
    static getAll = async (params) => {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const skip = (page - 1) * limit;
        const query = {};
        if (params.search) {
            query.$or = [
                { sampleId: { $regex: params.search, $options: 'i' } },
                { barcode: { $regex: params.search, $options: 'i' } },
                { uhid: { $regex: params.search, $options: 'i' } },
                { enquiryNo: { $regex: params.search, $options: 'i' } },
            ];
        }
        if (params.status)
            query.status = params.status;
        if (params.department)
            query.department = params.department;
        const [samples, total] = await Promise.all([
            sample_model_1.Sample.find(query).populate('patient').populate('test').sort({ createdAt: -1 }).skip(skip).limit(limit),
            sample_model_1.Sample.countDocuments(query),
        ]);
        return {
            samples,
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    };
    static getAllSamples = SampleService.getAll;
    static getById = async (id) => {
        const sample = await sample_model_1.Sample.findById(id).populate('patient').populate('test');
        if (!sample)
            throw new errorHandler_1.AppError('Sample not found', 404);
        return sample;
    };
    static getByBarcode = async (barcode) => {
        const sample = await sample_model_1.Sample.findOne({ barcode }).populate('patient').populate('test');
        if (!sample)
            throw new errorHandler_1.AppError(`Sample not found for barcode ${barcode}`, 404);
        return sample;
    };
    static getStats = async () => {
        const [total, pendingCollection, collected, received, processing, completed, rejected, overdue] = await Promise.all([
            sample_model_1.Sample.countDocuments(),
            sample_model_1.Sample.countDocuments({ status: workflow_1.SAMPLE_STATUS.PENDING_COLLECTION }),
            sample_model_1.Sample.countDocuments({ status: workflow_1.SAMPLE_STATUS.COLLECTED }),
            sample_model_1.Sample.countDocuments({ status: workflow_1.SAMPLE_STATUS.RECEIVED }),
            sample_model_1.Sample.countDocuments({ status: workflow_1.SAMPLE_STATUS.PROCESSING }),
            sample_model_1.Sample.countDocuments({ status: workflow_1.SAMPLE_STATUS.COMPLETED }),
            sample_model_1.Sample.countDocuments({ status: workflow_1.SAMPLE_STATUS.REJECTED }),
            // Past its turnaround target and still not reported.
            sample_model_1.Sample.countDocuments({
                expectedAt: { $lt: new Date() },
                status: { $nin: [workflow_1.SAMPLE_STATUS.COMPLETED, workflow_1.SAMPLE_STATUS.REJECTED] },
            }),
        ]);
        return { total, pendingCollection, collected, received, processing, completed, rejected, overdue };
    };
    static getDashboardStats = SampleService.getStats;
    /**
     * Moves a specimen one legal step along the bench lifecycle, stamping the
     * stage clock and appending to statusHistory. The history array existed on
     * the schema but was never written, so samples carried no audit trail.
     */
    static updateStatus = async (id, payload, currentUser) => {
        const sample = await sample_model_1.Sample.findById(id);
        if (!sample)
            throw new errorHandler_1.AppError('Sample not found', 404);
        const from = sample.status;
        const to = payload.status;
        if (from === to) {
            throw new errorHandler_1.AppError(`Sample ${sample.sampleId} is already ${to}`, 400);
        }
        // A specimen is only "Completed" once a pathologist has authorised its
        // result. Allowing the bench to tick it off directly left the results
        // registry empty while samples showed as finished.
        if (to === workflow_1.SAMPLE_STATUS.COMPLETED && !payload.viaResultApproval) {
            throw new errorHandler_1.AppError(`${sample.sampleId} is completed by approving its result, not directly. Enter results, then verify.`, 400);
        }
        if (!(0, workflow_1.canTransition)(from, to)) {
            const allowed = (0, workflow_1.nextStatuses)(from);
            throw new errorHandler_1.AppError(allowed.length
                ? `Cannot move ${sample.sampleId} from "${from}" to "${to}". Allowed next: ${allowed.join(', ')}.`
                : `Sample ${sample.sampleId} is ${from} and cannot move further.`, 400);
        }
        sample.status = to;
        if (payload.rejectionReason)
            sample.rejectionReason = payload.rejectionReason;
        if (payload.remarks)
            sample.remarks = payload.remarks;
        if (payload.collector)
            sample.collector = payload.collector;
        // Stamp the clock for the stage being entered.
        const stampField = workflow_1.SAMPLE_STAGE_TIMESTAMP[to];
        if (stampField && !sample[stampField]) {
            sample[stampField] = new Date();
        }
        if (to === workflow_1.SAMPLE_STATUS.COLLECTED && !sample.collectionTime) {
            sample.collectionTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
        }
        // A repeat draw clears the previous rejection and re-opens the clocks.
        if (to === workflow_1.SAMPLE_STATUS.RECOLLECTED) {
            sample.recollectionCount = (sample.recollectionCount ?? 0) + 1;
        }
        if (from === workflow_1.SAMPLE_STATUS.RECOLLECTED && to === workflow_1.SAMPLE_STATUS.PENDING_COLLECTION) {
            sample.rejectionReason = '';
            sample.rejectionRemarks = '';
            sample.rejectedAt = undefined;
            sample.collectionDate = undefined;
            sample.collectionTime = '';
            sample.receivedAt = undefined;
            sample.processingAt = undefined;
        }
        const actor = currentUser ?? payload.user;
        sample.statusHistory = [
            ...(sample.statusHistory ?? []),
            {
                fromStatus: from,
                toStatus: to,
                updatedBy: {
                    userId: actor?.userId,
                    name: actor?.name ?? 'System',
                    role: actor?.role ?? 'System',
                },
                timestamp: new Date(),
                notes: payload.remarks || payload.rejectionReason || '',
            },
        ];
        await sample.save();
        return sample;
    };
    /**
     * Walks a specimen forward to `target`, one legal step at a time.
     *
     * The lifecycle only allows single steps, which is right for the bench
     * screens - a phlebotomist ticks off one draw at a time. It is wrong for the
     * result path: values only exist because the specimen was drawn, accessioned
     * and run, so when a sheet is submitted or released the stages it skipped
     * have already happened in the real world and have to be recorded. Each step
     * still goes through `updateStatus`, so every stage is stamped and appears in
     * the audit trail rather than being written over in one jump.
     */
    static advanceTo = async (id, target, currentUser, remarks) => {
        let sample = await sample_model_1.Sample.findById(id);
        if (!sample)
            throw new errorHandler_1.AppError('Sample not found', 404);
        const targetIndex = workflow_1.SAMPLE_PIPELINE.indexOf(target);
        if (targetIndex < 0)
            throw new errorHandler_1.AppError(`${target} is not a stage on the bench pipeline`, 400);
        // One pass per stage at most - a lifecycle that somehow loops must not
        // take the request with it.
        for (let step = 0; step <= workflow_1.SAMPLE_PIPELINE.length; step += 1) {
            const currentIndex = workflow_1.SAMPLE_PIPELINE.indexOf(sample.status);
            // Rejected and Recollected sit off the happy path on purpose. A rejected
            // specimen has no result to release - the desk orders a fresh draw.
            if (currentIndex < 0) {
                throw new errorHandler_1.AppError(`${sample.sampleId} is ${sample.status}, which is off the bench pipeline, so it cannot be moved to ${target}. Order a fresh draw and run it again.`, 400);
            }
            if (currentIndex >= targetIndex)
                return sample;
            const next = workflow_1.SAMPLE_PIPELINE[currentIndex + 1];
            sample = await SampleService.updateStatus(id, {
                status: next,
                viaResultApproval: next === workflow_1.SAMPLE_STATUS.COMPLETED,
                remarks,
            }, currentUser);
        }
        return sample;
    };
    static rejectSample = async (id, payload, currentUser) => {
        const reason = typeof payload === 'string' ? payload : payload?.rejectionReason || 'Sample rejected';
        const remarks = typeof payload === 'string' ? '' : payload?.rejectionRemarks || payload?.remarks || '';
        return SampleService.updateStatus(id, { status: workflow_1.SAMPLE_STATUS.REJECTED, rejectionReason: reason, remarks }, currentUser);
    };
    /**
     * Closes out a rejected draw and immediately re-queues the specimen for a
     * fresh collection, so the queue reflects the physical reality.
     */
    static recollectSample = async (id, payload, currentUser) => {
        const remarks = typeof payload === 'string' ? payload : payload?.remarks || 'Repeat draw ordered';
        await SampleService.updateStatus(id, { status: workflow_1.SAMPLE_STATUS.RECOLLECTED, remarks }, currentUser);
        return SampleService.updateStatus(id, { status: workflow_1.SAMPLE_STATUS.PENDING_COLLECTION, remarks }, currentUser);
    };
    /** The stage timeline for one specimen, used by the journey tracker. */
    static getTimeline = async (id) => {
        const sample = await sample_model_1.Sample.findById(id).populate('patient').populate('test').populate('department');
        if (!sample)
            throw new errorHandler_1.AppError('Sample not found', 404);
        const reachedAt = {
            [workflow_1.SAMPLE_STATUS.REGISTERED]: sample.createdAt,
            [workflow_1.SAMPLE_STATUS.PENDING_COLLECTION]: sample.createdAt,
            [workflow_1.SAMPLE_STATUS.COLLECTED]: sample.collectionDate,
            [workflow_1.SAMPLE_STATUS.RECEIVED]: sample.receivedAt,
            [workflow_1.SAMPLE_STATUS.PROCESSING]: sample.processingAt,
            [workflow_1.SAMPLE_STATUS.COMPLETED]: sample.completedAt,
        };
        const currentIndex = workflow_1.SAMPLE_PIPELINE.indexOf(sample.status);
        const stages = workflow_1.SAMPLE_PIPELINE.map((stage, index) => ({
            stage,
            reachedAt: reachedAt[stage] ?? null,
            state: currentIndex < 0 ? 'pending' : index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending',
        }));
        return {
            sample,
            stages,
            isRejected: sample.status === workflow_1.SAMPLE_STATUS.REJECTED,
            allowedNext: (0, workflow_1.nextStatuses)(sample.status),
            history: sample.statusHistory ?? [],
        };
    };
}
exports.SampleService = SampleService;
