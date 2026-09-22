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
const counter_model_1 = require("../models/counter.model");
const api_error_util_1 = require("../utils/api-error.util");
const messages_1 = require("../constants/messages");
const permissions_1 = require("../constants/permissions");
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
        let cash = 0, upi = 0, card = 0, bank = 0, online = 0;
        payments.forEach((p) => {
            if (p.paymentMethod === 'Cash')
                cash += p.amount;
            else if (p.paymentMethod === 'UPI')
                upi += p.amount;
            else if (p.paymentMethod === 'Card')
                card += p.amount;
            else if (p.paymentMethod === 'Bank Transfer')
                bank += p.amount;
            else if (p.paymentMethod === 'Online')
                online += p.amount;
        });
        const total = cash + upi + card + bank + online;
        // Cash out on the same day, so the drawer can be reconciled against the
        // collections rather than against the collections alone.
        const paidOutToday = await expense_model_1.Payout.aggregate([
            { $match: { status: 'Paid', expenseDate: { $gte: startOfDay, $lte: endOfDay } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const totalPaidOut = paidOutToday[0]?.total || 0;
        return {
            date: startOfDay.toISOString().split('T')[0],
            breakdown: { cash, upi, card, bank, online, total },
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
        const blank = () => ({
            date: '',
            total: 0,
            cash: 0,
            upi: 0,
            card: 0,
            bank: 0,
            online: 0,
            credit: 0,
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
        const METHOD_FIELD = {
            Cash: 'cash',
            UPI: 'upi',
            Card: 'card',
            'Bank Transfer': 'bank',
            Online: 'online',
            Credit: 'credit',
        };
        payments.forEach((payment) => {
            const bucket = bucketFor(new Date(payment.createdAt));
            const amount = Number(payment.amount) || 0;
            const field = METHOD_FIELD[payment.paymentMethod];
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
                cash: sum((d) => d.cash),
                upi: sum((d) => d.upi),
                card: sum((d) => d.card),
                bank: sum((d) => d.bank),
                online: sum((d) => d.online),
                credit: sum((d) => d.credit),
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
}
exports.AccountsService = AccountsService;
