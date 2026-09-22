"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const invoice_model_1 = require("../models/invoice.model");
const payment_model_1 = require("../models/payment.model");
const sample_model_1 = require("../models/sample.model");
const patient_model_1 = require("../models/patient.model");
const doctor_model_1 = require("../models/doctor.model");
const organization_model_1 = require("../models/organization.model");
const test_model_1 = require("../models/test.model");
const package_model_1 = require("../models/package.model");
const counter_model_1 = require("../models/counter.model");
const api_error_util_1 = require("../utils/api-error.util");
const messages_1 = require("../constants/messages");
const permissions_1 = require("../constants/permissions");
const counter_model_2 = require("../models/counter.model");
/**
 * Turns a test's turnaroundTime ("24 Hours", "45 Minutes", "3 Days") into a
 * concrete TAT deadline so the bench can flag overdue work.
 */
const computeExpectedAt = (turnaroundTime) => {
    const now = new Date();
    const match = String(turnaroundTime ?? '').match(/(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|week)/i);
    if (!match)
        return new Date(now.getTime() + 24 * 60 * 60 * 1000); // default 24h
    const amount = Number(match[1]);
    const unitMs = {
        minute: 60_000,
        min: 60_000,
        hour: 3_600_000,
        hr: 3_600_000,
        day: 86_400_000,
        week: 604_800_000,
    };
    return new Date(now.getTime() + amount * (unitMs[match[2].toLowerCase()] ?? 3_600_000));
};
class BillingService {
    /**
     * One front-desk intake. The receptionist takes the patient's details, what
     * they have come in for, the referring doctor and the tests, and this turns
     * all of it into a registered patient, a bill and a queued sample in a single
     * step - rather than the three separate screens the desk used to walk.
     *
     * A patient registered here is rolled back if the bill fails, so a half-made
     * visit cannot leave an orphan record the desk would re-create on retry.
     */
    static async createVisit(payload, currentUser) {
        const activeUser = currentUser || payload.user || { name: 'System Staff', role: 'Admin' };
        let patientId = payload.patientId;
        let createdPatientId = null;
        if (!patientId) {
            if (!payload.patient) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Select an existing patient or fill in the new patient details');
            }
            if (!(0, permissions_1.can)(activeUser.role, permissions_1.PERMISSIONS.PATIENT_CREATE)) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Your role is not permitted to register a new patient');
            }
            const uhid = await (0, counter_model_2.getNextUhid)();
            const details = payload.patient;
            const patient = await patient_model_1.Patient.create({
                ...details,
                uhid,
                dateOfBirth: details.dateOfBirth ? new Date(details.dateOfBirth) : undefined,
                referringDoctor: payload.doctorId || undefined,
                organization: payload.organizationId || undefined,
            });
            patientId = patient._id.toString();
            createdPatientId = patientId;
        }
        try {
            const result = await BillingService.createInvoice({ ...payload, patientId }, currentUser);
            const patient = await patient_model_1.Patient.findById(patientId);
            return {
                ...result,
                patient,
                isNewPatient: Boolean(createdPatientId),
            };
        }
        catch (error) {
            if (createdPatientId) {
                await patient_model_1.Patient.findByIdAndDelete(createdPatientId);
            }
            throw error;
        }
    }
    static async createInvoice(payload, currentUser) {
        const { patientId, doctorId, doctorName = '', organizationId, testIds, items: lineOverrides, discountType = 'Fixed', discountValue = 0, discountReason = '', paidAmount = 0, paymentMethod = 'Cash', chiefComplaint = '', clinicalNotes = '', priority = 'Routine', } = payload;
        const activeUser = currentUser || payload.user || { userId: new mongoose_1.default.Types.ObjectId().toString(), name: 'System Admin', role: 'Admin' };
        const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
        const userId = mongoose_1.default.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose_1.default.Types.ObjectId();
        const userName = activeUser.name || 'System Staff';
        // `items` is what the desk typed; `testIds` is the older shape. Either
        // way the same test twice on one bill is one line - a duplicate used to
        // fail the count check below with "one or more tests are invalid", which
        // told the desk nothing about what was actually wrong.
        const requestedLines = (lineOverrides?.length ? lineOverrides : (testIds || []).map((testId) => ({ testId }))).filter((line) => Boolean(line?.testId));
        const orderedLines = requestedLines.filter((line, index) => requestedLines.findIndex((other) => other.testId === line.testId) === index);
        if (!orderedLines.length) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'At least one lab test must be selected for billing');
        }
        const patient = await patient_model_1.Patient.findById(patientId);
        if (!patient) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Patient record not found');
        }
        let rateTier = 'rate';
        if (organizationId) {
            const org = await organization_model_1.Organization.findById(organizationId);
            if (org) {
                if (org.contractRate === 'Corporate')
                    rateTier = 'corporateRate';
                else if (org.contractRate === 'Discounted')
                    rateTier = 'doctorRate';
            }
        }
        else if (doctorId) {
            rateTier = 'doctorRate';
        }
        const orderedIds = orderedLines.map((line) => line.testId);
        const found = await test_model_1.LabTest.find({ _id: { $in: orderedIds }, status: 'Active' }).populate('department');
        const testById = new Map(found.map((test) => [test._id.toString(), test]));
        const missing = orderedIds.filter((id) => !testById.has(id));
        if (missing.length) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, `${missing.length} selected test${missing.length === 1 ? ' is' : 's are'} no longer in the active catalogue`);
        }
        const rupees = (value) => Math.round((Number(value) || 0) * 100) / 100;
        // The panels the desk says it billed, resolved against the master.
        //
        // A package price is a discount an Admin already approved when the panel
        // was set up - often far past the staff limit, because that is the whole
        // point of selling one. Measuring it as a concession the receptionist
        // gave would refuse every package bill at the counter. So a panel that is
        // on this bill in full is worth its own price, and the cap below is
        // measured against that instead of against the tests' own rates.
        //
        // It is resolved here rather than trusted: a line claiming a packageId is
        // only priced as a package when the master actually holds that panel and
        // every test in it is on this bill.
        const claimedPackageIds = [
            ...new Set(orderedLines
                .map((line) => line.packageId)
                .filter((id) => Boolean(id) && mongoose_1.default.Types.ObjectId.isValid(id))),
        ];
        const claimedPackages = claimedPackageIds.length
            ? await package_model_1.TestPackage.find({ _id: { $in: claimedPackageIds } })
            : [];
        // The panel's own name is taken from the master, not from what was
        // posted, so a bill can never print a package under a name the centre
        // does not actually sell.
        const packageNameById = new Map(claimedPackages.map((pkg) => [String(pkg._id), pkg.packageName]));
        // Which tests each claimed panel actually put on this bill. Counted off
        // the lines that name the panel rather than off the bill as a whole, so
        // the panel price replaces exactly the lines it paid for and no others.
        const claimedTestsByPackage = new Map();
        orderedLines.forEach((line) => {
            if (!line.packageId)
                return;
            const claimed = claimedTestsByPackage.get(line.packageId) ?? new Set();
            claimed.add(line.testId);
            claimedTestsByPackage.set(line.packageId, claimed);
        });
        const completePackages = new Map();
        claimedPackages.forEach((pkg) => {
            const testIds = (pkg.tests || []).map((id) => String(id));
            const claimed = claimedTestsByPackage.get(String(pkg._id));
            if (testIds.length && claimed && testIds.every((id) => claimed.has(id))) {
                completePackages.set(String(pkg._id), Number(pkg.rate) || 0);
            }
        });
        // What the catalogue says this bill is worth. The staff discount cap is
        // measured against this, not against what was typed - otherwise a rate
        // typed down to half price would walk straight past the limit that a
        // discount of the same size is stopped by.
        let grossSubtotal = 0;
        let lineDiscountTotal = 0;
        // Kept in the order the desk added them, so the bill reads the way the
        // counter built it.
        const priced = orderedLines.map((line) => {
            const test = testById.get(line.testId);
            const catalogueRate = test[rateTier] || test.rate;
            const rate = rupees(line.rate === undefined || line.rate === null ? catalogueRate : Math.max(0, line.rate));
            // Where the work is done. The master is the default and the desk's own
            // choice wins; an in-house line carries no lab name, so a mode flipped
            // back at the counter cannot leave a courier address behind it.
            const processingMode = line.processingMode === 'Outsource' || line.processingMode === 'In-house'
                ? line.processingMode
                : test.processingMode === 'Outsource'
                    ? 'Outsource'
                    : 'In-house';
            const outsourceLab = processingMode === 'Outsource'
                ? String(line.outsourceLab ?? test.outsourceLab ?? '').trim()
                : '';
            // The doctor's copy. An older test saved before referral rates existed
            // falls back to its standard rate, so the doctor is never shown a
            // figure below what the centre itself charges.
            const referralRate = rupees(line.referralRate === undefined || line.referralRate === null
                ? Number(test.referralRate) || Number(test.rate) || 0
                : Math.max(0, line.referralRate));
            let lineDiscount = rupees(Math.min(rate, Math.max(0, line.discountAmount ?? 0)));
            if (lineDiscount > 0 && test.discountAllowed === false) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, `${test.testName} is marked no-discount in the test master - remove the discount on that line`);
            }
            grossSubtotal += rate;
            lineDiscountTotal += lineDiscount;
            return {
                test,
                catalogueRate,
                rate,
                lineDiscount,
                afterLine: rupees(rate - lineDiscount),
                processingMode,
                outsourceLab,
                referralRate,
                packageId: line.packageId,
                packageName: String(line.packageName ?? '').trim(),
            };
        });
        // A line inside a panel the bill carries in full is not worth its own
        // rate - the panel is worth the panel's price, counted once.
        const inCompletePackage = (line) => Boolean(line.packageId && completePackages.has(line.packageId));
        const catalogueTotal = priced.reduce((sum, line) => sum + (inCompletePackage(line) ? 0 : line.catalogueRate), 0) +
            [...completePackages.values()].reduce((sum, price) => sum + price, 0);
        // The bill-wide discount lands on what is left after the per-line ones,
        // so the two never double-count the same rupee.
        const discountableBase = rupees(grossSubtotal - lineDiscountTotal);
        let billDiscount = 0;
        if (discountType === 'Percentage') {
            billDiscount = rupees((discountableBase * Math.min(100, Math.max(0, discountValue))) / 100);
        }
        else {
            billDiscount = rupees(Math.min(discountableBase, Math.max(0, discountValue)));
        }
        const effectiveTotalDiscount = rupees(lineDiscountTotal + billDiscount);
        const finalNetAmount = Math.max(0, rupees(grossSubtotal - effectiveTotalDiscount));
        // Everything the patient is not paying, measured against the rate card.
        const totalConcession = Math.max(0, rupees(catalogueTotal - finalNetAmount));
        const effectiveDiscountPercent = catalogueTotal > 0 ? (totalConcession / catalogueTotal) * 100 : 0;
        if (effectiveDiscountPercent > permissions_1.MAX_STAFF_DISCOUNT_PERCENT &&
            !(0, permissions_1.can)(activeUser.role, permissions_1.PERMISSIONS.BILL_DISCOUNT_OVERRIDE)) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, `Discounts above ${permissions_1.MAX_STAFF_DISCOUNT_PERCENT}% (this bill is at ${effectiveDiscountPercent.toFixed(1)}%) require Admin approval.`);
        }
        // The bill-wide discount is spread back over the lines in proportion to
        // what each is worth, and the rounding remainder is settled on the last
        // line. Without this the line totals printed on the bill add up to more
        // than the bill total, which is the first thing a patient checks.
        let spread = 0;
        const calculatedSubtotal = grossSubtotal;
        const items = priced.map((line, index) => {
            const share = index === priced.length - 1
                ? rupees(billDiscount - spread)
                : discountableBase > 0
                    ? rupees((billDiscount * line.afterLine) / discountableBase)
                    : 0;
            spread = rupees(spread + share);
            const discountAmount = rupees(line.lineDiscount + share);
            const test = line.test;
            return {
                test: test._id,
                testCode: test.testCode,
                testName: test.testName,
                department: typeof test.department === 'object' ? test.department._id : test.department,
                departmentName: typeof test.department === 'object' ? test.department.departmentName : 'Laboratory',
                rate: line.rate,
                discountAmount,
                netAmount: Math.max(0, rupees(line.rate - discountAmount)),
                processingMode: line.processingMode,
                outsourceLab: line.outsourceLab,
                referralRate: line.referralRate,
                // Only a panel the master actually holds is recorded on the bill, so
                // a line can never name a package that never existed.
                packageId: line.packageId && packageNameById.has(line.packageId) ? line.packageId : undefined,
                packageName: line.packageId ? packageNameById.get(line.packageId) ?? '' : '',
            };
        });
        // The doctor's bill is its own total and stands apart from the patient's:
        // no discount the desk gave the patient comes off it, because it is not
        // the same money.
        const referralTotal = rupees(items.reduce((sum, item) => sum + (Number(item.referralRate) || 0), 0));
        const validPaidAmount = Math.min(finalNetAmount, Math.max(0, paidAmount));
        const finalDueAmount = Math.max(0, finalNetAmount - validPaidAmount);
        let paymentStatus = 'Unpaid';
        if (validPaidAmount >= finalNetAmount && finalNetAmount > 0) {
            paymentStatus = 'Paid';
        }
        else if (validPaidAmount > 0) {
            paymentStatus = 'Partial';
        }
        else if (paymentMethod === 'Credit') {
            paymentStatus = 'Credit';
        }
        // A paneled doctor's own name wins over anything typed, so the printed
        // bill and the master can never disagree.
        let referralName = doctorName.trim();
        if (doctorId) {
            const panelDoctor = await doctor_model_1.Doctor.findById(doctorId).select('doctorName');
            if (panelDoctor)
                referralName = panelDoctor.doctorName;
        }
        const invoiceNumber = await (0, counter_model_1.getNextInvoiceNumber)();
        const barcodeStr = await (0, counter_model_1.getNextBarcode)();
        const invoice = await invoice_model_1.Invoice.create({
            invoiceNumber,
            patient: patient._id,
            uhid: patient.uhid,
            referringDoctor: doctorId || undefined,
            referringDoctorName: referralName,
            organization: organizationId || undefined,
            chiefComplaint,
            clinicalNotes,
            priority,
            items,
            subtotal: calculatedSubtotal,
            discountType,
            discountValue,
            discountReason,
            netAmount: finalNetAmount,
            referralTotal,
            paidAmount: validPaidAmount,
            dueAmount: finalDueAmount,
            paymentStatus,
            paymentMethod,
            barcode: barcodeStr,
            createdBy: {
                userId,
                name: userName,
            },
        });
        let paymentRecord = null;
        if (validPaidAmount > 0) {
            const receiptNumber = await (0, counter_model_1.getNextReceiptNumber)();
            paymentRecord = await payment_model_1.Payment.create({
                receiptNumber,
                invoice: invoice._id,
                patient: patient._id,
                amount: validPaidAmount,
                paymentMethod,
                notes: 'Initial invoice payment',
                receivedBy: {
                    userId,
                    name: userName,
                },
            });
        }
        const sampleRecords = [];
        // Walked over the priced lines rather than the bare tests, so a line the
        // desk flipped to Outsource reaches the bench as an outsourced sample.
        for (const line of priced) {
            const test = line.test;
            const sampleId = await (0, counter_model_1.getNextSampleId)();
            const sampleBarcode = await (0, counter_model_1.getNextBarcode)();
            const sample = await sample_model_1.Sample.create({
                sampleId,
                barcode: sampleBarcode,
                invoice: invoice._id,
                patient: patient._id,
                uhid: patient.uhid,
                test: test._id,
                testCode: test.testCode,
                testName: test.testName,
                department: typeof test.department === 'object' ? test.department._id : test.department,
                // Required on the sample - a test saved without a vial must not stop
                // the bill from registering its samples.
                sampleType: test.sampleType || 'Whole Blood',
                sampleContainer: test.sampleContainer || 'EDTA Vial',
                processingMode: line.processingMode,
                outsourceLab: line.outsourceLab,
                status: 'Pending Collection',
                priority,
                chiefComplaint,
                expectedAt: computeExpectedAt(test.turnaroundTime),
                statusHistory: [
                    {
                        fromStatus: 'Registered',
                        toStatus: 'Pending Collection',
                        updatedBy: { userId: currentUser?.userId, name: userName, role: currentUser?.role ?? 'System' },
                        timestamp: new Date(),
                        notes: `Ordered on invoice ${invoice.invoiceNumber}`,
                    },
                ],
            });
            sampleRecords.push(sample);
        }
        return {
            invoice,
            paymentRecord,
            samples: sampleRecords,
        };
    }
    static async getAllInvoices(query) {
        const { search, paymentStatus, from, to, page = 1, limit = 10 } = query;
        const filter = {};
        if (search) {
            filter.$or = [
                { invoiceNumber: { $regex: search, $options: 'i' } },
                { uhid: { $regex: search, $options: 'i' } },
                { barcode: { $regex: search, $options: 'i' } },
            ];
            const matchingPatients = await patient_model_1.Patient.find({
                $or: [
                    { patientName: { $regex: search, $options: 'i' } },
                    { mobile: { $regex: search, $options: 'i' } },
                ],
            }).select('_id');
            if (matchingPatients.length > 0) {
                filter.$or.push({ patient: { $in: matchingPatients.map((p) => p._id) } });
            }
        }
        if (paymentStatus) {
            filter.paymentStatus = paymentStatus;
        }
        // A day filter is inclusive of both ends and works on whole local days -
        // "1st to 1st" has to mean that whole day, not the midnight instant at the
        // start of it, or the desk checking today's billing sees nothing.
        if (from || to) {
            const range = {};
            if (from) {
                const start = new Date(from);
                start.setHours(0, 0, 0, 0);
                if (!Number.isNaN(start.getTime()))
                    range.$gte = start;
            }
            if (to) {
                const end = new Date(to);
                end.setHours(23, 59, 59, 999);
                if (!Number.isNaN(end.getTime()))
                    range.$lte = end;
            }
            if (Object.keys(range).length)
                filter.createdAt = range;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [invoices, total, totals] = await Promise.all([
            invoice_model_1.Invoice.find(filter)
                .populate('patient', 'uhid patientName gender age mobile')
                .populate('referringDoctor', 'doctorName hospital')
                .populate('organization', 'organizationName contractRate')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            invoice_model_1.Invoice.countDocuments(filter),
            // Totals for everything the filter matched, not for the ten rows on
            // screen - a day's billing is the question being asked, and adding up
            // one page of it would answer it wrongly.
            invoice_model_1.Invoice.aggregate([
                { $match: filter },
                {
                    $group: {
                        _id: null,
                        billed: { $sum: '$netAmount' },
                        collected: { $sum: '$paidAmount' },
                        due: { $sum: '$dueAmount' },
                        discount: { $sum: '$discountAmount' },
                    },
                },
            ]),
        ]);
        const summed = totals[0] || {};
        return {
            invoices,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
                summary: {
                    invoices: total,
                    billed: summed.billed || 0,
                    collected: summed.collected || 0,
                    due: summed.due || 0,
                    discount: summed.discount || 0,
                },
            },
        };
    }
    static async getInvoiceById(id) {
        const invoice = await invoice_model_1.Invoice.findById(id)
            .populate('patient')
            .populate('referringDoctor')
            .populate('organization');
        if (!invoice) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Invoice record not found');
        }
        const payments = await payment_model_1.Payment.find({ invoice: invoice._id }).sort({ createdAt: -1 });
        const samples = await sample_model_1.Sample.find({ invoice: invoice._id });
        return {
            invoice,
            payments,
            samples,
        };
    }
    static async getByBarcode(barcode) {
        const invoice = await invoice_model_1.Invoice.findOne({ barcode })
            .populate('patient')
            .populate('referringDoctor')
            .populate('organization');
        if (!invoice) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, `No invoice found for barcode: ${barcode}`);
        }
        const payments = await payment_model_1.Payment.find({ invoice: invoice._id }).sort({ createdAt: -1 });
        const samples = await sample_model_1.Sample.find({ invoice: invoice._id });
        return {
            invoice,
            payments,
            samples,
        };
    }
    static async addPayment(invoiceId, payload, currentUser) {
        const invoice = await invoice_model_1.Invoice.findById(invoiceId);
        if (!invoice) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'Invoice record not found');
        }
        if (invoice.dueAmount <= 0) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Invoice is already fully paid');
        }
        const payAmount = Math.min(invoice.dueAmount, Math.max(0, payload.amount));
        if (payAmount <= 0) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Payment amount must be greater than zero');
        }
        const receiptNumber = await (0, counter_model_1.getNextReceiptNumber)();
        const rawUserId = currentUser.userId || currentUser.id || currentUser._id;
        const userId = mongoose_1.default.Types.ObjectId.isValid(rawUserId) ? rawUserId : new mongoose_1.default.Types.ObjectId();
        const paymentRecord = await payment_model_1.Payment.create({
            receiptNumber,
            invoice: invoice._id,
            patient: invoice.patient,
            amount: payAmount,
            paymentMethod: payload.paymentMethod,
            transactionRef: payload.transactionRef || '',
            notes: payload.notes || 'Additional invoice due payment',
            receivedBy: {
                userId,
                name: currentUser.name,
            },
        });
        invoice.paidAmount += payAmount;
        invoice.dueAmount = Math.max(0, invoice.netAmount - invoice.paidAmount);
        if (invoice.dueAmount === 0) {
            invoice.paymentStatus = 'Paid';
        }
        else {
            invoice.paymentStatus = 'Partial';
        }
        await invoice.save();
        return {
            invoice,
            paymentRecord,
        };
    }
}
exports.BillingService = BillingService;
