"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResultService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const result_model_1 = require("../models/result.model");
const sample_model_1 = require("../models/sample.model");
const counter_model_1 = require("../models/counter.model");
const api_error_util_1 = require("../utils/api-error.util");
const pdf_generator_util_1 = require("../utils/pdf-generator.util");
const flag_calculator_util_1 = require("../utils/flag-calculator.util");
const test_parameters_1 = require("../constants/test-parameters");
const sample_service_1 = require("./sample.service");
const workflow_1 = require("../constants/workflow");
/**
 * Picks the range that actually applies to the person on the report. A child's
 * haemoglobin read against an adult male band flags half the paediatric ward as
 * anaemic, and a woman's creatinine read against a man's looks falsely fine -
 * so the sheet is cut to the patient before the bench ever sees it.
 */
const rangeForPatient = (parameter, patient) => {
    const age = Number(patient?.age);
    const gender = String(patient?.gender || '');
    // Either the desk registered them as a child, or the age says so - a baby
    // brought in without a stated sex must still be read against the child band.
    const isChild = gender.endsWith('Child') || (!isNaN(age) && age > 0 && age < 12);
    if (isChild && parameter.childReferenceRange) {
        return parameter.childReferenceRange;
    }
    // A child is registered as 'Male Child' / 'Female Child', so the sex still
    // reads off the front of the label - a boy with no paediatric band on the
    // parameter drops to the male band rather than to an arbitrary one.
    if (gender.startsWith('Female') && parameter.femaleReferenceRange) {
        return parameter.femaleReferenceRange;
    }
    if (gender.startsWith('Male') && parameter.maleReferenceRange) {
        return parameter.maleReferenceRange;
    }
    return parameter.maleReferenceRange || parameter.femaleReferenceRange || '';
};
/**
 * The blank parameter sheet a sample opens on. Tests carry their own sheet from
 * the master; the ones created before the catalogue existed fall back to it, so
 * result entry is never an empty grid and no report prints an empty table.
 */
const buildSheetForTest = (test, patient) => {
    const defined = Array.isArray(test?.parameters) && test.parameters.length ? test.parameters : null;
    const parameters = defined || (0, test_parameters_1.parametersForTest)(test?.testName || '', test?.testCode || '');
    return [...parameters]
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0))
        .map((p, idx) => ({
        parameterName: p.parameterName,
        shortName: p.shortName || '',
        value: '',
        unit: p.unit || '',
        referenceRange: rangeForPatient(p, patient),
        flag: 'Normal',
        method: p.method || '',
        resultType: p.resultType || 'Numeric',
        dropdownOptions: p.dropdownOptions || [],
        criticalLow: p.criticalLow || '',
        criticalHigh: p.criticalHigh || '',
        displayOrder: p.displayOrder || idx + 1,
    }));
};
/** True once the bench has typed something into at least one line. */
const hasAnyValue = (rows = []) => rows.some((r) => String(r?.value ?? '').trim() !== '');
class ResultService {
    static getBySampleId = async (sampleId) => {
        let result = await result_model_1.Result.findOne({ sample: sampleId })
            .populate('patient')
            .populate('sample')
            .populate('test');
        // A record that predates the parameter catalogue can be sitting there with
        // an empty sheet. Nothing has been typed into it yet, so filling it in now
        // costs nothing and saves the bench from an unusable grid.
        if (result && (!result.results || result.results.length === 0)) {
            const sheet = buildSheetForTest(result.test, result.patient);
            if (sheet.length) {
                result.results = sheet;
                await result.save();
            }
        }
        if (!result) {
            const sample = await sample_model_1.Sample.findById(sampleId).populate('patient').populate('test');
            if (!sample)
                throw new api_error_util_1.ApiError(404, 'Sample not found');
            const resultId = await (0, counter_model_1.getNextResultId)();
            const initialParameters = buildSheetForTest(sample.test, sample.patient);
            result = await result_model_1.Result.create({
                resultId,
                sample: sample._id,
                invoice: sample.invoice,
                patient: sample.patient,
                uhid: sample.uhid,
                test: sample.test,
                department: sample.department,
                results: initialParameters,
                status: 'Draft',
                enteredBy: {
                    userId: sample.patient,
                    name: 'Technician',
                    role: 'Lab Technician',
                },
            });
            result = await result_model_1.Result.findById(result._id).populate('patient').populate('sample').populate('test');
        }
        return result;
    };
    static getResultBySampleId = ResultService.getBySampleId;
    /**
     * Every test billed on the same visit, one sheet each.
     *
     * A patient who is billed for four tests leaves four vials and four sheets,
     * but they are one sitting at the bench - the technician reads the analyser
     * once and types all of it. Opening one sample and seeing only that test
     * meant walking back to the queue three times for the same patient, so the
     * whole visit is handed over together, in the order it was billed.
     */
    static getVisitBySampleId = async (sampleId) => {
        const sample = await sample_model_1.Sample.findById(sampleId);
        if (!sample)
            throw new api_error_util_1.ApiError(404, 'Sample not found');
        // A sample raised before bills carried samples has nothing to group by;
        // it is a visit of one.
        const siblings = sample.invoice
            ? await sample_model_1.Sample.find({ invoice: sample.invoice }).sort({ createdAt: 1 })
            : [sample];
        const sheets = [];
        for (const sibling of siblings) {
            sheets.push(await ResultService.getBySampleId(sibling._id.toString()));
        }
        return sheets;
    };
    static getAll = async (params) => {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const skip = (page - 1) * limit;
        const query = {};
        if (params.search) {
            query.$or = [
                { resultId: { $regex: params.search, $options: 'i' } },
                { uhid: { $regex: params.search, $options: 'i' } },
            ];
        }
        if (params.status)
            query.status = params.status;
        const [results, total] = await Promise.all([
            // The test comes along so a queue row can say which test it is, not just
            // which result id - a patient's visit puts several rows on the screen.
            result_model_1.Result.find(query).populate('patient').populate('test').sort({ createdAt: -1 }).skip(skip).limit(limit),
            result_model_1.Result.countDocuments(query),
        ]);
        return {
            results,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    };
    static getAllResults = ResultService.getAll;
    static getPending = async (params) => {
        return ResultService.getAll({ ...params, status: 'Submitted' });
    };
    static getPendingVerification = ResultService.getPending;
    static getById = async (id) => {
        // The invoice comes along for the referring doctor - the report has to say
        // who asked for the test, not just who ran it.
        const result = await result_model_1.Result.findById(id)
            .populate('patient')
            .populate('sample')
            .populate('test')
            .populate('department')
            .populate({
            path: 'invoice',
            populate: [{ path: 'referringDoctor' }, { path: 'organization' }],
        });
        if (!result)
            throw new api_error_util_1.ApiError(404, 'Result record not found');
        return result;
    };
    static getResultById = ResultService.getById;
    static saveDraft = async (data, currentUser) => {
        let resultRecord = await result_model_1.Result.findOne({ sample: data.sampleId });
        const sampleObj = await sample_model_1.Sample.findById(data.sampleId);
        if (!sampleObj)
            throw new api_error_util_1.ApiError(404, 'Sample not found');
        // Recompute the flag from the value every time rather than trusting the one
        // the browser sent - a corrected value with a stale 'Normal' beside it is
        // the kind of thing that gets missed on a printed report.
        const calculatedResults = (data.results || []).map((r) => ({
            ...r,
            flag: (0, flag_calculator_util_1.calculateResultFlag)(r.value, r.referenceRange, {
                criticalLow: r.criticalLow,
                criticalHigh: r.criticalHigh,
            }),
        }));
        const activeUser = currentUser || data.user || {};
        const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
        const userId = mongoose_1.default.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose_1.default.Types.ObjectId();
        if (!resultRecord) {
            const resultId = await (0, counter_model_1.getNextResultId)();
            resultRecord = await result_model_1.Result.create({
                resultId,
                sample: sampleObj._id,
                invoice: sampleObj.invoice,
                patient: sampleObj.patient,
                uhid: sampleObj.uhid,
                test: sampleObj.test,
                department: sampleObj.department,
                results: calculatedResults,
                status: 'Draft',
                overallRemarks: data.overallRemarks || '',
                enteredBy: {
                    userId,
                    name: activeUser.name || 'Technician',
                    role: activeUser.role || 'Lab Technician',
                },
            });
        }
        else {
            resultRecord.results = calculatedResults;
            if (data.overallRemarks)
                resultRecord.overallRemarks = data.overallRemarks;
            resultRecord.status = 'Draft';
            await resultRecord.save();
        }
        return resultRecord;
    };
    static saveResult = ResultService.saveDraft;
    static submitResult = async (data, currentUser) => {
        /**
         * One report per patient in the pathologist's queue.
         *
         * A visit is one report however many tests were billed on it, so every
         * test on this visit goes in together - they are sections of the same
         * document. What is held back is the patient's *next* report: while one is
         * waiting to be released, a second visit's results cannot be pushed in
         * behind it. Two unreleased reports for one patient is how a corrected
         * value gets signed off against the wrong visit.
         */
        const sample = await sample_model_1.Sample.findById(data.sampleId);
        if (!sample)
            throw new api_error_util_1.ApiError(404, 'Sample not found');
        const waiting = await result_model_1.Result.findOne({
            patient: sample.patient,
            status: { $in: ['Submitted', 'Under Review'] },
            invoice: { $ne: sample.invoice },
        }).select('resultId');
        if (waiting) {
            throw new api_error_util_1.ApiError(409, `This patient already has result ${waiting.resultId} waiting for verification. ` +
                'The pathologist has to approve that one before another report for the same patient can be sent in.');
        }
        const resultRecord = await ResultService.saveDraft(data, currentUser);
        // A sheet with nothing typed into it must not reach the pathologist. It
        // gets approved on trust and the patient is handed a report of empty rows.
        if (!hasAnyValue(resultRecord.results)) {
            throw new api_error_util_1.ApiError(400, 'Enter at least one parameter value before sending this result for verification.');
        }
        /**
         * A sheet with values on it is proof the specimen was drawn, accessioned
         * and run, so the specimen is walked up to Processing here. Without this
         * the sample sat in "Pending Collection" with a finished result against
         * it, and approving the result then failed on the one step it is allowed
         * to make - Processing to Completed.
         *
         * It runs before the sheet is marked Submitted so a specimen that cannot
         * legally be on the bench at all - a rejected draw - is refused here,
         * rather than going into the pathologist's queue and failing at the far
         * end when they try to release it.
         */
        await sample_service_1.SampleService.advanceTo(String(resultRecord.sample), workflow_1.SAMPLE_STATUS.PROCESSING, currentUser || data.user, `Results entered for ${resultRecord.resultId}`);
        resultRecord.status = 'Submitted';
        await resultRecord.save();
        return resultRecord;
    };
    static verifyResult = async (id, data, currentUser) => {
        const result = await result_model_1.Result.findById(id);
        if (!result)
            throw new api_error_util_1.ApiError(404, 'Result record not found');
        const activeUser = currentUser || data.user || {};
        const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
        const userId = mongoose_1.default.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose_1.default.Types.ObjectId();
        if (data.action === 'Approve') {
            // The last gate before a report is released to the patient. Nothing typed
            // means nothing to release, whatever the queue says.
            if (!hasAnyValue(result.results)) {
                throw new api_error_util_1.ApiError(400, 'This result has no values entered - it cannot be approved. Open result entry, fill the parameters in, and submit it again.');
            }
            result.status = 'Approved';
            result.verifiedBy = {
                userId,
                name: activeUser.name || 'Pathologist',
                // The schema calls this `date`; writing `verifiedAt` was silently
                // dropped by strict mode and the verification time was lost.
                date: new Date(),
            };
            // Go through the state machine so the completion is audited like every
            // other bench step, instead of writing the field behind its back. Any
            // stage the specimen never had ticked off is walked through on the way,
            // because a result being released is proof those stages happened.
            await sample_service_1.SampleService.advanceTo(String(result.sample), workflow_1.SAMPLE_STATUS.COMPLETED, activeUser, `Result ${result.resultId} approved`);
        }
        else if (data.action === 'Reject') {
            result.status = 'Rejected';
        }
        await result.save();
        return result;
    };
    /**
     * The visit's report, not one test's sheet. A patient billed for three tests
     * is handed one document with three sections - which is what the counter
     * prints and what the patient expects - so the whole visit is gathered here
     * and only the tests that actually have values on them are printed. A test
     * still sitting on the bench is left off rather than printed empty.
     */
    static generateReportPDF = async (id) => {
        const result = await ResultService.getById(id);
        const sampleId = result?.sample?._id || result?.sample;
        const sheets = sampleId ? await ResultService.getVisitBySampleId(String(sampleId)) : [result];
        const printable = sheets.filter((sheet) => hasAnyValue(sheet?.results) || String(sheet?._id) === String(result?._id));
        return (0, pdf_generator_util_1.generateDiagnosticReportPDF)(printable.length ? printable : [result]);
    };
    static generatePDFReport = ResultService.generateReportPDF;
}
exports.ResultService = ResultService;
