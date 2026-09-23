"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountsService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const invoice_model_1 = require("../models/invoice.model");
const payment_model_1 = require("../models/payment.model");
const refund_model_1 = require("../models/refund.model");
const expense_model_1 = require("../models/expense.model");
const doctor_model_1 = require("../models/doctor.model");
const patient_model_1 = require("../models/patient.model");
const counter_model_1 = require("../models/counter.model");
const api_error_util_1 = require("../utils/api-error.util");
const messages_1 = require("../constants/messages");
const permissions_1 = require("../constants/permissions");
const payment_methods_1 = require("../constants/payment-methods");
/** Inclusive day window for a date filter, defaulting to the current month. */
const dateWindow = (from, to) => {
    const now = new Date();
    const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
};
class AccountsService {
    static async getDailyCollections(dateStr) {
        const targetDate = dateStr ? new Date(dateStr) : new Date();
        const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
        const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
        const payments = await payment_model_1.Payment.find({
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
        const breakdown = Object.fromEntries(payment_methods_1.METHOD_FIELDS.map((field) => [field, 0]));
        payments.forEach((p) => {
            const field = payment_methods_1.METHOD_FIELD[p.paymentMethod];
            if (field)
                breakdown[field] += p.amount;
        });
        const total = payment_methods_1.METHOD_FIELDS.reduce((sum, field) => sum + breakdown[field], 0);
        // Cash out on the same day, so the drawer can be reconciled against the
        // collections rather than against the collections alone.
        const paidOutToday = await expense_model_1.Payout.aggregate([
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
            payment_model_1.Payment.aggregate([
                {
                    $group: {
                        _id: '$paymentMethod',
                        amount: { $sum: '$amount' },
                        receipts: { $sum: 1 },
                    },
                },
            ]),
            invoice_model_1.Invoice.aggregate([
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
            refund_model_1.Refund.aggregate([{ $group: { _id: null, total: { $sum: '$refundAmount' }, count: { $sum: 1 } } }]),
            expense_model_1.Payout.aggregate([
                { $match: { status: 'Paid' } },
                { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
            // When the centre took its first payment, so the figure above can be
            // read as "since <date>" rather than as a number without a period.
            payment_model_1.Payment.findOne().sort({ createdAt: 1 }).select('createdAt'),
        ]);
        // One entry per method on the shared list, including the methods nobody
        // has ever used - a zero against Cheque is information when you are
        // reading what the centre actually takes money by.
        const byMethod = Object.fromEntries(payment_methods_1.METHOD_FIELDS.map((field) => [field, 0]));
        let collected = 0;
        let receipts = 0;
        for (const row of collections) {
            const field = payment_methods_1.METHOD_FIELD[row._id];
            if (field)
                byMethod[field] += row.amount || 0;
            collected += row.amount || 0;
            receipts += row.receipts || 0;
        }
        const bills = billing[0] || {};
        const refunded = refunds[0]?.total || 0;
        const paidOut = payouts[0]?.total || 0;
        return {
            since: firstReceipt?.createdAt || null,
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
    static async getCollectionTrend(query = {}) {
        const requestedDays = Math.min(92, Math.max(1, Number(query.days) || 7));
        const end = query.to ? new Date(query.to) : new Date();
        end.setHours(23, 59, 59, 999);
        const start = query.from ? new Date(query.from) : new Date(end);
        if (!query.from)
            start.setDate(start.getDate() - (requestedDays - 1));
        start.setHours(0, 0, 0, 0);
        // A local calendar date - not toISOString, which would roll an evening
        // collection into tomorrow for any lab east of Greenwich.
        const dayKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const [payments, payouts] = await Promise.all([
            payment_model_1.Payment.find({ createdAt: { $gte: start, $lte: end } }).select('amount paymentMethod createdAt'),
            expense_model_1.Payout.find({ status: 'Paid', expenseDate: { $gte: start, $lte: end } }).select('amount expenseDate'),
        ]);
        // The per-method fields come off the shared list, so a method added there
        // appears on every day of the trend without this shape being edited too.
        const blank = () => ({
            date: '',
            total: 0,
            ...Object.fromEntries(payment_methods_1.METHOD_FIELDS.map((f) => [f, 0])),
            count: 0,
            paidOut: 0,
            netInHand: 0,
        });
        const byDay = new Map();
        for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
            const key = dayKey(cursor);
            byDay.set(key, { ...blank(), date: key });
        }
        const bucketFor = (date) => {
            const key = dayKey(date);
            let bucket = byDay.get(key);
            if (!bucket) {
                bucket = { ...blank(), date: key };
                byDay.set(key, bucket);
            }
            return bucket;
        };
        payments.forEach((payment) => {
            const bucket = bucketFor(new Date(payment.createdAt));
            const amount = Number(payment.amount) || 0;
            const field = payment_methods_1.METHOD_FIELD[payment.paymentMethod];
            if (field)
                bucket[field] += amount;
            bucket.total += amount;
            bucket.count += 1;
        });
        payouts.forEach((payout) => {
            bucketFor(new Date(payout.expenseDate)).paidOut += Number(payout.amount) || 0;
        });
        const days = [...byDay.values()]
            .map((day) => ({ ...day, netInHand: day.total - day.paidOut }))
            .sort((a, b) => (a.date < b.date ? 1 : -1));
        const sum = (pick) => days.reduce((acc, d) => acc + pick(d), 0);
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
                ...Object.fromEntries(payment_methods_1.METHOD_FIELDS.map((field) => [field, sum((d) => d[field] || 0)])),
                // Averaged over the days money actually came in, so a week containing
                // a closed Sunday is not reported as a bad week.
                averagePerActiveDay: daysWithCollection ? Math.round(collectedTotal / daysWithCollection) : 0,
            },
        };
    }
    static async createRefund(payload, currentUser) {
        const activeUser = currentUser ||
            payload.user || { userId: new mongoose_1.default.Types.ObjectId().toString(), name: 'Admin Staff', role: 'Admin' };
        const role = activeUser.role || 'Admin';
        if (!(0, permissions_1.can)(role, permissions_1.PERMISSIONS.REFUND_ISSUE)) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Only authorized accounting personnel can issue refunds');
        }
        const { invoiceId, refundAmount, reason, paymentMethod, remarks = '' } = payload;
        const invoice = await invoice_model_1.Invoice.findById(invoiceId);
        if (!invoice) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Invoice not found');
        }
        if (refundAmount <= 0) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Refund amount must be greater than zero');
        }
        if (refundAmount > invoice.paidAmount) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, `Refund amount (Rs.${refundAmount}) exceeds invoice paid total (Rs.${invoice.paidAmount})`);
        }
        const refundId = await (0, counter_model_1.getNextRefundId)();
        const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
        const userId = mongoose_1.default.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose_1.default.Types.ObjectId();
        const refundDoc = await refund_model_1.Refund.create({
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
        }
        else {
            invoice.paymentStatus = 'Partial';
        }
        await invoice.save();
        return refundDoc;
    }
    static async getAllRefunds(query) {
        const { page = 1, limit = 10 } = query;
        const skip = (Number(page) - 1) * Number(limit);
        const [refunds, total] = await Promise.all([
            refund_model_1.Refund.find({})
                .populate('patient', 'patientName uhid mobile')
                .populate('invoice', 'invoiceNumber barcode')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            refund_model_1.Refund.countDocuments({}),
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
    static async createPayout(payload, currentUser) {
        const activeUser = currentUser || payload.user || { userId: '', name: 'Admin Staff', role: 'Admin' };
        const role = activeUser.role || 'Admin';
        if (!(0, permissions_1.can)(role, permissions_1.PERMISSIONS.PAYOUT_CREATE)) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Your role is not permitted to record payouts');
        }
        if (!payload.amount || payload.amount <= 0) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Payout amount must be greater than zero');
        }
        const canSelfApprove = (0, permissions_1.can)(role, permissions_1.PERMISSIONS.PAYOUT_APPROVE);
        const needsApproval = !canSelfApprove && payload.amount > permissions_1.SELF_APPROVE_PAYOUT_LIMIT;
        const status = needsApproval ? 'Pending' : 'Paid';
        const expenseId = await (0, counter_model_1.getNextExpenseId)();
        const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
        const userId = mongoose_1.default.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose_1.default.Types.ObjectId();
        const payout = await expense_model_1.Payout.create({
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
    static async getAllPayouts(query) {
        const { payeeType, payeeName, status, from, to, page = 1, limit = 20 } = query;
        const filter = {};
        if (payeeType)
            filter.payeeType = payeeType;
        if (status)
            filter.status = status;
        if (payeeName)
            filter.payeeName = { $regex: payeeName, $options: 'i' };
        if (from || to) {
            const { start, end } = dateWindow(from, to);
            filter.expenseDate = { $gte: start, $lte: end };
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [payouts, total] = await Promise.all([
            expense_model_1.Payout.find(filter)
                .populate('patient', 'patientName uhid mobile')
                .populate('invoice', 'invoiceNumber netAmount')
                .populate('doctor', 'doctorName')
                .sort({ expenseDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            expense_model_1.Payout.countDocuments(filter),
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
    static async getPayoutSummary(query) {
        const { start, end } = dateWindow(query.from, query.to);
        const window = { expenseDate: { $gte: start, $lte: end } };
        const settled = { ...window, status: 'Paid' };
        const [byType, byPayee, byDay, statusTotals, pending] = await Promise.all([
            expense_model_1.Payout.aggregate([
                { $match: settled },
                { $group: { _id: '$payeeType', total: { $sum: '$amount' }, count: { $sum: 1 } } },
                { $sort: { total: -1 } },
            ]),
            expense_model_1.Payout.aggregate([
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
            expense_model_1.Payout.aggregate([
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
            expense_model_1.Payout.aggregate([
                { $match: window },
                { $group: { _id: '$status', total: { $sum: '$amount' }, count: { $sum: 1 } } },
            ]),
            expense_model_1.Payout.find({ status: 'Pending' }).sort({ createdAt: -1 }).limit(50),
        ]);
        const statusMap = {};
        statusTotals.forEach((row) => {
            statusMap[row._id] = { total: row.total, count: row.count };
        });
        return {
            period: { from: start.toISOString().split('T')[0], to: end.toISOString().split('T')[0] },
            totalPaid: statusMap.Paid?.total || 0,
            paidCount: statusMap.Paid?.count || 0,
            totalPending: statusMap.Pending?.total || 0,
            pendingCount: statusMap.Pending?.count || 0,
            byType: byType.map((row) => ({ payeeType: row._id, total: row.total, count: row.count })),
            byPayee: byPayee.map((row) => ({
                payeeName: row._id.payeeName,
                payeeType: row._id.payeeType,
                total: row.total,
                count: row.count,
                lastPaidAt: row.lastPaidAt,
            })),
            byDay: byDay.map((row) => ({ date: row._id, total: row.total, count: row.count })),
            pendingApprovals: pending,
        };
    }
    /** Admin sign-off on a parked payout, or a rejection with a stated reason. */
    static async updatePayoutStatus(id, payload, currentUser) {
        if (!(0, permissions_1.can)(currentUser?.role, permissions_1.PERMISSIONS.PAYOUT_APPROVE)) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Only an Admin can approve or reject a payout');
        }
        const payout = await expense_model_1.Payout.findById(id);
        if (!payout) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Payout record not found');
        }
        if (payout.status !== 'Pending') {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, `This payout is already marked ${payout.status}`);
        }
        if (payload.status === 'Rejected' && !payload.rejectionReason) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'A reason is required to reject a payout');
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
    static async deletePayout(id, currentUser) {
        if (!(0, permissions_1.can)(currentUser?.role, permissions_1.PERMISSIONS.PAYOUT_DELETE)) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Only an Admin can delete a payout record');
        }
        const payout = await expense_model_1.Payout.findByIdAndDelete(id);
        if (!payout) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Payout record not found');
        }
        return payout;
    }
    /**
     * Commission earned per referring doctor, reconciled against what has
     * actually been paid out to them from the payout ledger - the figures are
     * read off real records rather than assumed.
     */
    static async getDoctorCommissionReport() {
        const doctors = await doctor_model_1.Doctor.find({ status: 'Active' }).populate('department');
        const paidByDoctor = await expense_model_1.Payout.aggregate([
            { $match: { payeeType: 'Doctor Referral', status: 'Paid', doctor: { $ne: null } } },
            { $group: { _id: '$doctor', paid: { $sum: '$amount' } } },
        ]);
        const paidMap = new Map(paidByDoctor.map((row) => [String(row._id), row.paid]));
        const report = await Promise.all(doctors.map(async (doc) => {
            const invoices = await invoice_model_1.Invoice.find({ referringDoctor: doc._id, status: { $ne: 'Cancelled' } });
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
        }));
        return report;
    }
    /**
     * Patient Payment Ledger & Centre Cash Flow report.
     * Merges patient collections (inflow) and payouts/refunds (outflow) with
     * comprehensive filters by patient, date, payment method, and payee type.
     */
    static async getLedger(query) {
        const { patientId, search, from, to, paymentMethod, flowType, payeeType, page = 1, limit = 50 } = query;
        let dateFilter = null;
        if (from || to) {
            const { start, end } = dateWindow(from, to);
            dateFilter = { $gte: start, $lte: end };
        }
        // 1. Fetch patient profile & invoices if patientId is provided
        let patientData = null;
        let patientInvoices = [];
        let patientSummary = {
            totalVisits: 0,
            totalBilled: 0,
            totalPaid: 0,
            totalRefunded: 0,
            balanceDue: 0,
        };
        if (patientId) {
            patientData = await patient_model_1.Patient.findById(patientId);
            if (patientData) {
                patientInvoices = await invoice_model_1.Invoice.find({ patient: patientId })
                    .populate('referringDoctor', 'doctorName')
                    .sort({ createdAt: -1 });
                const [patientPayments, patientRefunds, patientPayoutRefunds] = await Promise.all([
                    payment_model_1.Payment.find({ patient: patientId }),
                    refund_model_1.Refund.find({ patient: patientId }),
                    expense_model_1.Payout.find({ patient: patientId, payeeType: 'Patient Refund', status: 'Paid' }),
                ]);
                const totalBilled = patientInvoices.reduce((sum, inv) => sum + (inv.netAmount || 0), 0);
                const totalPaid = patientPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
                const totalRefunded = patientRefunds.reduce((sum, r) => sum + (r.refundAmount || 0), 0) +
                    patientPayoutRefunds.reduce((sum, p) => sum + (p.amount || 0), 0);
                const balanceDue = patientInvoices.reduce((sum, inv) => sum + (inv.dueAmount || 0), 0);
                patientSummary = {
                    totalVisits: patientInvoices.length,
                    totalBilled,
                    totalPaid,
                    totalRefunded,
                    balanceDue,
                };
            }
        }
        // 2. Query Collections (Inflow - Payments)
        let paymentTransactions = [];
        if (flowType !== 'payout' &&
            flowType !== 'refund' &&
            (!payeeType || payeeType === 'All' || payeeType === 'Patient')) {
            const paymentQuery = {};
            if (patientId)
                paymentQuery.patient = patientId;
            if (dateFilter)
                paymentQuery.createdAt = dateFilter;
            if (paymentMethod && paymentMethod !== 'All')
                paymentQuery.paymentMethod = paymentMethod;
            const payments = await payment_model_1.Payment.find(paymentQuery)
                .populate('patient', 'patientName uhid mobile age gender address')
                .populate('invoice', 'invoiceNumber netAmount dueAmount')
                .sort({ createdAt: -1 })
                .limit(500);
            paymentTransactions = payments.map((p) => ({
                id: p._id,
                date: p.createdAt,
                flow: 'INFLOW',
                type: 'Patient Collection',
                receiptNumber: p.receiptNumber,
                invoiceNumber: p.invoice?.invoiceNumber || '-',
                invoiceId: p.invoice?._id || p.invoice,
                patientId: p.patient?._id,
                partyName: p.patient?.patientName || 'Patient',
                partyUhid: p.patient?.uhid || '',
                partyMobile: p.patient?.mobile || '',
                paymentMethod: p.paymentMethod,
                amount: p.amount,
                transactionRef: p.transactionRef || '',
                notes: p.notes || '',
                handledBy: p.receivedBy?.name || '',
            }));
        }
        // 3. Query Outflows (Payouts & Patient Refunds)
        let outflowTransactions = [];
        if (flowType !== 'collection') {
            // 3a. Patient Refunds (From Refund collection)
            let refundTransactions = [];
            const includePatientRefunds = !payeeType ||
                payeeType === 'All' ||
                payeeType === 'Patient Refund' ||
                payeeType === 'Patient';
            if (includePatientRefunds) {
                const refundQuery = {};
                if (patientId)
                    refundQuery.patient = patientId;
                if (dateFilter) {
                    refundQuery.$or = [{ date: dateFilter }, { createdAt: dateFilter }];
                }
                if (paymentMethod && paymentMethod !== 'All')
                    refundQuery.paymentMethod = paymentMethod;
                const refunds = await refund_model_1.Refund.find(refundQuery)
                    .populate('patient', 'patientName uhid mobile age gender address')
                    .populate('invoice', 'invoiceNumber netAmount dueAmount')
                    .sort({ date: -1, createdAt: -1 })
                    .limit(500);
                refundTransactions = refunds.map((r) => ({
                    id: r._id,
                    date: r.date || r.createdAt,
                    flow: 'OUTFLOW',
                    type: 'Patient Refund',
                    receiptNumber: r.refundId || '-',
                    invoiceNumber: r.invoice?.invoiceNumber || '-',
                    invoiceId: r.invoice?._id || r.invoice,
                    patientId: r.patient?._id,
                    partyName: r.patient?.patientName || 'Patient',
                    partyUhid: r.patient?.uhid || '',
                    partyMobile: r.patient?.mobile || '',
                    paymentMethod: r.paymentMethod,
                    amount: r.refundAmount,
                    transactionRef: r.refundId || '',
                    notes: r.reason ? `${r.reason}${r.remarks ? ` (${r.remarks})` : ''}` : (r.remarks || 'Patient Refund'),
                    handledBy: r.approvedBy?.name || '',
                }));
            }
            // 3b. Centre Payouts (From Payout / Expense collection)
            let payoutTransactions = [];
            // Note: If patientId is specified, only include payouts where payeeType is 'Patient Refund',
            // so centre expenses (ambulance, supplier, doctor cuts) don't pollute the patient's personal ledger bill.
            const includePayouts = flowType !== 'refund' &&
                payeeType !== 'Patient' &&
                (!patientId || !payeeType || payeeType === 'All' || payeeType === 'Patient Refund');
            if (includePayouts) {
                const payoutQuery = { status: 'Paid' };
                if (patientId) {
                    payoutQuery.patient = patientId;
                    payoutQuery.payeeType = 'Patient Refund';
                }
                if (dateFilter)
                    payoutQuery.expenseDate = dateFilter;
                if (paymentMethod && paymentMethod !== 'All')
                    payoutQuery.paymentMethod = paymentMethod;
                if (payeeType && payeeType !== 'All')
                    payoutQuery.payeeType = payeeType;
                const payouts = await expense_model_1.Payout.find(payoutQuery)
                    .populate('patient', 'patientName uhid mobile age gender address')
                    .populate('doctor', 'doctorName')
                    .populate('invoice', 'invoiceNumber netAmount')
                    .sort({ expenseDate: -1, createdAt: -1 })
                    .limit(500);
                payoutTransactions = payouts.map((p) => ({
                    id: p._id,
                    date: p.expenseDate || p.createdAt,
                    flow: 'OUTFLOW',
                    type: p.payeeType === 'Patient Refund' ? 'Patient Refund' : `Payout (${p.payeeType})`,
                    receiptNumber: p.expenseId || p.referenceNo || '-',
                    invoiceNumber: p.invoice?.invoiceNumber || '-',
                    invoiceId: p.invoice?._id || p.invoice,
                    patientId: p.patient?._id,
                    partyName: p.payeeType === 'Patient Refund'
                        ? p.patient?.patientName || p.payeeName || 'Patient'
                        : p.payeeName || 'Payee',
                    partyUhid: p.payeeType === 'Patient Refund' ? p.patient?.uhid || '' : '',
                    partyMobile: p.payeeType === 'Patient Refund'
                        ? p.patient?.mobile || p.payeeContact || ''
                        : p.payeeContact || '',
                    paymentMethod: p.paymentMethod,
                    amount: p.amount,
                    transactionRef: p.referenceNo || '',
                    notes: p.description || '',
                    handledBy: p.recordedBy?.name || '',
                }));
            }
            outflowTransactions = [...refundTransactions, ...payoutTransactions];
        }
        // 4. Group and sequence transactions for patients/parties
        // "same naam, no. ya uhid wale multiple times pay kr rhe h to unko sequence me rakho"
        const rawTransactions = [...paymentTransactions, ...outflowTransactions];
        const groupMap = new Map();
        rawTransactions.forEach((t) => {
            let key = '';
            if (t.type === 'Patient Collection' || t.type === 'Patient Refund') {
                const uhid = (t.partyUhid || '').trim().toLowerCase();
                const mobile = (t.partyMobile || '').trim();
                const name = (t.partyName || '').trim().toLowerCase();
                if (uhid)
                    key = `uhid_${uhid}`;
                else if (mobile && mobile.length >= 10)
                    key = `mob_${mobile}`;
                else if (name)
                    key = `name_${name}`;
                else
                    key = `txn_${t.id}`;
            }
            else {
                key = `payout_${(t.partyName || t.id).trim().toLowerCase()}`;
            }
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
            }
            groupMap.get(key).push(t);
        });
        const partyGroups = [];
        groupMap.forEach((items, key) => {
            // Sort transactions within this party in chronological sequence (oldest to newest: Payment #1, #2, #3, Refund)
            items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            const totalPayments = items.filter((x) => x.flow === 'INFLOW').length;
            let paymentIndex = 0;
            items.forEach((item, idx) => {
                if (item.flow === 'INFLOW') {
                    paymentIndex++;
                    item.sequenceNo = paymentIndex;
                    item.totalPartyPayments = totalPayments;
                }
                else {
                    item.sequenceNo = idx + 1;
                }
                item.partyTransactionCount = items.length;
                item.partyGroupKey = key;
            });
            const latestDate = Math.max(...items.map((x) => new Date(x.date).getTime()));
            partyGroups.push({ key, latestDate, items });
        });
        // Sort party groups by their most recent activity descending
        partyGroups.sort((a, b) => b.latestDate - a.latestDate);
        // Flatten into allTransactions with each party's payments kept together in sequence
        let allTransactions = partyGroups.flatMap((g) => g.items);
        // Apply search filter if provided
        if (search && search.trim()) {
            const q = search.trim().toLowerCase();
            allTransactions = allTransactions.filter((t) => t.partyName?.toLowerCase().includes(q) ||
                t.partyUhid?.toLowerCase().includes(q) ||
                t.partyMobile?.includes(q) ||
                t.receiptNumber?.toLowerCase().includes(q) ||
                t.invoiceNumber?.toLowerCase().includes(q) ||
                t.transactionRef?.toLowerCase().includes(q) ||
                t.notes?.toLowerCase().includes(q));
        }
        // Totals
        const totalCollections = allTransactions
            .filter((t) => t.flow === 'INFLOW')
            .reduce((sum, t) => sum + t.amount, 0);
        const totalPayouts = allTransactions
            .filter((t) => t.flow === 'OUTFLOW')
            .reduce((sum, t) => sum + t.amount, 0);
        const netBalance = totalCollections - totalPayouts;
        // Pagination
        const totalCount = allTransactions.length;
        const skip = (Number(page) - 1) * Number(limit);
        const paginated = allTransactions.slice(skip, skip + Number(limit));
        return {
            summary: {
                totalCollections,
                totalPayouts,
                netBalance,
                totalCount,
                collectionCount: allTransactions.filter((t) => t.flow === 'INFLOW').length,
                payoutCount: allTransactions.filter((t) => t.flow === 'OUTFLOW').length,
            },
            patient: patientData,
            patientSummary: patientId ? patientSummary : undefined,
            invoices: patientInvoices,
            transactions: paginated,
            pagination: {
                total: totalCount,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(totalCount / Number(limit)),
            },
        };
    }
}
exports.AccountsService = AccountsService;
