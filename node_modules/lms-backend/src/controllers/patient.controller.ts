import { Request, Response, NextFunction } from 'express';
import { Patient } from '../models/patient.model';
import { Invoice } from '../models/invoice.model';
import { Payment } from '../models/payment.model';
import { Sample } from '../models/sample.model';
import { Result } from '../models/result.model';
import { Appointment } from '../models/appointment.model';
import { getNextUhid } from '../models/counter.model';
import { sendResponse } from '../utils/api-response.util';
import { HTTP_STATUS } from '../constants/messages';
import { ApiError } from '../utils/api-error.util';

export class PatientController {
  static getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { search, status, page = 1, limit = 10 } = req.query;
      const filter: any = {};
      if (search) {
        filter.$or = [
          { patientName: { $regex: search, $options: 'i' } },
          { uhid: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
        ];
      }
      if (status) filter.status = status;

      const skip = (Number(page) - 1) * Number(limit);
      const [patients, total] = await Promise.all([
        Patient.find(filter).populate('referringDoctor').populate('organization').sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
        Patient.countDocuments(filter),
      ]);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Patients retrieved',
        data: patients,
        meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
      });
    } catch (error) {
      next(error);
    }
  };

  static getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const patient = await Patient.findById(id).populate('referringDoctor').populate('organization');
      if (!patient) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Patient not found');

      const invoices = await Invoice.find({ patient: patient._id }).sort({ createdAt: -1 });
      const payments = await Payment.find({ patient: patient._id }).sort({ createdAt: -1 });
      const testHistory = await Sample.find({ patient: patient._id }).sort({ createdAt: -1 });

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Patient profile retrieved',
        data: {
          patient,
          invoices,
          payments,
          testHistory,
          reports: [],
          appointments: [],
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * A patient's whole record at the centre, organised the way the front desk
   * reads it: by visit.
   *
   * This used to hand back `getById`, which is the profile - a flat list of
   * invoices next to a flat list of samples, with `reports` and `appointments`
   * hardcoded to empty arrays. The desk cannot answer the questions it is
   * actually asked from that: has this patient been before, do they still owe
   * anything, is last week's report ready to collect, which test was it. Each
   * bill is returned here with the samples and reports that came out of it,
   * and with a summary above them.
   */
  static getHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const patient = await Patient.findById(id).populate('referringDoctor').populate('organization');
      if (!patient) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Patient not found');

      const [invoices, payments, samples, results, appointments] = await Promise.all([
        Invoice.find({ patient: patient._id }).populate('referringDoctor', 'doctorName').sort({ createdAt: -1 }),
        Payment.find({ patient: patient._id }).sort({ createdAt: -1 }),
        Sample.find({ patient: patient._id }).sort({ createdAt: -1 }),
        Result.find({ patient: patient._id }).populate('test', 'testName').sort({ createdAt: -1 }),
        Appointment.find({ patient: patient._id }).sort({ date: -1 }),
      ]);

      const key = (value: any) => String(value?._id ?? value ?? '');

      // Grouped once rather than scanned per invoice - a long-standing patient
      // can carry hundreds of samples, and the nested search was the whole
      // cost of this endpoint.
      const samplesByInvoice = new Map<string, any[]>();
      samples.forEach((sample: any) => {
        const invoiceKey = key(sample.invoice);
        samplesByInvoice.set(invoiceKey, [...(samplesByInvoice.get(invoiceKey) || []), sample]);
      });

      const resultsBySample = new Map<string, any>();
      results.forEach((result: any) => resultsBySample.set(key(result.sample), result));

      const paymentsByInvoice = new Map<string, any[]>();
      payments.forEach((payment: any) => {
        const invoiceKey = key(payment.invoice);
        paymentsByInvoice.set(invoiceKey, [...(paymentsByInvoice.get(invoiceKey) || []), payment]);
      });

      /** A report is collectable once the pathologist has released it. */
      const RELEASED = ['Approved', 'Final'];

      const visits = invoices.map((invoice: any) => {
        const invoiceKey = key(invoice._id);
        const visitSamples = samplesByInvoice.get(invoiceKey) || [];

        const tests = visitSamples.map((sample: any) => {
          const result = resultsBySample.get(key(sample._id));
          return {
            sampleId: sample.sampleId,
            barcode: sample.barcode,
            testName: sample.testName,
            sampleStatus: sample.status,
            resultId: result?.resultId || '',
            resultStatus: result?.status || '',
            reportReady: RELEASED.includes(result?.status),
          };
        });

        return {
          invoiceId: invoice._id,
          invoiceNumber: invoice.invoiceNumber,
          date: invoice.createdAt,
          doctorName: invoice.referringDoctorName || invoice.referringDoctor?.doctorName || '',
          netAmount: invoice.netAmount,
          paidAmount: invoice.paidAmount,
          dueAmount: invoice.dueAmount,
          paymentStatus: invoice.paymentStatus,
          testCount: tests.length || (invoice.items?.length ?? 0),
          tests,
          reportsReady: tests.filter((t: any) => t.reportReady).length,
          payments: (paymentsByInvoice.get(invoiceKey) || []).map((payment: any) => ({
            receiptNumber: payment.receiptNumber,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            transactionRef: payment.transactionRef,
            date: payment.createdAt,
          })),
        };
      });

      const totalBilled = invoices.reduce((sum: number, i: any) => sum + (i.netAmount || 0), 0);
      const totalPaid = invoices.reduce((sum: number, i: any) => sum + (i.paidAmount || 0), 0);
      const outstanding = invoices.reduce((sum: number, i: any) => sum + (i.dueAmount || 0), 0);

      sendResponse({
        res,
        statusCode: HTTP_STATUS.OK,
        message: 'Patient history retrieved',
        data: {
          patient,
          summary: {
            visits: invoices.length,
            tests: samples.length,
            totalBilled,
            totalPaid,
            outstanding,
            reportsReady: results.filter((r: any) => RELEASED.includes(r.status)).length,
            // Invoices come back newest first, so the tail is the first visit.
            firstVisit: invoices.length ? (invoices[invoices.length - 1] as any).createdAt : null,
            lastVisit: invoices.length ? (invoices[0] as any).createdAt : null,
          },
          visits,
          payments: payments.map((payment: any) => ({
            receiptNumber: payment.receiptNumber,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
            transactionRef: payment.transactionRef,
            date: payment.createdAt,
            receivedBy: payment.receivedBy?.name || '',
          })),
          appointments: appointments.map((appointment: any) => ({
            appointmentId: appointment.appointmentId,
            date: appointment.date,
            time: appointment.time,
            collectionType: appointment.collectionType,
            status: appointment.status,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  static create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const uhid = await getNextUhid();
      const patient = await Patient.create({ ...req.body, uhid });
      sendResponse({ res, statusCode: HTTP_STATUS.CREATED, message: `Patient ${patient.patientName} registered`, data: patient });
    } catch (error) {
      next(error);
    }
  };

  static update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const patient = await Patient.findByIdAndUpdate(id, req.body, { new: true });
      if (!patient) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Patient not found');
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Patient updated', data: patient });
    } catch (error) {
      next(error);
    }
  };

  static toggleStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const patient = await Patient.findById(id);
      if (!patient) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Patient not found');
      patient.status = patient.status === 'Active' ? 'Inactive' : 'Active';
      await patient.save();
      sendResponse({ res, statusCode: HTTP_STATUS.OK, message: 'Status updated', data: patient });
    } catch (error) {
      next(error);
    }
  };
}

