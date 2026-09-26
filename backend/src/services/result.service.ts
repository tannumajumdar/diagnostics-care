import mongoose from 'mongoose';
import { Result } from '../models/result.model';
import { Sample } from '../models/sample.model';
import { Patient } from '../models/patient.model';
import { getNextResultId } from '../models/counter.model';
import { ApiError } from '../utils/api-error.util';
import { generateDiagnosticReportPDF } from '../utils/pdf-generator.util';
import { calculateResultFlag } from '../utils/flag-calculator.util';
import { parametersForTest } from '../constants/test-parameters';
import { SampleService } from './sample.service';
import { SAMPLE_STATUS } from '../constants/workflow';

/**
 * Picks the range that actually applies to the person on the report. A child's
 * haemoglobin read against an adult male band flags half the paediatric ward as
 * anaemic, and a woman's creatinine read against a man's looks falsely fine -
 * so the sheet is cut to the patient before the bench ever sees it.
 */
const rangeForPatient = (parameter: any, patient: any): string => {
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

/** The patient's age in days - off the date of birth when the desk took one. */
const ageInDays = (patient: any): number => {
  const born = patient?.dateOfBirth ? new Date(patient.dateOfBirth) : null;
  if (born && !isNaN(born.getTime())) {
    return Math.max(0, Math.floor((Date.now() - born.getTime()) / 86400000));
  }
  const years = Number(patient?.age);
  return isNaN(years) ? 0 : Math.round(years * 365);
};

/** A row laid out the desktop way - its range is MIN / MAX, not the sex strings. */
const isBandRow = (p: any) =>
  !p.maleReferenceRange && !p.femaleReferenceRange && !p.childReferenceRange;

const bandRange = (p: any): string => {
  const min = String(p.minValue || '').trim();
  const max = String(p.maxValue || '').trim();
  if (min && max) return `${min} - ${max}`;
  if (max) return `< ${max}`;
  if (min) return `> ${min}`;
  return String(p.referenceText || '').trim();
};

/**
 * Of the rows the master holds for one parameter, the one this patient is read
 * against: a row for their own sex beats an ALL row, and either has to cover
 * their age. A patient no row covers falls back to the ALL row, then any row,
 * so the line is never dropped from the sheet.
 */
const pickBand = (rows: any[], patient: any) => {
  if (rows.length === 1) return rows[0];
  const gender = String(patient?.gender || '');
  const sex = gender.startsWith('Female') ? 'FEMALE' : gender.startsWith('Male') ? 'MALE' : '';
  const days = ageInDays(patient);
  const fitsAge = (r: any) => {
    const from = Number(r.ageFromDays) || 0;
    const to = Number(r.ageToDays) || 0;
    return days >= from && (to === 0 || days <= to);
  };
  const forSex = (r: any) => (r.paraFor || 'ALL') === sex;
  const forAll = (r: any) => (r.paraFor || 'ALL') === 'ALL';

  return (
    rows.find((r) => forSex(r) && fitsAge(r)) ||
    rows.find((r) => forAll(r) && fitsAge(r)) ||
    rows.find(forAll) ||
    rows[0]
  );
};

/**
 * The blank parameter sheet a sample opens on. Tests carry their own sheet from
 * the master; the ones created before the catalogue existed fall back to it, so
 * result entry is never an empty grid and no report prints an empty table.
 *
 * The master can hold several rows for one parameter (one per sex / age band),
 * so rows are grouped by name and one line per parameter goes on the sheet.
 */
const buildSheetForTest = (test: any, patient: any) => {
  const defined = Array.isArray(test?.parameters) && test.parameters.length ? test.parameters : null;
  const parameters = defined || parametersForTest(test?.testName || '', test?.testCode || '');

  const groups = new Map<string, any[]>();
  [...parameters]
    .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0))
    .forEach((p: any) => {
      const key = String(p.parameterName || '').trim().toLowerCase();
      groups.set(key, [...(groups.get(key) || []), p]);
    });

  return Array.from(groups.values()).map((rows: any[], idx: number) => {
    const p = pickBand(rows, patient);
    const header = p.resultType === 'Header';
    return {
      parameterName: p.parameterName,
      shortName: p.shortName || '',
      value: '',
      unit: header ? '' : p.unit || '',
      referenceRange: header ? '' : isBandRow(p) ? bandRange(p) : rangeForPatient(p, patient),
      flag: 'Normal' as const,
      method: p.method || '',
      resultType: p.resultType || 'Numeric',
      dropdownOptions: p.dropdownOptions || [],
      criticalLow: p.criticalLow || '',
      criticalHigh: p.criticalHigh || '',
      highRange: header ? '' : p.highRange || '',
      lowRange: header ? '' : p.lowRange || '',
      displayOrder: idx + 1,
    };
  });
};

/** True once the bench has typed something into at least one line. */
const hasAnyValue = (rows: any[] = []) =>
  rows.some((r: any) => String(r?.value ?? '').trim() !== '');

const RELEASED = ['Approved', 'Final'];

const departmentNameOf = (sheet: any): string =>
  (typeof sheet?.department === 'object' && sheet.department?.departmentName) || '';

/**
 * The visit's tests laid out the way the report reads them: grouped by
 * department (Haematology together, Biochemistry together), and in the order
 * they were billed inside each department. A plain billing order scattered one
 * department's tests across the report whenever the desk added them out of
 * turn.
 */
const organizeSheets = <T>(sheets: T[]): T[] =>
  sheets
    .map((sheet, index) => ({ sheet, index }))
    .sort(
      (a, b) =>
        departmentNameOf(a.sheet).localeCompare(departmentNameOf(b.sheet)) || a.index - b.index
    )
    .map(({ sheet }) => sheet);

/**
 * A patient is handed one report for the visit, so it is only ready once
 * every test billed on it has been run and released. Tests on a visit finish
 * at different times - a CBC is out in an hour, a culture in three days - and
 * printing the fast ones early meant the patient carried home a report with
 * tests missing from it.
 */
const visitReadiness = (sheets: any[]) => {
  const pending = sheets
    .filter((sheet) => {
      const sample = typeof sheet?.sample === 'object' ? sheet.sample : null;
      return sample?.status !== SAMPLE_STATUS.COMPLETED || !RELEASED.includes(sheet?.status);
    })
    .map((sheet) => {
      const sample = typeof sheet?.sample === 'object' ? sheet.sample : {};
      const test = typeof sheet?.test === 'object' ? sheet.test : {};
      return {
        testName: test.testName || sample.testName || 'Test',
        sampleId: sample.sampleId,
        stage: sample.status === SAMPLE_STATUS.COMPLETED ? `Result ${sheet?.status || 'Draft'}` : sample.status,
      };
    });
  return {
    total: sheets.length,
    completed: sheets.length - pending.length,
    pending,
    isReady: sheets.length > 0 && pending.length === 0,
  };
};

export class ResultService {
  static getBySampleId = async (sampleId: string) => {
    let result = await Result.findOne({ sample: sampleId })
      .populate('patient')
      .populate('sample')
      .populate('test')
      .populate('department');

    // A record that predates the parameter catalogue can be sitting there with
    // an empty sheet. Nothing has been typed into it yet, so filling it in now
    // costs nothing and saves the bench from an unusable grid.
    if (result && (!result.results || result.results.length === 0)) {
      const sheet = buildSheetForTest(result.test as any, result.patient as any);
      if (sheet.length) {
        result.results = sheet as any;
        await result.save();
      }
    }

    if (!result) {
      const sample = await Sample.findById(sampleId).populate('patient').populate('test');
      if (!sample) throw new ApiError(404, 'Sample not found');

      const resultId = await getNextResultId();
      const initialParameters = buildSheetForTest(sample.test as any, sample.patient as any);

      result = await Result.create({
        resultId,
        sample: sample._id,
        invoice: sample.invoice,
        patient: sample.patient,
        uhid: sample.uhid,
        enquiryNo: sample.enquiryNo,
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

      result = await Result.findById(result._id)
        .populate('patient')
        .populate('sample')
        .populate('test')
        .populate('department');
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
  static getVisitBySampleId = async (sampleId: string) => {
    const sample = await Sample.findById(sampleId);
    if (!sample) throw new ApiError(404, 'Sample not found');

    // A sample raised before bills carried samples has nothing to group by;
    // it is a visit of one. A test the patient called off is not part of the
    // visit's work or its report, unless it is the one being opened.
    const siblings = sample.invoice
      ? await Sample.find({
          invoice: sample.invoice,
          $or: [{ status: { $ne: SAMPLE_STATUS.CANCELLED } }, { _id: sample._id }],
        }).sort({ createdAt: 1 })
      : [sample];

    const sheets = [];
    for (const sibling of siblings) {
      sheets.push(await ResultService.getBySampleId(sibling._id.toString()));
    }

    return organizeSheets(sheets);
  };

  static getAll = async (params: { search?: string; status?: string; page?: number; limit?: number }) => {
    const page = params.page || 1;
    const limit = params.limit || 10;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (params.search) {
      query.$or = [
        { resultId: { $regex: params.search, $options: 'i' } },
        { uhid: { $regex: params.search, $options: 'i' } },
        { enquiryNo: { $regex: params.search, $options: 'i' } },
      ];
    }
    if (params.status) query.status = params.status;

    const [results, total] = await Promise.all([
      // The test comes along so a queue row can say which test it is, not just
      // which result id - a patient's visit puts several rows on the screen.
      Result.find(query).populate('patient').populate('test').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Result.countDocuments(query),
    ]);

    return {
      results,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  };

  static getAllResults = ResultService.getAll;

  /**
   * Every patient's report, one row per visit, carrying the values typed
   * against each test. Only sheets the bench has actually filled in are
   * listed - an empty sheet is work still waiting, not a report.
   */
  static getPatientReports = async (params: {
    search?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: number | string;
    limit?: number | string;
  }) => {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 10));
    const skip = (page - 1) * limit;

    const match: any = {
      results: { $elemMatch: { value: { $nin: ['', null] } } },
    };
    if (params.status) match.status = params.status;

    if (params.from || params.to) {
      match.updatedAt = {};
      if (params.from) match.updatedAt.$gte = new Date(`${params.from}T00:00:00`);
      if (params.to) match.updatedAt.$lte = new Date(`${params.to}T23:59:59.999`);
    }

    const search = String(params.search || '').trim();
    if (search) {
      const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const patients = await Patient.find({
        $or: [
          { patientName: { $regex: pattern, $options: 'i' } },
          { mobile: { $regex: pattern, $options: 'i' } },
        ],
      })
        .select('_id')
        .limit(500);

      match.$or = [
        { resultId: { $regex: pattern, $options: 'i' } },
        { uhid: { $regex: pattern, $options: 'i' } },
        { enquiryNo: { $regex: pattern, $options: 'i' } },
        { patient: { $in: patients.map((p) => p._id) } },
      ];
    }

    // Page by visit, not by test, so one patient's three tests never straddle
    // two pages.
    const [grouped] = await Result.aggregate([
      { $match: match },
      { $group: { _id: '$invoice', lastUpdated: { $max: '$updatedAt' } } },
      { $sort: { lastUpdated: -1 } },
      {
        $facet: {
          rows: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: 'count' }],
        },
      },
    ]);

    const visitIds = (grouped?.rows || []).map((row: any) => row._id);
    const total = grouped?.total?.[0]?.count || 0;

    const sheets = await Result.find({ ...match, invoice: { $in: visitIds } })
      .populate('patient')
      .populate('test')
      .populate('department')
      .populate({ path: 'invoice', populate: [{ path: 'referringDoctor' }] })
      .sort({ createdAt: 1 });

    // Every test billed on these visits, filled in or not, so a row can say
    // which tests the report is still waiting on.
    const visitSamples = await Sample.find({
      invoice: { $in: visitIds },
      status: { $ne: SAMPLE_STATUS.CANCELLED },
    })
      .select('invoice sampleId testName status test')
      .populate('test', 'testName')
      .sort({ createdAt: 1 });
    const visitSheets = await Result.find({ sample: { $in: visitSamples.map((s) => s._id) } }).select(
      'sample status'
    );
    const sheetStatusBySample = new Map(visitSheets.map((r: any) => [String(r.sample), r.status]));

    const reports = (grouped?.rows || []).map((row: any) => {
      const tests = organizeSheets(
        sheets.filter((s: any) => String(s.invoice?._id || s.invoice) === String(row._id))
      );
      const readiness = visitReadiness(
        visitSamples
          .filter((s: any) => String(s.invoice) === String(row._id))
          .map((s: any) => ({ sample: s, test: s.test, status: sheetStatusBySample.get(String(s._id)) }))
      );
      const first: any = tests[0] || {};
      const invoice: any = first.invoice || {};

      return {
        _id: String(row._id),
        invoiceNumber: invoice.invoiceNumber,
        enquiryNo: first.enquiryNo || invoice.enquiryNo,
        uhid: first.uhid,
        patient: first.patient,
        referredBy:
          (typeof invoice.referringDoctor === 'object' ? invoice.referringDoctor?.doctorName : '') ||
          invoice.referringDoctorName ||
          'Self / Walk-in',
        visitDate: invoice.createdAt || first.createdAt,
        lastUpdated: row.lastUpdated,
        readiness,
        tests: tests.map((s: any) => ({
          _id: s._id,
          resultId: s.resultId,
          testName: s.test?.testName || 'Test',
          department: s.department?.departmentName,
          status: s.status,
          overallRemarks: s.overallRemarks,
          enteredBy: s.enteredBy,
          verifiedBy: s.verifiedBy,
          updatedAt: s.updatedAt,
          results: (s.results || [])
            .filter((p: any) => p.resultType === 'Header' || String(p.value ?? '').trim() !== '')
            .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0)),
        })),
      };
    });

    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      reports,
      pagination: { total, page, limit, totalPages },
    };
  };

  static getPending = async (params?: { page?: number; limit?: number }) => {
    return ResultService.getAll({ ...params, status: 'Submitted' });
  };

  static getPendingVerification = ResultService.getPending;

  static getById = async (id: string) => {
    // The invoice comes along for the referring doctor - the report has to say
    // who asked for the test, not just who ran it.
    const result = await Result.findById(id)
      .populate('patient')
      .populate('sample')
      .populate('test')
      .populate('department')
      .populate({
        path: 'invoice',
        populate: [{ path: 'referringDoctor' }, { path: 'organization' }],
      });
    if (!result) throw new ApiError(404, 'Result record not found');
    return result;
  };

  static getResultById = ResultService.getById;

  static saveDraft = async (
    data: { sampleId: string; results: any[]; overallRemarks?: string; user?: any },
    currentUser?: any
  ) => {
    let resultRecord = await Result.findOne({ sample: data.sampleId });
    const sampleObj = await Sample.findById(data.sampleId);
    if (!sampleObj) throw new ApiError(404, 'Sample not found');

    // Recompute the flag from the value every time rather than trusting the one
    // the browser sent - a corrected value with a stale 'Normal' beside it is
    // the kind of thing that gets missed on a printed report. A header row is
    // only a section title - whatever the browser sent, it holds no value and
    // can never flag. The one exception is a flag the bench picked by hand:
    // that is a deliberate call on the value, so it is kept as sent.
    const MANUAL_FLAGS = ['Normal', 'Low', 'High', 'Critical'];
    const calculatedResults = (data.results || []).map((r: any) =>
      r.resultType === 'Header'
        ? { ...r, value: '', flag: 'Normal', flagManual: false }
        : r.flagManual && String(r.value ?? '').trim() !== '' && MANUAL_FLAGS.includes(r.flag)
        ? { ...r, flagManual: true }
        : {
            ...r,
            flagManual: false,
            flag: calculateResultFlag(r.value, r.referenceRange, {
              criticalLow: r.criticalLow,
              criticalHigh: r.criticalHigh,
              highRange: r.highRange,
              lowRange: r.lowRange,
            }),
          }
    );

    const activeUser = currentUser || data.user || {};
    const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
    const userId = mongoose.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose.Types.ObjectId();

    if (!resultRecord) {
      const resultId = await getNextResultId();
      resultRecord = await Result.create({
        resultId,
        sample: sampleObj._id,
        invoice: sampleObj.invoice,
        patient: sampleObj.patient,
        uhid: sampleObj.uhid,
        enquiryNo: sampleObj.enquiryNo,
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
    } else {
      resultRecord.results = calculatedResults;
      if (data.overallRemarks) resultRecord.overallRemarks = data.overallRemarks;
      resultRecord.status = 'Draft';
      await resultRecord.save();
    }

    return resultRecord;
  };

  static saveResult = ResultService.saveDraft;

  static submitResult = async (
    data: { sampleId: string; results: any[]; overallRemarks?: string; user?: any },
    currentUser?: any
  ) => {
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
    const sample = await Sample.findById(data.sampleId);
    if (!sample) throw new ApiError(404, 'Sample not found');

    const waiting = await Result.findOne({
      patient: sample.patient,
      status: { $in: ['Submitted', 'Under Review'] },
      invoice: { $ne: sample.invoice },
    }).select('resultId');

    if (waiting) {
      throw new ApiError(
        409,
        `This patient already has result ${waiting.resultId} waiting for verification. ` +
          'The pathologist has to approve that one before another report for the same patient can be sent in.'
      );
    }

    const resultRecord = await ResultService.saveDraft(data, currentUser);

    // A sheet with nothing typed into it must not reach the pathologist. It
    // gets approved on trust and the patient is handed a report of empty rows.
    if (!hasAnyValue(resultRecord.results)) {
      throw new ApiError(
        400,
        'Enter at least one parameter value before sending this result for verification.'
      );
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
    await SampleService.advanceTo(
      String(resultRecord.sample),
      SAMPLE_STATUS.PROCESSING,
      currentUser || data.user,
      `Results entered for ${resultRecord.resultId}`
    );

    resultRecord.status = 'Submitted';
    await resultRecord.save();
    return resultRecord;
  };

  static verifyResult = async (
    id: string,
    data: { action: 'Approve' | 'Reject' | 'Under Review'; rejectionReason?: string; user?: any },
    currentUser?: any
  ) => {
    const result = await Result.findById(id);
    if (!result) throw new ApiError(404, 'Result record not found');

    const activeUser = currentUser || data.user || {};
    const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
    const userId = mongoose.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose.Types.ObjectId();

    if (data.action === 'Approve') {
      // The last gate before a report is released to the patient. Nothing typed
      // means nothing to release, whatever the queue says.
      if (!hasAnyValue(result.results)) {
        throw new ApiError(
          400,
          'This result has no values entered - it cannot be approved. Open result entry, fill the parameters in, and submit it again.'
        );
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
      await SampleService.advanceTo(
        String(result.sample),
        SAMPLE_STATUS.COMPLETED,
        activeUser,
        `Result ${result.resultId} approved`
      );
    } else if (data.action === 'Reject') {
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
  static generateReportPDF = async (id: string): Promise<Buffer> => {
    const result = await ResultService.getById(id);

    const sampleId = (result as any)?.sample?._id || (result as any)?.sample;
    const sheets = sampleId ? await ResultService.getVisitBySampleId(String(sampleId)) : [result];

    // No partial reports: the patient gets one document once the last test on
    // the visit is released, not a copy per test as each one finishes.
    const readiness = visitReadiness(sheets);
    if (!readiness.isReady) {
      throw new ApiError(
        409,
        `The report is not ready - ${readiness.completed} of ${readiness.total} tests are completed. ` +
          `Still waiting on: ${readiness.pending.map((p) => `${p.testName} (${p.stage})`).join(', ')}.`
      );
    }

    return generateDiagnosticReportPDF(sheets);
  };

  static generatePDFReport = ResultService.generateReportPDF;
}
