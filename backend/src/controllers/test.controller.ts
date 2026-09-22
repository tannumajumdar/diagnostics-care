import { Request, Response, NextFunction } from 'express';
import { LabTest } from '../models/test.model';
import { RateHistory } from '../models/rateHistory.model';
import { Invoice } from '../models/invoice.model';
import { Sample } from '../models/sample.model';
import { Result } from '../models/result.model';
import { Appointment } from '../models/appointment.model';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';
import { JwtPayload } from '../types/auth.interface';
import { parametersForTest } from '../constants/test-parameters';

export class TestController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, department, status, page = 1, limit = 10 } = req.query;
      const filter: any = {};
      if (search) {
        filter.$or = [
          { testName: { $regex: search, $options: 'i' } },
          { testCode: { $regex: search, $options: 'i' } },
        ];
      }
      if (department) filter.department = department;
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [tests, total] = await Promise.all([
        LabTest.find(filter).populate('department').sort({ testName: 1 }).skip(skip).limit(Number(limit)),
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
      const test = await LabTest.findById(id).populate('department');
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
      // Switching a test back to the bench clears where it used to be sent,
      // so a stale lab name cannot keep printing on the sample slip.
      if (body.processingMode === 'In-house') {
        body.outsourceLab = '';
        body.outsourceCost = 0;
      }
      const test = await LabTest.findByIdAndUpdate(id, body, { new: true });
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
}

