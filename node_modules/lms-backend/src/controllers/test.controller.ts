import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { repo, regexAny, mongoSort, refFilter } from '../db/repo';
import { assertObjectId } from '../db/ids';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';
import { JwtPayload } from '../types/auth.interface';
import { parametersForTest } from '../constants/test-parameters';
import { checkReportTemplate, isReportFormat, DOCX_MIME } from '../utils/docx-report.util';
import { formulaKey, formulaProblem } from '../utils/formula.util';

/**
 * A TPA's test is usually one the centre already runs under its own name, so
 * its parameter sheet is copied from that test instead of being typed again.
 * Returns the copied lines, or throws when the source test is gone.
 */
const parametersFrom = async (sourceId: string) => {
  const source = await repo.findById('labTest', sourceId);
  if (!source) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'The test to import parameters from was not found');
  return (source.parameters || []).map((p: any) => ({ ...p }));
};

/** `.populate('department').populate('tpa', 'organizationName')` */
const TEST_REFS = { department: true, tpa: { select: { id: true, organizationName: true } } };

/** '' and 'none' from the form both mean the centre's own catalogue. */
/** Reference files a test may carry - documents and images, nothing executable. */
const ATTACHMENT_TYPES: Record<string, string> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WEBP',
  'application/msword': 'DOC',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.ms-excel': 'XLS',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
  'text/plain': 'TXT',
  'text/csv': 'CSV',
};
/** Kept under the 10 MB JSON body limit once base64 adds its third. */
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

/** Browsers on Windows send '' for .doc/.csv, or call a .csv an Excel file - the extension decides. */
const TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  csv: 'text/csv',
};

const paramOf = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);

/** `reportId` is the attachment the test's report is printed from, if any. */
const attachmentView = (a: any, reportId?: any) => ({
  id: String(a._id),
  fileName: a.fileName,
  mimeType: a.mimeType,
  size: a.size,
  uploadedBy: a.uploadedBy?.name || '',
  createdAt: a.createdAt,
  isReport: Boolean(reportId) && String(reportId) === String(a._id),
});

/**
 * Makes a stored file the one the test's report is printed from. A Word file
 * uploaded through the old report-format screen is not a listed file, so it
 * goes once it is replaced.
 */
const useAsReport = async (test: any, file: any, userName?: string) => {
  const previous = test.reportTemplate?.attachment;
  test.reportTemplate = {
    attachment: file._id,
    fileName: file.fileName,
    size: file.size,
    uploadedAt: new Date(),
    uploadedBy: userName || '',
  };
  const saved = await repo.save('labTest', test);
  if (previous && String(previous) !== String(file._id)) {
    await prisma.testAttachment.deleteMany({ where: { id: String(previous), kind: 'report-template' } });
  }
  return saved;
};

/**
 * Refuses a parameter sheet whose formulas could never be worked out - a typo
 * in a name, a bracket left open - when it is saved, not on a patient's report.
 */
const checkFormulas = (parameters: any) => {
  if (!Array.isArray(parameters)) return;
  const known = new Set<string>();
  for (const p of parameters) {
    if (p?.resultType === 'Header') continue;
    if (p?.shortName) known.add(formulaKey(p.shortName));
    if (p?.parameterName) known.add(formulaKey(p.parameterName));
  }
  for (const p of parameters) {
    const formula = String(p?.formula || '').trim();
    if (!formula || p?.resultType === 'Header') continue;
    const problem = formulaProblem(formula, known, formulaKey(p.shortName || p.parameterName));
    if (problem) throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${p.parameterName}: ${problem}`);
  }
};

const normaliseTpa = (body: any) => {
  if (body.tpa === undefined) return;
  if (!body.tpa || body.tpa === 'none') body.tpa = null;
};

export class TestController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, department, status, tpa, page = 1, limit = 10 } = req.query;
      const filter: any = { AND: [] };
      if (search) filter.AND.push(await regexAny('labTest', ['testName', 'testCode'], String(search)));
      if (department) filter.departmentId = refFilter(department, 'department');
      if (status) filter.status = status;
      // 'own' is the centre's catalogue alone; an organisation id is that TPA's tests.
      if (tpa === 'own') filter.tpaId = null;
      else if (tpa) filter.tpaId = refFilter(tpa, 'tpa');

      const skip = (Number(page) - 1) * Number(limit);
      const [tests, total] = await Promise.all([
        repo.find('labTest', {
          where: filter,
          include: TEST_REFS,
          orderBy: mongoSort('labTest', { testName: 1 }),
          skip,
          take: Number(limit),
        }),
        repo.count('labTest', filter),
      ]);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Lab tests retrieved',
        data: tests,
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const test = await repo.findById('labTest', id, { include: TEST_REFS });
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Test details retrieved', data: test });
    } catch (error) {
      next(error);
    }
  };

  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // A test with no parameter sheet is unusable at the bench - result entry
      // opens on an empty grid and the report prints a blank table. The master
      // screen rarely stops to type twelve lines, so seed them from the test's
      // own name and let anyone edit them afterwards.
      const body = { ...req.body };
      normaliseTpa(body);
      checkFormulas(body.parameters);
      const { importParametersFrom } = body;
      delete body.importParametersFrom;
      if (importParametersFrom) body.parameters = await parametersFrom(importParametersFrom);
      if (!Array.isArray(body.parameters) || body.parameters.length === 0) {
        body.parameters = parametersForTest(body.testName, body.testCode);
      }

      // A test carries a whole rate card - patient, corporate, doctor,
      // emergency - but the master screen asks for the standard rate only.
      // All four start there and the centre tunes them under Rates; without
      // this the model's required tiers rejected every test the UI created.
      const rate = Number(body.rate) || 0;
      body.rate = rate;
      body.patientRate = Number(body.patientRate ?? rate);
      body.corporateRate = Number(body.corporateRate ?? rate);
      body.doctorRate = Number(body.doctorRate ?? rate);
      body.emergencyRate = Number(body.emergencyRate ?? rate);
      // The doctor's own copy prints this, and it is meant to sit above the
      // centre's rate. Starting it at the standard rate means a test added
      // without one is never printed *below* what the centre charges - the
      // admin marks the difference up under Rates.
      body.referralRate = Number(body.referralRate ?? rate);
      // Sent-out work is a property of the test, and the desk can still flip
      // a single bill the other way when the bench machine is down.
      if (body.processingMode !== 'Outsource') {
        body.processingMode = 'In-house';
        body.outsourceLab = '';
        body.outsourceCost = 0;
      }
      // The vial and the turnaround are no longer asked for on the master
      // screen, but sample registration prints both and the queue dates the
      // sample off the TAT - so a blank one falls back rather than saving empty.
      if (!String(body.sampleType || '').trim()) body.sampleType = 'Whole Blood';
      if (!String(body.sampleContainer || '').trim()) body.sampleContainer = 'EDTA Vial';
      if (!String(body.turnaroundTime || '').trim()) body.turnaroundTime = '24 Hours';

      const test = await repo.create('labTest', body);
      sendResponse({ res, statusCode: HTTP_STATUS.CREATED, message: 'Lab test created', data: test });
    } catch (error) {
      next(error);
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const body = { ...req.body };
      normaliseTpa(body);
      checkFormulas(body.parameters);
      // Editing a TPA's copy of a test can pull the sheet over again from
      // the centre's own test - it replaces the lines, it does not merge them.
      const { importParametersFrom } = body;
      delete body.importParametersFrom;
      if (importParametersFrom) {
        if (String(importParametersFrom) === String(id)) {
          throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'A test cannot import parameters from itself');
        }
        body.parameters = await parametersFrom(importParametersFrom);
      }
      // Switching a test back to the bench clears where it used to be sent,
      // so a stale lab name cannot keep printing on the sample slip.
      if (body.processingMode === 'In-house') {
        body.outsourceLab = '';
        body.outsourceCost = 0;
      }
      const test = await repo.updateById('labTest', id, body, { include: TEST_REFS });
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Lab test updated', data: test });
    } catch (error) {
      next(error);
    }
  };

  static updateRates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const currentUser = (req as any).user as JwtPayload;
      const test: any = await repo.findById('labTest', id);
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');

      const previousRates = {
        rate: test.rate,
        patientRate: test.patientRate,
        corporateRate: test.corporateRate,
        doctorRate: test.doctorRate,
        emergencyRate: test.emergencyRate,
        referralRate: test.referralRate,
      };

      const newRates = req.body.rates;
      test.rate = newRates.rate ?? test.rate;
      test.patientRate = newRates.patientRate ?? test.patientRate;
      test.corporateRate = newRates.corporateRate ?? test.corporateRate;
      test.doctorRate = newRates.doctorRate ?? test.doctorRate;
      test.emergencyRate = newRates.emergencyRate ?? test.emergencyRate;
      test.referralRate = newRates.referralRate ?? test.referralRate;
      const saved = await repo.save('labTest', test);

      await repo.create('rateHistory', {
        test: test._id,
        testCode: test.testCode,
        testName: test.testName,
        previousRates,
        // What the test now actually carries, not the partial patch that was
        // posted - a tariff trail has to read as the rate card on that date.
        newRates: { ...newRates, referralRate: saved.referralRate },
        changedBy: {
          userId: currentUser.userId,
          name: currentUser.name,
          email: currentUser.email,
        },
        reason: req.body.reason || 'Tariff update',
      });

      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Rates updated', data: saved });
    } catch (error) {
      next(error);
    }
  };

  static updateParameters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const test = await repo.findById('labTest', id);
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');

      checkFormulas(req.body.parameters);
      test.parameters = req.body.parameters;
      const saved = await repo.save('labTest', test);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Test parameters updated', data: saved });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Removes a test from the catalogue for good.
   *
   * Only a test nothing has used yet can actually go - one typed by mistake, or
   * added to try the screen out. The moment it has been billed, drawn or
   * reported, deleting it would leave an invoice line, a sample in the queue or
   * a filed report pointing at nothing, so the request is refused and the admin
   * is told to deactivate instead: that already takes it off the front desk
   * while the history it belongs to stays readable.
   */
  static remove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const test = await repo.findById('labTest', id);
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');

      const [invoices, samples, results, appointments] = await Promise.all([
        prisma.invoice.count({ where: { items: { some: { testId: test._id } } } }),
        prisma.sample.count({ where: { testId: test._id } }),
        prisma.result.count({ where: { testId: test._id } }),
        prisma.appointment.count({ where: { tests: { some: { testId: test._id } } } }),
      ]);

      const used = [
        invoices && `${invoices} bill${invoices > 1 ? 's' : ''}`,
        samples && `${samples} sample${samples > 1 ? 's' : ''}`,
        results && `${results} report${results > 1 ? 's' : ''}`,
        appointments && `${appointments} appointment${appointments > 1 ? 's' : ''}`,
      ].filter(Boolean);

      if (used.length) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          `${test.testName} is already on ${used.join(', ')} and cannot be deleted. ` +
            'Deactivate it instead - it comes off the billing screen and the history stays intact.'
        );
      }

      // Nothing ever priced against it, so the tariff trail goes with it.
      await prisma.rateHistory.deleteMany({ where: { testId: test._id } });
      await prisma.testAttachment.deleteMany({ where: { testId: test._id } });
      // Mongo left the id behind in any package holding the test, and a
      // populated package simply stopped listing it; the join row goes here.
      await prisma.testPackageItem.deleteMany({ where: { testId: test._id } });
      await prisma.labTest.delete({ where: { id: test._id } });

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `${test.testName} deleted`,
        data: { id: String(test._id) },
      });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const test = await repo.findById('labTest', id);
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');
      test.status = test.status === 'Active' ? 'Inactive' : 'Active';
      const saved = await repo.save('labTest', test);
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: saved });
    } catch (error) {
      next(error);
    }
  };
  static listAttachments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = assertObjectId(paramOf(req.params.id));
      const test = await repo.findById('labTest', id);
      const files = await repo.find('testAttachment', {
        where: { testId: id, kind: { not: 'report-template' } },
        orderBy: mongoSort('testAttachment', { createdAt: -1 }),
      });
      const reportId = (test as any)?.reportTemplate?.attachment;
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Test files retrieved',
        data: files.map((f: any) => attachmentView(f, reportId)),
      });
    } catch (error) {
      next(error);
    }
  };

  /** Takes `{ fileName, mimeType, data }` with the file as base64. */
  static uploadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = paramOf(req.params.id);
      const currentUser = (req as any).user as JwtPayload;
      let test: any = await repo.findById('labTest', id);
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');

      const fileName = String(req.body?.fileName || '').trim().slice(0, 200);
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      const mimeType = TYPE_BY_EXTENSION[extension] || String(req.body?.mimeType || '');
      const encoded = String(req.body?.data || '').replace(/^data:[^,]*,/, '');
      if (!fileName || !encoded) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Choose a file to upload');
      if (!ATTACHMENT_TYPES[mimeType]) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          `Only ${Object.values(ATTACHMENT_TYPES).join(', ')} files can be attached`
        );
      }
      const data = Buffer.from(encoded, 'base64');
      if (data.length === 0) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'The file is empty');
      if (data.length > MAX_ATTACHMENT_BYTES) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'A file can be at most 5 MB');
      }

      const file = await repo.create('testAttachment', {
        test: test._id,
        fileName,
        mimeType,
        size: data.length,
        data,
        uploadedBy: { userId: currentUser?.userId as any, name: currentUser?.name },
      });

      // A Word file laid out with #PTNAME# and the like is the test's report
      // format: the patient's report is printed from it with their details and
      // results filled in.
      let asReport = false;
      if (mimeType === DOCX_MIME && isReportFormat(data)) {
        try {
          checkReportTemplate(data);
          test = await useAsReport(test, file, currentUser?.name);
          asReport = true;
        } catch {
          // A file whose placeholders do not pair up stays a plain reference file.
        }
      }
      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: asReport ? `File uploaded - ${test.testName} reports will now print in ${fileName}` : 'File uploaded',
        data: attachmentView(file, asReport ? file._id : (test as any).reportTemplate?.attachment),
      });
    } catch (error) {
      next(error);
    }
  };

  static downloadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await repo.findOne(
        'testAttachment',
        {
          id: assertObjectId(paramOf(req.params.attachmentId)),
          testId: assertObjectId(paramOf(req.params.id), 'test'),
        },
        { omit: { data: false } }
      );
      if (!file) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'File not found');
      res.setHeader('Content-Type', file.mimeType);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader(
        'Content-Disposition',
        `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`
      );
      res.end(file.data);
    } catch (error) {
      next(error);
    }
  };

  static removeAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await repo.findOne('testAttachment', {
        id: assertObjectId(paramOf(req.params.attachmentId)),
        testId: assertObjectId(paramOf(req.params.id), 'test'),
        kind: { not: 'report-template' },
      });
      if (!file) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'File not found');
      // Removing the file the report printed from puts the test back on the
      // standard report. Done before the delete: the foreign key would
      // otherwise clear only the link and leave the rest of reportTemplate.
      await prisma.labTest.updateMany({
        where: { id: String(file.test), reportTemplateAttachmentId: file._id },
        data: {
          reportTemplateAttachmentId: null,
          reportTemplateFileName: null,
          reportTemplateSize: null,
          reportTemplateUploadedAt: null,
          reportTemplateUploadedBy: null,
        },
      });
      await prisma.testAttachment.delete({ where: { id: file._id } });
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: `${file.fileName} removed`, data: { id: String(file._id) } });
    } catch (error) {
      next(error);
    }
  };

  /** Prints this test's report from one of its uploaded Word files. */
  static useAttachmentAsReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const test = await repo.findById('labTest', paramOf(req.params.id));
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');
      const file = await repo.findOne(
        'testAttachment',
        {
          id: assertObjectId(paramOf(req.params.attachmentId)),
          testId: test._id,
          kind: { not: 'report-template' },
        },
        { omit: { data: false } }
      );
      if (!file) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'File not found');
      if (file.mimeType !== DOCX_MIME) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Only a Word .docx file can be used as the report');
      }
      checkReportTemplate(file.data);
      const saved = await useAsReport(test, file, currentUser?.name);
      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: `${test.testName} reports will now print in ${file.fileName}`,
        data: saved.reportTemplate,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Sets the Word file this test's report is printed from, replacing any
   * earlier one. Takes `{ fileName, data }` with the .docx as base64.
   */
  static uploadReportTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).user as JwtPayload;
      const test = await repo.findById('labTest', paramOf(req.params.id));
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');

      const fileName = String(req.body?.fileName || '').trim().slice(0, 200);
      const encoded = String(req.body?.data || '').replace(/^data:[^,]*,/, '');
      if (!fileName || !encoded) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Choose a Word file to upload');
      if (!/\.docx$/i.test(fileName)) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'The report format must be a Word .docx file - open a .doc in Word and "Save As" .docx first'
        );
      }
      const data = Buffer.from(encoded, 'base64');
      if (data.length === 0) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'The file is empty');
      if (data.length > MAX_ATTACHMENT_BYTES) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'A file can be at most 5 MB');
      // Refused here, not on a patient's report later: a file that is not a
      // .docx, or whose #PLACEHOLDERS# do not pair up.
      checkReportTemplate(data);

      const file = await repo.create('testAttachment', {
        test: test._id,
        fileName,
        mimeType: DOCX_MIME,
        size: data.length,
        data,
        kind: 'report-template',
        uploadedBy: { userId: currentUser?.userId as any, name: currentUser?.name },
      });

      const previous = (test as any).reportTemplate?.attachment;
      (test as any).reportTemplate = {
        attachment: file._id,
        fileName,
        size: data.length,
        uploadedAt: new Date(),
        uploadedBy: currentUser?.name || '',
      };
      const saved = await repo.save('labTest', test);
      if (previous) {
        await prisma.testAttachment.deleteMany({ where: { id: String(previous), kind: 'report-template' } });
      }

      sendResponse({
        res,
        statusCode: HTTP_STATUS.CREATED,
        message: 'Report format uploaded',
        data: saved.reportTemplate,
      });
    } catch (error) {
      next(error);
    }
  };

  static downloadReportTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const test = await repo.findById('labTest', paramOf(req.params.id));
      const ref = (test as any)?.reportTemplate;
      if (!ref) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'This test has no report format');
      const file = await repo.findById('testAttachment', ref.attachment, { omit: { data: false } });
      if (!file) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'The report format file is missing');
      res.setHeader('Content-Type', DOCX_MIME);
      res.setHeader('Content-Length', String(file.size));
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`);
      res.end(file.data);
    } catch (error) {
      next(error);
    }
  };

  /** Back to the standard report layout for this test. */
  static removeReportTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const test = await repo.findById('labTest', paramOf(req.params.id));
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');
      const ref = (test as any).reportTemplate;
      (test as any).reportTemplate = null;
      await repo.save('labTest', test);
      if (ref?.attachment) {
        await prisma.testAttachment.deleteMany({ where: { id: String(ref.attachment), kind: 'report-template' } });
      }
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Report format removed', data: null });
    } catch (error) {
      next(error);
    }
  };
}

