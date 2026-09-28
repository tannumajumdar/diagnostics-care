import mongoose from 'mongoose';
import { SavedReport } from '../models/savedReport.model';
import { Result } from '../models/result.model';
import { ResultService } from './result.service';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

const safe = (s?: string) =>
  String(s || '')
    .trim()
    .replace(/[^\w.-]+/g, '_')
    .replace(/^_+|_+$/g, '');

export class SavedReportService {
  /**
   * Generates the visit's report PDF and files it. A released visit is filed
   * as the final report; with `provisional` allowed, a visit still awaiting the
   * pathologist is filed as a provisional copy of what has been saved so far.
   * Only the latest provisional copy of a visit is kept - an older one is
   * replaced by the next save, final or provisional.
   */
  static async saveFromResult(resultId: string, currentUser: JwtPayload, options: { provisional?: boolean } = {}) {
    if (!mongoose.isValidObjectId(resultId)) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid result id');

    let pdf: Buffer;
    let provisional = false;
    if (options.provisional) {
      ({ buffer: pdf, provisional } = await ResultService.generateCurrentReportPDF(resultId));
    } else {
      pdf = await ResultService.generatePDFReport(resultId);
    }

    const result: any = await Result.findById(resultId)
      .populate('patient', 'patientName uhid mobile')
      .populate('invoice', 'invoiceNumber enquiryNo')
      .lean();
    if (!result) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Result not found');

    const patient = result.patient || {};
    const invoice = result.invoice || {};

    // Every test on the visit the report covers, not only the one it was opened from.
    const visitResults: any[] = invoice._id
      ? await Result.find({ invoice: invoice._id }).populate('test', 'testName').select('test').lean()
      : [result];
    const tests = Array.from(
      new Set(visitResults.map((r) => (typeof r.test === 'object' ? r.test?.testName : '')).filter(Boolean))
    ) as string[];

    const fileName = `${safe(patient.patientName) || 'Patient'}_${safe(result.resultId) || 'Report'}${
      provisional ? '_Provisional' : ''
    }.pdf`;

    await SavedReport.deleteMany({
      status: 'Provisional',
      ...(invoice._id ? { invoice: invoice._id } : { result: result._id }),
    });

    const saved = await SavedReport.create({
      result: result._id,
      patient: patient._id,
      patientName: patient.patientName || '',
      uhid: result.uhid || patient.uhid || '',
      mobile: patient.mobile || '',
      invoice: invoice._id,
      invoiceNumber: invoice.invoiceNumber || '',
      enquiryNo: result.enquiryNo || invoice.enquiryNo || '',
      reportNo: result.resultId || '',
      status: provisional ? 'Provisional' : 'Final',
      tests,
      fileName,
      size: pdf.length,
      data: pdf,
      savedBy: { userId: String(currentUser?.userId || ''), name: currentUser?.name, role: currentUser?.role },
    });

    const { data: _file, ...meta } = saved.toObject();
    return meta;
  }

  static async list(query: { search?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const { search, from, to, page = 1, limit = 20 } = query;
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const pageNumber = Math.max(Number(page) || 1, 1);

    const filter: any = {};
    if (search) {
      const rx = { $regex: String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      filter.$or = [
        { patientName: rx },
        { uhid: rx },
        { mobile: rx },
        { invoiceNumber: rx },
        { enquiryNo: rx },
        { reportNo: rx },
        { status: rx },
        { tests: rx },
        { 'savedBy.name': rx },
      ];
    }
    if (from || to) {
      const range: any = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        if (!Number.isNaN(start.getTime())) range.$gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (!Number.isNaN(end.getTime())) range.$lte = end;
      }
      if (Object.keys(range).length) filter.createdAt = range;
    }

    const [reports, total] = await Promise.all([
      SavedReport.find(filter)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .lean(),
      SavedReport.countDocuments(filter),
    ]);

    return {
      reports,
      pagination: { total, page: pageNumber, limit: pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  static async getFile(id: string) {
    if (!mongoose.isValidObjectId(id)) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid saved report id');
    const report = await SavedReport.findById(id).select('+data fileName').lean();
    if (!report) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Saved report not found');
    // A lean read hands the bytes back as a BSON Binary, not a Buffer.
    const raw: any = report.data;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw?.buffer ?? raw);
    return { buffer, fileName: report.fileName };
  }
}
