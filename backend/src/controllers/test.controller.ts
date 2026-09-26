import { Request, Response, NextFunction } from 'express';
import { LabTest } from '../models/test.model';
import { RateHistory } from '../models/rateHistory.model';
import { TestAttachment } from '../models/testAttachment.model';
import { Invoice } from '../models/invoice.model';
import { Sample } from '../models/sample.model';
import { Result } from '../models/result.model';
import { Appointment } from '../models/appointment.model';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';
import { JwtPayload } from '../types/auth.interface';
import { parametersForTest } from '../constants/test-parameters';

/**
 * A TPA's test is usually one the centre already runs under its own name, so
 * its parameter sheet is copied from that test instead of being typed again.
 * Returns the copied lines, or throws when the source test is gone.
 */
const parametersFrom = async (sourceId: string) => {
  const source = await LabTest.findById(sourceId).lean();
  if (!source) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'The test to import parameters from was not found');
  return (source.parameters || []).map((p: any) => ({ ...p }));
};

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

const paramOf = (v: string | string[]) => (Array.isArray(v) ? v[0] : v);

const attachmentView = (a: any) => ({
  id: String(a._id),
  fileName: a.fileName,
  mimeType: a.mimeType,
  size: a.size,
  uploadedBy: a.uploadedBy?.name || '',
  createdAt: a.createdAt,
});

const normaliseTpa = (body: any) => {
  if (body.tpa === undefined) return;
  if (!body.tpa || body.tpa === 'none') body.tpa = null;
};

export class TestController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, department, status, tpa, page = 1, limit = 10 } = req.query;
      const filter: any = {};
      if (search) {
        filter.$or = [
          { testName: { $regex: search, $options: 'i' } },
          { testCode: { $regex: search, $options: 'i' } },
        ];
      }
      if (department) filter.department = department;
      if (status) filter.status = status;
      // 'own' is the centre's catalogue alone; an organisation id is that TPA's tests.
      if (tpa === 'own') filter.tpa = null;
      else if (tpa) filter.tpa = tpa;

      const skip = (Number(page) - 1) * Number(limit);
      const [tests, total] = await Promise.all([
        LabTest.find(filter)
          .populate('department')
          .populate('tpa', 'organizationName')
          .sort({ testName: 1 }).skip(skip).limit(Number(limit)),
        LabTest.countDocuments(filter),
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
      const test = await LabTest.findById(id).populate('department').populate('tpa', 'organizationName');
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

      const test = await LabTest.create(body);
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
      const test = await LabTest.findByIdAndUpdate(id, body, { new: true })
        .populate('department')
        .populate('tpa', 'organizationName');
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
      const test = await LabTest.findById(id);
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
      await test.save();

      await RateHistory.create({
        test: test._id,
        testCode: test.testCode,
        testName: test.testName,
        previousRates,
        // What the test now actually carries, not the partial patch that was
        // posted - a tariff trail has to read as the rate card on that date.
        newRates: { ...newRates, referralRate: test.referralRate },
        changedBy: {
          userId: currentUser.userId,
          name: currentUser.name,
          email: currentUser.email,
        },
        reason: req.body.reason || 'Tariff update',
      });

      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Rates updated', data: test });
    } catch (error) {
      next(error);
    }
  };

  static updateParameters = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const test = await LabTest.findById(id);
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');

      test.parameters = req.body.parameters;
      await test.save();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Test parameters updated', data: test });
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
      const test = await LabTest.findById(id);
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');

      const [invoices, samples, results, appointments] = await Promise.all([
        Invoice.countDocuments({ 'items.test': test._id }),
        Sample.countDocuments({ test: test._id }),
        Result.countDocuments({ test: test._id }),
        Appointment.countDocuments({ tests: test._id }),
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
      await RateHistory.deleteMany({ test: test._id });
      await TestAttachment.deleteMany({ test: test._id });
      await test.deleteOne();

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
      const test = await LabTest.findById(id);
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');
      test.status = test.status === 'Active' ? 'Inactive' : 'Active';
      await test.save();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: test });
    } catch (error) {
      next(error);
    }
  };
  static listAttachments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = await TestAttachment.find({ test: paramOf(req.params.id) }).sort({ createdAt: -1 });
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Test files retrieved', data: files.map(attachmentView) });
    } catch (error) {
      next(error);
    }
  };

  /** Takes `{ fileName, mimeType, data }` with the file as base64. */
  static uploadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = paramOf(req.params.id);
      const currentUser = (req as any).user as JwtPayload;
      const test = await LabTest.findById(id).select('_id');
      if (!test) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Test not found');

      const fileName = String(req.body?.fileName || '').trim().slice(0, 200);
      const mimeType = String(req.body?.mimeType || '');
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

      const file = await TestAttachment.create({
        test: test._id,
        fileName,
        mimeType,
        size: data.length,
        data,
        uploadedBy: { userId: currentUser?.userId as any, name: currentUser?.name },
      });
      sendResponse({ res, statusCode: HTTP_STATUS.CREATED, message: 'File uploaded', data: attachmentView(file) });
    } catch (error) {
      next(error);
    }
  };

  static downloadAttachment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await TestAttachment.findOne({
        _id: paramOf(req.params.attachmentId),
        test: paramOf(req.params.id),
      }).select('+data');
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
      const file = await TestAttachment.findOneAndDelete({
        _id: paramOf(req.params.attachmentId),
        test: paramOf(req.params.id),
      });
      if (!file) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'File not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: `${file.fileName} removed`, data: { id: String(file._id) } });
    } catch (error) {
      next(error);
    }
  };
}

