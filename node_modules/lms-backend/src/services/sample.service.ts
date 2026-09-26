import { Sample } from '../models/sample.model';
import { AppError } from '../middleware/errorHandler';
import {
  SAMPLE_STATUS,
  SAMPLE_PIPELINE,
  SAMPLE_STAGE_TIMESTAMP,
  canTransition,
  nextStatuses,
  type SampleStatus,
} from '../constants/workflow';

export class SampleService {
  static getAll = async (params: { search?: string; status?: string; department?: string; page?: number; limit?: number }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (params.search) {
      query.$or = [
        { sampleId: { $regex: params.search, $options: 'i' } },
        { barcode: { $regex: params.search, $options: 'i' } },
        { uhid: { $regex: params.search, $options: 'i' } },
        { enquiryNo: { $regex: params.search, $options: 'i' } },
      ];
    }
    // A comma-separated list lets a queue read several stages in one call.
    if (params.status) {
      const statuses = params.status.split(',').map((v) => v.trim()).filter(Boolean);
      query.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (params.department) query.department = params.department;

    const [samples, total] = await Promise.all([
      Sample.find(query).populate('patient').populate('test').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Sample.countDocuments(query),
    ]);

    return {
      samples,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  };

  static getAllSamples = SampleService.getAll;

  static getById = async (id: string) => {
    const sample = await Sample.findById(id).populate('patient').populate('test');
    if (!sample) throw new AppError('Sample not found', 404);
    return sample;
  };

  static getByBarcode = async (barcode: string) => {
    const sample = await Sample.findOne({ barcode }).populate('patient').populate('test');
    if (!sample) throw new AppError(`Sample not found for barcode ${barcode}`, 404);
    return sample;
  };

  static getStats = async () => {
    const [total, pendingCollection, collected, received, processing, completed, rejected, overdue] =
      await Promise.all([
        Sample.countDocuments(),
        Sample.countDocuments({ status: SAMPLE_STATUS.PENDING_COLLECTION }),
        Sample.countDocuments({ status: SAMPLE_STATUS.COLLECTED }),
        Sample.countDocuments({ status: SAMPLE_STATUS.RECEIVED }),
        Sample.countDocuments({ status: SAMPLE_STATUS.PROCESSING }),
        Sample.countDocuments({ status: SAMPLE_STATUS.COMPLETED }),
        Sample.countDocuments({ status: SAMPLE_STATUS.REJECTED }),
        // Past its turnaround target and still not reported.
        Sample.countDocuments({
          expectedAt: { $lt: new Date() },
          status: { $nin: [SAMPLE_STATUS.COMPLETED, SAMPLE_STATUS.REJECTED] },
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
  static updateStatus = async (
    id: string,
    payload: {
      status: string;
      rejectionReason?: string;
      remarks?: string;
      collector?: string;
      /** When the draw happened. Defaults to now; only read on the move to Collected. */
      collectedAt?: string;
      /** Set only by the result-verification path, which owns completion. */
      viaResultApproval?: boolean;
      user?: any;
    },
    currentUser?: any
  ) => {
    const sample = await Sample.findById(id);
    if (!sample) throw new AppError('Sample not found', 404);

    const from = sample.status;
    const to = payload.status;

    if (from === to) {
      throw new AppError(`Sample ${sample.sampleId} is already ${to}`, 400);
    }

    // A specimen is only "Completed" once a pathologist has authorised its
    // result. Allowing the bench to tick it off directly left the results
    // registry empty while samples showed as finished.
    if (to === SAMPLE_STATUS.COMPLETED && !payload.viaResultApproval) {
      throw new AppError(
        `${sample.sampleId} is completed by approving its result, not directly. Enter results, then verify.`,
        400
      );
    }

    if (!canTransition(from, to)) {
      const allowed = nextStatuses(from);
      throw new AppError(
        allowed.length
          ? `Cannot move ${sample.sampleId} from "${from}" to "${to}". Allowed next: ${allowed.join(', ')}.`
          : `Sample ${sample.sampleId} is ${from} and cannot move further.`,
        400
      );
    }

    // The phlebotomist often marks a batch collected a while after drawing it,
    // so the time on the tube is taken from them rather than from the click.
    let collectedAt: Date | undefined;
    if (to === SAMPLE_STATUS.COLLECTED && payload.collectedAt) {
      collectedAt = new Date(payload.collectedAt);
      if (Number.isNaN(collectedAt.getTime())) {
        throw new AppError('Collection time is not a valid date', 400);
      }
      // A few minutes of slack for a desk clock that runs ahead of the server.
      if (collectedAt.getTime() > Date.now() + 5 * 60 * 1000) {
        throw new AppError('Collection time cannot be in the future', 400);
      }
      if (collectedAt.getTime() < new Date((sample as any).createdAt).getTime() - 60 * 1000) {
        throw new AppError(`Collection time cannot be before ${sample.sampleId} was ordered`, 400);
      }
    }

    sample.status = to as any;
    if (payload.rejectionReason) sample.rejectionReason = payload.rejectionReason;
    if (payload.remarks) sample.remarks = payload.remarks;
    if (payload.collector) sample.collector = payload.collector;

    // Stamp the clock for the stage being entered.
    const stampField = SAMPLE_STAGE_TIMESTAMP[to as SampleStatus];
    if (stampField && !(sample as any)[stampField]) {
      (sample as any)[stampField] = new Date();
    }
    if (collectedAt) {
      sample.collectionDate = collectedAt;
      sample.collectionTime = collectedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    } else if (to === SAMPLE_STATUS.COLLECTED && !sample.collectionTime) {
      sample.collectionTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }

    // A repeat draw clears the previous rejection and re-opens the clocks.
    if (to === SAMPLE_STATUS.RECOLLECTED) {
      sample.recollectionCount = (sample.recollectionCount ?? 0) + 1;
    }
    if (from === SAMPLE_STATUS.RECOLLECTED && to === SAMPLE_STATUS.PENDING_COLLECTION) {
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
  static advanceTo = async (
    id: string,
    target: SampleStatus,
    currentUser?: any,
    remarks?: string
  ) => {
    let sample = await Sample.findById(id);
    if (!sample) throw new AppError('Sample not found', 404);

    const targetIndex = SAMPLE_PIPELINE.indexOf(target);
    if (targetIndex < 0) throw new AppError(`${target} is not a stage on the bench pipeline`, 400);

    // One pass per stage at most - a lifecycle that somehow loops must not
    // take the request with it.
    for (let step = 0; step <= SAMPLE_PIPELINE.length; step += 1) {
      const currentIndex = SAMPLE_PIPELINE.indexOf(sample.status as SampleStatus);

      // Rejected and Recollected sit off the happy path on purpose. A rejected
      // specimen has no result to release - the desk orders a fresh draw.
      if (currentIndex < 0) {
        throw new AppError(
          `${sample.sampleId} is ${sample.status}, which is off the bench pipeline, so it cannot be moved to ${target}. Order a fresh draw and run it again.`,
          400
        );
      }

      if (currentIndex >= targetIndex) return sample;

      const next = SAMPLE_PIPELINE[currentIndex + 1];
      sample = await SampleService.updateStatus(
        id,
        {
          status: next,
          viaResultApproval: next === SAMPLE_STATUS.COMPLETED,
          remarks,
        },
        currentUser
      );
    }

    return sample;
  };

  static rejectSample = async (id: string, payload: any, currentUser?: any) => {
    const reason = typeof payload === 'string' ? payload : payload?.rejectionReason || 'Sample rejected';
    const remarks = typeof payload === 'string' ? '' : payload?.rejectionRemarks || payload?.remarks || '';
    return SampleService.updateStatus(id, { status: SAMPLE_STATUS.REJECTED, rejectionReason: reason, remarks }, currentUser);
  };

  /**
   * Closes out a rejected draw and immediately re-queues the specimen for a
   * fresh collection, so the queue reflects the physical reality.
   */
  static recollectSample = async (id: string, payload?: any, currentUser?: any) => {
    const remarks = typeof payload === 'string' ? payload : payload?.remarks || 'Repeat draw ordered';
    await SampleService.updateStatus(id, { status: SAMPLE_STATUS.RECOLLECTED, remarks }, currentUser);
    return SampleService.updateStatus(id, { status: SAMPLE_STATUS.PENDING_COLLECTION, remarks }, currentUser);
  };

  /** The stage timeline for one specimen, used by the journey tracker. */
  static getTimeline = async (id: string) => {
    const sample = await Sample.findById(id).populate('patient').populate('test').populate('department');
    if (!sample) throw new AppError('Sample not found', 404);

    const reachedAt: Record<string, Date | undefined> = {
      [SAMPLE_STATUS.REGISTERED]: (sample as any).createdAt,
      [SAMPLE_STATUS.PENDING_COLLECTION]: (sample as any).createdAt,
      [SAMPLE_STATUS.COLLECTED]: sample.collectionDate,
      [SAMPLE_STATUS.RECEIVED]: sample.receivedAt,
      [SAMPLE_STATUS.PROCESSING]: sample.processingAt,
      [SAMPLE_STATUS.COMPLETED]: sample.completedAt,
    };

    const currentIndex = SAMPLE_PIPELINE.indexOf(sample.status as SampleStatus);
    const stages = SAMPLE_PIPELINE.map((stage, index) => ({
      stage,
      reachedAt: reachedAt[stage] ?? null,
      state: currentIndex < 0 ? 'pending' : index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'pending',
    }));

    return {
      sample,
      stages,
      isRejected: sample.status === SAMPLE_STATUS.REJECTED,
      allowedNext: nextStatuses(sample.status),
      history: sample.statusHistory ?? [],
    };
  };
}

