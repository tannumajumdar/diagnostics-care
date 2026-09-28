import { prisma } from '../db/prisma';
import { repo, mongoSort } from '../db/repo';
import { isObjectId } from '../db/ids';
import { ResultService } from './result.service';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';

/** Text for a LIKE pattern, its own % and _ taken literally. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

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
    if (!isObjectId(resultId)) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid result id');

    let pdf: Buffer;
    let provisional = false;
    if (options.provisional) {
      ({ buffer: pdf, provisional } = await ResultService.generateCurrentReportPDF(resultId));
    } else {
      pdf = await ResultService.generatePDFReport(resultId);
    }

    const result: any = await repo.findById('result', resultId, {
      include: {
        patient: { select: { id: true, patientName: true, uhid: true, mobile: true } },
        invoice: { select: { id: true, invoiceNumber: true, enquiryNo: true } },
      },
    });
    if (!result) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Result not found');

    const patient = result.patient || {};
    const invoice = result.invoice || {};

    // Every test on the visit the report covers, not only the one it was opened from.
    const visitResults: any[] = invoice._id
      ? await prisma.result
          .findMany({
            where: { invoiceId: invoice._id },
            select: { id: true, test: { select: { id: true, testName: true } } },
            orderBy: { insertOrder: 'asc' },
          })
          .then((rows) => rows.map((r) => ({ _id: r.id, test: { _id: r.test.id, testName: r.test.testName } })))
      : [result];
    const tests = Array.from(
      new Set(visitResults.map((r) => (typeof r.test === 'object' ? r.test?.testName : '')).filter(Boolean))
    ) as string[];

    const fileName = `${safe(patient.patientName) || 'Patient'}_${safe(result.resultId) || 'Report'}${
      provisional ? '_Provisional' : ''
    }.pdf`;

    await prisma.savedReport.deleteMany({
      where: {
        status: 'Provisional',
        ...(invoice._id ? { invoiceId: invoice._id } : { resultId: result._id }),
      },
    });

    const saved = await repo.create('savedReport', {
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

    const { data: _file, ...meta } = saved;
    return meta;
  }

  static async list(query: { search?: string; from?: string; to?: string; page?: number; limit?: number }) {
    const { search, from, to, page = 1, limit = 20 } = query;
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const pageNumber = Math.max(Number(page) || 1, 1);

    const filter: any = {};
    if (search) {
      // Escaped, so the text is matched literally: a case-insensitive contains.
      const q = String(search);
      const rx = { contains: q, mode: 'insensitive' as const };
      // `tests` is a list; Mongo matched it when any entry did. Prisma has no
      // "contains" over the entries of a text array, so those ids are found first.
      const byTest = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "SavedReport"
        WHERE EXISTS (SELECT 1 FROM unnest(tests) AS t WHERE t ILIKE '%' || ${escapeLike(q)} || '%')`;
      filter.OR = [
        { patientName: rx },
        { uhid: rx },
        { mobile: rx },
        { invoiceNumber: rx },
        { enquiryNo: rx },
        { reportNo: rx },
        { status: rx },
        { id: { in: byTest.map((r) => r.id) } },
        { savedByName: rx },
      ];
    }
    if (from || to) {
      const range: any = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        if (!Number.isNaN(start.getTime())) range.gte = start;
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (!Number.isNaN(end.getTime())) range.lte = end;
      }
      if (Object.keys(range).length) filter.createdAt = range;
    }

    const [reports, total] = await Promise.all([
      repo.find('savedReport', {
        where: filter,
        orderBy: mongoSort('savedReport', { createdAt: -1 }),
        skip: (pageNumber - 1) * pageSize,
        take: pageSize,
      }),
      repo.count('savedReport', filter),
    ]);

    return {
      reports,
      pagination: { total, page: pageNumber, limit: pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  static async getFile(id: string) {
    if (!isObjectId(id)) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid saved report id');

    const report = await prisma.savedReport.findUnique({
      where: { id: id.toLowerCase() },
      select: { data: true, fileName: true },
    });
    if (!report) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Saved report not found');

    const raw: any = report.data;
    const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw?.buffer ?? raw);
    return { buffer, fileName: report.fileName };
  }
}
