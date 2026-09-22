import mongoose from 'mongoose';
import { Invoice } from '../models/invoice.model';
import { Payment } from '../models/payment.model';
import { Refund } from '../models/refund.model';
import { Payout } from '../models/expense.model';
import { Doctor } from '../models/doctor.model';
import { getNextRefundId, getNextExpenseId } from '../models/counter.model';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';
import { PERMISSIONS, can, SELF_APPROVE_PAYOUT_LIMIT } from '../constants/permissions';
import { PayeeType, PayoutMethod, PayoutStatus } from '../types/expense.interface';
import {
  METHOD_FIELD,
  METHOD_FIELDS,
  type CollectionMethod,
  type DisbursementMethod,
} from '../constants/payment-methods';

export interface CreateRefundPayload {
  invoiceId: string;
  refundAmount: number;
  reason: string;
  paymentMethod: DisbursementMethod;
  remarks?: string;
  user?: any;
}

export interface CreatePayoutPayload {
  payeeType: PayeeType;
  payeeName: string;
  payeeContact?: string;
  description: string;
  amount: number;
  paymentMethod: PayoutMethod;
  referenceNo?: string;
  expenseDate?: string;
  patientId?: string;
  invoiceId?: string;
  doctorId?: string;
  receiptUrl?: string;
  user?: any;
}

export interface PayoutQuery {
  payeeType?: string;
  payeeName?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** Inclusive day window for a date filter, defaulting to the current month. */
const dateWindow = (from?: string, to?: string) => {
  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
  start.setHours(0, 0, 0, 0);
  const end = to ? new Date(to) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export class AccountsService {
  static async getDailyCollections(dateStr?: string) {
    const targetDate = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    const payments = await Payment.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    }).populate('patient', 'patientName uhid');

    /**
     * Totalled off the shared method list rather than an if-else chain.
     *
     * The chain only knew five methods, so a receipt taken by any other one -
     * a cheque, or a payment booked against credit - fell through every branch
     * and vanished from both the breakdown and the day's total, while the
     * week's trend counted it. The two figures are read side by side on the
     * dashboard and disagreed by whatever those receipts came to.
     */
    const breakdown: Record<string, number> = Object.fromEntries(METHOD_FIELDS.map((field) => [field, 0]));

    payments.forEach((p) => {
      const field = METHOD_FIELD[p.paymentMethod as CollectionMethod];
      if (field) breakdown[field] += p.amount;
    });

    const total = METHOD_FIELDS.reduce((sum, field) => sum + breakdown[field], 0);

    // Cash out on the same day, so the drawer can be reconciled against the
    // collections rather than against the collections alone.
    const paidOutToday = await Payout.aggregate([
      { $match: { status: 'Paid', expenseDate: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalPaidOut = paidOutToday[0]?.total || 0;

    return {
      date: startOfDay.toISOString().split('T')[0],
      breakdown: { ...breakdown, total },
      totalPaidOut,
      netInHand: total - totalPaidOut,
      payments,
    };
  }

  /**
   * What came in, day by day.
   *
   * The daily figure alone answers "how much today" and nothing else - the
   * desk closing the drawer and the owner looking at the week both need to see
   * yesterday next to today. This returns one row per calendar day across the
   * window, including the days nothing was collected, so a quiet Sunday shows
   * as a zero rather than falling out of the list and making the week look
   * shorter than it was.
   *
   * Days are the server's calendar days, the same boundary the daily figure
   * uses, so the two always agree on what "today" means.
   */
  /**
   * Every rupee the centre has ever taken, with no window around it.
   *
   * The dashboard answers "how did today go" and "how did the week go", and
   * both are the wrong question when the owner wants to know what the place
   * has done since it opened - a figure nobody could get without exporting
   * the whole ledger and adding it up by hand. This is that figure, with the
   * pieces it is made of: what patients were billed, what they have paid and
   * by which method, what was handed back to them, and what is still owed.
   *
   * Payouts - the ambulance, the courier, a doctor's cut - are counted here
   * too, but they are the centre's own spending and not patient money, so
   * they are kept well away from the collection figure. Netting them off it
   * answered a question nobody asked and turned a centre with money in the
   * bank into one reading a negative balance.
   *
   * Counted in the database rather than by loading the receipts, so it stays
   * one round trip whether the centre is a month old or ten years old.
   */
  static async getOverallCollections() {
    const [collections, billing, refunds, payouts, firstReceipt] = await Promise.all([
      Payment.aggregate([
        {
          $group: {
            _id: '$paymentMethod',
            amount: { $sum: '$amount' },
            receipts: { $sum: 1 },
          },
        },
      ]),
      Invoice.aggregate([
        {
          $group: {
            _id: null,
            bills: { $sum: 1 },
            billed: { $sum: '$netAmount' },
            // The gap between gross and net - there is no `discountAmount` on
            // a bill, that field lives on its lines.
            discount: { $sum: { $subtract: ['$subtotal', '$netAmount'] } },
            due: { $sum: '$dueAmount' },
          },
        },
      ]),
      Refund.aggregate([{ $group: { _id: null, total: { $sum: '$refundAmount' }, count: { $sum: 1 } } }]),
      Payout.aggregate([
        { $match: { status: 'Paid' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      // When the centre took its first payment, so the figure above can be
      // read as "since <date>" rather than as a number without a period.
      Payment.findOne().sort({ createdAt: 1 }).select('createdAt'),
    ]);

    // One entry per method on the shared list, including the methods nobody
    // has ever used - a zero against Cheque is information when you are
    // reading what the centre actually takes money by.
    const byMethod: Record<string, number> = Object.fromEntries(METHOD_FIELDS.map((field) => [field, 0]));
    let collected = 0;
    let receipts = 0;

    for (const row of collections) {
      const field = METHOD_FIELD[row._id as CollectionMethod];
      if (field) byMethod[field] += row.amount || 0;
      collected += row.amount || 0;
      receipts += row.receipts || 0;
    }

    const bills = billing[0] || {};
    const refunded = refunds[0]?.total || 0;
    const paidOut = payouts[0]?.total || 0;

    return {
      since: (firstReceipt as any)?.createdAt || null,
      collected,
      receipts,
      byMethod,
      billed: bills.billed || 0,
      bills: bills.bills || 0,
      discount: bills.discount || 0,
      outstanding: bills.due || 0,
      refunded,
      refunds: refunds[0]?.count || 0,
      /**
       * What patients have actually paid the centre, net of what was handed
       * back to them. This is the collection figure - it has nothing taken
       * off it for the centre's own spending.
       */
      netFromPatients: collected - refunded,
      /** How much of everything billed has been collected, as a percentage. */
      collectionRate: bills.billed ? Math.round((collected / bills.billed) * 100) : 0,
      // Reported for completeness, and deliberately not netted off the
      // collection above - this is the centre spending, not patients paying.
      paidOut,
      payouts: payouts[0]?.count || 0,
      netInHand: collected - refunded - paidOut,
    };
  }

  static async getCollectionTrend(query: { from?: string; to?: string; days?: number | string } = {}) {
    const requestedDays = Math.min(92, Math.max(1, Number(query.days) || 7));

    const end = query.to ? new Date(query.to) : new Date();
    end.setHours(23, 59, 59, 999);

    const start = query.from ? new Date(query.from) : new Date(end);
    if (!query.from) start.setDate(start.getDate() - (requestedDays - 1));
    start.setHours(0, 0, 0, 0);

    // A local calendar date - not toISOString, which would roll an evening
    // collection into tomorrow for any lab east of Greenwich.
    const dayKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

    const [payments, payouts] = await Promise.all([
      Payment.find({ createdAt: { $gte: start, $lte: end } }).select('amount paymentMethod createdAt'),
      Payout.find({ status: 'Paid', expenseDate: { $gte: start, $lte: end } }).select('amount expenseDate'),
    ]);

    // The per-method fields come off the shared list, so a method added there
    // appears on every day of the trend without this shape being edited too.
    const blank = () => ({
      date: '',
      total: 0,
      ...(Object.fromEntries(METHOD_FIELDS.map((f) => [f, 0])) as Record<string, number>),
      count: 0,
      paidOut: 0,
      netInHand: 0,
    });

    const byDay = new Map<string, ReturnType<typeof blank>>();
    for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const key = dayKey(cursor);
      byDay.set(key, { ...blank(), date: key });
    }

    const bucketFor = (date: Date) => {
      const key = dayKey(date);
      let bucket = byDay.get(key);
      if (!bucket) {
        bucket = { ...blank(), date: key };
        byDay.set(key, bucket);
      }
      return bucket;
    };

    payments.forEach((payment) => {
      const bucket = bucketFor(new Date((payment as any).createdAt));
      const amount = Number(payment.amount) || 0;
      const field = METHOD_FIELD[payment.paymentMethod as CollectionMethod];
      if (field) (bucket as Record<string, any>)[field] += amount;
      bucket.total += amount;
      bucket.count += 1;
    });

    payouts.forEach((payout: any) => {
      bucketFor(new Date(payout.expenseDate)).paidOut += Number(payout.amount) || 0;
    });

    const days = [...byDay.values()]
      .map((day) => ({ ...day, netInHand: day.total - day.paidOut }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    const sum = (pick: (d: (typeof days)[number]) => number) => days.reduce((acc, d) => acc + pick(d), 0);
    const collectedTotal = sum((d) => d.total);
    const paidOutTotal = sum((d) => d.paidOut);
    const daysWithCollection = days.filter((d) => d.total > 0).length;

    return {
      from: dayKey(start),
      to: dayKey(end),
      days,
      totals: {
        collected: collectedTotal,
        paidOut: paidOutTotal,
        netInHand: collectedTotal - paidOutTotal,
        receipts: sum((d) => d.count),
        // One entry per method on the shared list, so the totals cannot end up
        // reporting a different set of methods than the days above them do.
        ...(Object.fromEntries(
          METHOD_FIELDS.map((field) => [field, sum((d) => (d as Record<string, any>)[field] || 0)])
        ) as Record<string, number>),
        // Averaged over the days money actually came in, so a week containing
        // a closed Sunday is not reported as a bad week.
        averagePerActiveDay: daysWithCollection ? Math.round(collectedTotal / daysWithCollection) : 0,
      },
    };
  }

  static async createRefund(payload: CreateRefundPayload, currentUser?: JwtPayload) {
    const activeUser = currentUser ||
      payload.user || { userId: new mongoose.Types.ObjectId().toString(), name: 'Admin Staff', role: 'Admin' };
    const role = activeUser.role || 'Admin';

    if (!can(role, PERMISSIONS.REFUND_ISSUE)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only authorized accounting personnel can issue refunds');
    }

    const { invoiceId, refundAmount, reason, paymentMethod, remarks = '' } = payload;
    const invoice = await Invoice.findById(invoiceId);

    if (!invoice) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Invoice not found');
    }

    if (refundAmount <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Refund amount must be greater than zero');
    }

    if (refundAmount > invoice.paidAmount) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `Refund amount (Rs.${refundAmount}) exceeds invoice paid total (Rs.${invoice.paidAmount})`
      );
    }

    const refundId = await getNextRefundId();
    const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
    const userId = mongoose.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose.Types.ObjectId();

    const refundDoc = await Refund.create({
      refundId,
      invoice: invoice._id,
      patient: invoice.patient,
      originalAmount: invoice.paidAmount,
      refundAmount,
      reason,
      paymentMethod,
      approvedBy: {
        userId,
        name: activeUser.name,
        role: activeUser.role,
      },
      date: new Date(),
      remarks,
    });

    invoice.paidAmount = Math.max(0, invoice.paidAmount - refundAmount);
    invoice.dueAmount = Math.max(0, invoice.netAmount - invoice.paidAmount);

    if (invoice.paidAmount === 0) {
      invoice.paymentStatus = 'Unpaid';
    } else {
      invoice.paymentStatus = 'Partial';
    }

    await invoice.save();
    return refundDoc;
  }

  static async getAllRefunds(query: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const [refunds, total] = await Promise.all([
      Refund.find({})
        .populate('patient', 'patientName uhid mobile')
        .populate('invoice', 'invoiceNumber barcode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Refund.countDocuments({}),
    ]);

    return {
      refunds,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * Files one outgoing payment - the ambulance fare, the courier, a referring
   * doctor's cut. Staff without approval rights may settle petty cash on the
   * spot, but anything above the limit is parked as Pending for the Admin
   * rather than leaving the drawer unrecorded.
   */
  static async createPayout(payload: CreatePayoutPayload, currentUser?: JwtPayload) {
    const activeUser = currentUser || payload.user || { userId: '', name: 'Admin Staff', role: 'Admin' };
    const role = activeUser.role || 'Admin';

    if (!can(role, PERMISSIONS.PAYOUT_CREATE)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Your role is not permitted to record payouts');
    }

    if (!payload.amount || payload.amount <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Payout amount must be greater than zero');
    }

    const canSelfApprove = can(role, PERMISSIONS.PAYOUT_APPROVE);
    const needsApproval = !canSelfApprove && payload.amount > SELF_APPROVE_PAYOUT_LIMIT;
    const status: PayoutStatus = needsApproval ? 'Pending' : 'Paid';

    const expenseId = await getNextExpenseId();
    const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
    const userId = mongoose.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose.Types.ObjectId();

    const payout = await Payout.create({
      expenseId,
      payeeType: payload.payeeType,
      payeeName: payload.payeeName,
      payeeContact: payload.payeeContact || '',
      category: payload.payeeType,
      description: payload.description,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod,
      referenceNo: payload.referenceNo || '',
      expenseDate: payload.expenseDate ? new Date(payload.expenseDate) : new Date(),
      status,
      needsApproval,
      patient: payload.patientId || undefined,
      invoice: payload.invoiceId || undefined,
      doctor: payload.doctorId || undefined,
      recordedBy: {
        userId,
        name: activeUser.name,
        role,
      },
      approvedBy: needsApproval ? undefined : { userId, name: activeUser.name, role, at: new Date() },
      receiptUrl: payload.receiptUrl || '',
    });

    return payout;
  }

  static async getAllPayouts(query: PayoutQuery) {
    const { payeeType, payeeName, status, from, to, page = 1, limit = 20 } = query;
    const filter: any = {};

    if (payeeType) filter.payeeType = payeeType;
    if (status) filter.status = status;
    if (payeeName) filter.payeeName = { $regex: payeeName, $options: 'i' };
    if (from || to) {
      const { start, end } = dateWindow(from, to);
      filter.expenseDate = { $gte: start, $lte: end };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [payouts, total] = await Promise.all([
      Payout.find(filter)
        .populate('patient', 'patientName uhid mobile')
        .populate('invoice', 'invoiceNumber netAmount')
        .populate('doctor', 'doctorName')
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payout.countDocuments(filter),
    ]);

    return {
      payouts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  /**
   * "How much are we paying out" in a single call: the period total plus the
   * same money sliced by payee type, by individual payee and by day - so the
   * ambulance line can be read as Rs.4,200 across nine runs this month.
   */
  static async getPayoutSummary(query: { from?: string; to?: string }) {
    const { start, end } = dateWindow(query.from, query.to);
    const window = { expenseDate: { $gte: start, $lte: end } };
    const settled = { ...window, status: 'Paid' };

    const [byType, byPayee, byDay, statusTotals, pending] = await Promise.all([
      Payout.aggregate([
        { $match: settled },
        { $group: { _id: '$payeeType', total: { $sum: '$amount' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      Payout.aggregate([
        { $match: settled },
        {
          $group: {
            _id: { payeeName: '$payeeName', payeeType: '$payeeType' },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            lastPaidAt: { $max: '$expenseDate' },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 25 },
      ]),
      Payout.aggregate([
        { $match: settled },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$expenseDate' } },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Payout.aggregate([
        { $match: window },
        { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payout.find({ status: 'Pending' }).sort({ createdAt: -1 }).limit(50),
    ]);

    const statusMap: Record<string, { total: number; count: number }> = {};
    statusTotals.forEach((row: any) => {
      statusMap[row._id] = { total: row.total, count: row.count };
    });

    return {
      period: { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] },
      totalPaid: statusMap.Paid?.total || 0,
      paidCount: statusMap.Paid?.count || 0,
      totalPending: statusMap.Pending?.total || 0,
      pendingCount: statusMap.Pending?.count || 0,
      byType: byType.map((row: any) => ({ payeeType: row._id, total: row.total, count: row.count })),
      byPayee: byPayee.map((row: any) => ({
        payeeName: row._id.payeeName,
        payeeType: row._id.payeeType,
        total: row.total,
        count: row.count,
        lastPaidAt: row.lastPaidAt,
      })),
      byDay: byDay.map((row: any) => ({ date: row._id, total: row.total, count: row.count })),
      pendingApprovals: pending,
    };
  }

  /** Admin sign-off on a parked payout, or a rejection with a stated reason. */
  static async updatePayoutStatus(
    id: string,
    payload: { status: 'Paid' | 'Rejected'; rejectionReason?: string },
    currentUser: JwtPayload
  ) {
    if (!can(currentUser?.role, PERMISSIONS.PAYOUT_APPROVE)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only an Admin can approve or reject a payout');
    }

    const payout = await Payout.findById(id);
    if (!payout) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Payout record not found');
    }

    if (payout.status !== 'Pending') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, `This payout is already marked ${payout.status}`);
    }

    if (payload.status === 'Rejected' && !payload.rejectionReason) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'A reason is required to reject a payout');
    }

    payout.status = payload.status;
    payout.needsApproval = false;
    payout.rejectionReason = payload.rejectionReason || '';
    payout.approvedBy = {
      userId: currentUser.userId,
      name: currentUser.name,
      role: currentUser.role,
      at: new Date(),
    };

    await payout.save();
    return payout;
  }

  static async deletePayout(id: string, currentUser: JwtPayload) {
    if (!can(currentUser?.role, PERMISSIONS.PAYOUT_DELETE)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Only an Admin can delete a payout record');
    }

    const payout = await Payout.findByIdAndDelete(id);
    if (!payout) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Payout record not found');
    }
    return payout;
  }

  /**
   * Commission earned per referring doctor, reconciled against what has
   * actually been paid out to them from the payout ledger - the figures are
   * read off real records rather than assumed.
   */
  static async getDoctorCommissionReport() {
    const doctors = await Doctor.find({ status: 'Active' }).populate('department');

    const paidByDoctor = await Payout.aggregate([
      { $match: { payeeType: 'Doctor Referral', status: 'Paid', doctor: { $ne: null } } },
      { $group: { _id: '$doctor', paid: { $sum: '$amount' } } },
    ]);

    const paidMap = new Map<string, number>(
      paidByDoctor.map((row: any) => [String(row._id), row.paid])
    );

    const report = await Promise.all(
      doctors.map(async (doc) => {
        const invoices = await Invoice.find({ referringDoctor: doc._id, status: { $ne: 'Cancelled' } });

        let totalReferredTests = 0;
        let totalRevenue = 0;

        invoices.forEach((inv) => {
          totalReferredTests += inv.items.length;
          totalRevenue += inv.netAmount;
        });

        const commissionRate = doc.commission || 0;
        const commissionEarned = Math.round((totalRevenue * commissionRate) / 100);
        const commissionPaid = paidMap.get(String(doc._id)) || 0;

        return {
          doctorId: doc._id,
          doctorName: doc.doctorName,
          specialty: doc.specialty || 'General',
          hospital: doc.hospital || 'Direct',
          totalReferredTests,
          totalRevenue,
          commissionPercentage: commissionRate,
          commissionEarned,
          commissionPaid,
          commissionPending: Math.max(0, commissionEarned - commissionPaid),
        };
      })
    );

    return report;
  }
}
