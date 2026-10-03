import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import { repo, regexAny, mongoSort } from '../db/repo';
import { assertObjectId, isObjectId, isValidObjectIdValue, newObjectId } from '../db/ids';
import { bookedTests, containsSql, escapeLike, paymentMethodSql, paymentMethodWhere, utc } from '../db/billing.queries';
import { SAMPLE_STATUS } from '../constants/workflow';
import { fromDecimal } from '../db/mappers';
import {
  getNextInvoiceNumber,
  getNextReceiptNumber,
  getNextSampleId,
  getNextBarcode,
  getNextEnquiryNumber,
} from '../db/counters';
import { ApiError } from '../utils/api-error.util';
import { normaliseIdentity } from '../utils/abha.util';
import { HTTP_STATUS } from '../constants/messages';
import { JwtPayload } from '../types/auth.interface';
import { PERMISSIONS, PermissionHolder, can, MAX_STAFF_DISCOUNT_PERCENT } from '../constants/permissions';
import { getNextUhid } from '../db/counters';

/** Whole documents: a test with its department, as `.populate('department')` loaded it. */
const TEST_WITH_DEPARTMENT = { department: true };

/** `.populate(...)` of a bill as the bill screen reads it. */
const BILL_REFS = {
  patient: true,
  referringDoctor: true,
  discountDoctor: { select: { id: true, doctorName: true, specialty: true } },
  organization: true,
};

/** `LabTest.find({ _id: { $in: ids } })`: every id cast first, as Mongoose did. */
const findTests = (ids: string[], extra: any = {}) =>
  repo.find('labTest', {
    where: { id: { in: ids.map((id) => assertObjectId(id)) }, ...extra },
    include: TEST_WITH_DEPARTMENT,
  });
import { COLLECTION_METHODS, type CollectionMethod } from '../constants/payment-methods';

/** Rupees, to the paisa - money added up in floating point drifts otherwise. */
const rupeePrecision = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

/**
 * What the desk actually collected, as a list of tenders.
 *
 * A patient settling half in cash and half by UPI is one payment to them and
 * two entries in the books, because the day's cash has to reconcile against
 * the drawer and the UPI against the statement. Both the single-method form
 * the older screens post and the split form the counter now sends arrive
 * here, so there is one definition of a payment behind both.
 *
 * "Credit" is the absence of a payment - the patient is billed and pays
 * later - so it can never be one leg of a split.
 */
const readTenders = (input: {
  paymentSplits?: PaymentTender[];
  paidAmount?: number;
  paymentMethod?: CollectionMethod;
}): PaymentTender[] => {
  const splits = (input.paymentSplits || [])
    .map((tender) => ({
      method: tender.method,
      amount: rupeePrecision(tender.amount),
      transactionRef: tender.transactionRef || '',
    }))
    .filter((tender) => tender.amount > 0);

  if (splits.length) {
    for (const tender of splits) {
      if (!COLLECTION_METHODS.includes(tender.method)) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, `${tender.method} is not a payment method the centre takes`);
      }
      if (tender.method === 'Credit' && splits.length > 1) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Credit is money not collected, so it cannot be one leg of a split payment'
        );
      }
    }
    return splits;
  }

  const amount = rupeePrecision(input.paidAmount ?? 0);
  if (amount <= 0) return [];
  return [{ method: (input.paymentMethod || 'Cash') as CollectionMethod, amount, transactionRef: '' }];
};

/** The tenders scaled to fit what is actually owed, largest leg absorbing the
    rounding so the legs still add up to the total to the paisa. */
const capTenders = (tenders: PaymentTender[], ceiling: number): PaymentTender[] => {
  const offered = rupeePrecision(tenders.reduce((sum, tender) => sum + tender.amount, 0));
  if (offered <= ceiling) return tenders;

  // Overpaying is the desk mistyping, not a decision - the excess comes off
  // the largest leg rather than being taken and owed back.
  const order = [...tenders].sort((a, b) => b.amount - a.amount);
  let excess = rupeePrecision(offered - ceiling);
  for (const tender of order) {
    if (excess <= 0) break;
    const cut = Math.min(tender.amount, excess);
    tender.amount = rupeePrecision(tender.amount - cut);
    excess = rupeePrecision(excess - cut);
  }
  return tenders.filter((tender) => tender.amount > 0);
};

/** The running per-method total on a bill, with new tenders folded in. */
const mergeBreakdown = (
  existing: Array<{ method: string; amount: number }> = [],
  tenders: PaymentTender[]
): Array<{ method: CollectionMethod; amount: number }> => {
  const totals = new Map<string, number>();
  for (const entry of existing) {
    totals.set(entry.method, rupeePrecision((totals.get(entry.method) || 0) + entry.amount));
  }
  for (const tender of tenders) {
    totals.set(tender.method, rupeePrecision((totals.get(tender.method) || 0) + tender.amount));
  }
  // Ordered as the centre's method list is, so two bills paid the same two
  // ways read the same way round on screen.
  return COLLECTION_METHODS.filter((method) => (totals.get(method) || 0) > 0).map((method) => ({
    method,
    amount: totals.get(method) as number,
  }));
};

/** The method a bill is filed under: whichever tender brought in the most. */
const headlineMethod = (
  breakdown: Array<{ method: CollectionMethod; amount: number }>,
  fallback: CollectionMethod
): CollectionMethod =>
  breakdown.reduce<{ method: CollectionMethod; amount: number } | null>(
    (top, entry) => (!top || entry.amount > top.amount ? entry : top),
    null
  )?.method || fallback;

/**
 * Turns a test's turnaroundTime ("24 Hours", "45 Minutes", "3 Days") into a
 * concrete TAT deadline so the bench can flag overdue work.
 */
const computeExpectedAt = (turnaroundTime?: string): Date => {
  const now = new Date();
  const match = String(turnaroundTime ?? '').match(/(\d+(?:\.\d+)?)\s*(minute|min|hour|hr|day|week)/i);
  if (!match) return new Date(now.getTime() + 24 * 60 * 60 * 1000); // default 24h

  const amount = Number(match[1]);
  const unitMs: Record<string, number> = {
    minute: 60_000,
    min: 60_000,
    hour: 3_600_000,
    hr: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
  };
  return new Date(now.getTime() + amount * (unitMs[match[2].toLowerCase()] ?? 3_600_000));
};

/**
 * One line the desk actually typed: which test, what it is being charged at
 * and what was knocked off it. A centre negotiates on the counter - a repeat
 * patient gets ₹100 off the CBC, a camp rate is honoured on one test and not
 * the rest - and that has to survive onto the bill line rather than being
 * flattened into a single figure at the bottom.
 */
export interface InvoiceLinePayload {
  testId: string;
  /** What the desk charged. Falls back to the patient's rate tier. */
  rate?: number;
  /** Rupees off this line, before any bill-wide discount. */
  discountAmount?: number;
  /**
   * Run at the bench or sent out. The test master decides this, and the desk
   * overrides it on the day - an in-house analyser down for service sends its
   * work out, and the bill has to say so or the sample is never couriered.
   */
  processingMode?: 'In-house' | 'Outsource';
  /** Where an outsourced line goes. Falls back to the test master. */
  outsourceLab?: string;
  /**
   * What the referring doctor's own copy prints this line at. Never charged
   * to the patient; it only ever appears on the doctor's bill.
   */
  referralRate?: number;
  /** Set when this line came in as part of a package. */
  packageId?: string;
  packageName?: string;
}

/** One tender against a bill: an amount and the method it came in by. */
export interface PaymentTender {
  method: CollectionMethod;
  amount: number;
  /** A UPI reference, cheque number or card approval code. */
  transactionRef?: string;
}

export interface CreateInvoicePayload {
  patientId: string;
  doctorId?: string;
  /** Typed in by the desk when the doctor is not on the panel. */
  doctorName?: string;
  organizationId?: string;
  /** Older clients post bare ids; `items` carries the desk's own rates. */
  testIds: string[];
  items?: InvoiceLinePayload[];
  discountType?: 'Percentage' | 'Fixed';
  discountValue?: number;
  discountReason?: string;
  /**
   * The doctor the concession came through. A different question from who
   * referred the patient - a bill is often discounted on one doctor's word
   * while the prescription is another's.
   */
  discountDoctorId?: string;
  /** Typed in when that doctor is not on the panel. */
  discountDoctorName?: string;
  paidAmount?: number;
  paymentMethod?: CollectionMethod;
  /**
   * A counter payment split across methods - half in cash, the rest by UPI.
   * When present it is the payment, and `paidAmount` / `paymentMethod` are
   * derived from it rather than read.
   */
  paymentSplits?: PaymentTender[];
  chiefComplaint?: string;
  clinicalNotes?: string;
  priority?: 'Routine' | 'Urgent';
  user?: any;
}

export interface NewPatientDetails {
  patientName: string;
  gender: 'Male' | 'Female' | 'Male Child' | 'Female Child' | 'Other' | 'Child';
  age: number;
  mobile: string;
  dateOfBirth?: string;
  emergencyContact?: string;
  abhaNumber?: string;
  abhaAddress?: string;
  abhaStatus?: '' | 'Existing' | 'New';
  idProofType?: string;
  idProofNumber?: string;
  /** From a verified ABHA, as a data: URI. */
  photo?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
}

/**
 * A bill being changed after it was raised: tests added at the counter, a
 * concession agreed when the patient came back to settle, or both.
 * Everything is optional - a revision that only adds a test leaves the
 * discount exactly as it was.
 */
export interface ReviseInvoicePayload {
  addItems?: InvoiceLinePayload[];
  discountType?: 'Percentage' | 'Fixed';
  discountValue?: number;
  discountReason?: string;
  discountDoctorId?: string;
  discountDoctorName?: string;
  clinicalNotes?: string;
  priority?: 'Routine' | 'Urgent';
  /** A line for the bill's own history, in the desk's words. */
  revisionNote?: string;
}

export interface CreateVisitPayload extends Omit<CreateInvoicePayload, 'patientId'> {
  /** An existing patient, or the details of one being registered right now. */
  patientId?: string;
  patient?: NewPatientDetails;
}

/** One line as this bill actually prices it, before it is written down. */
interface PricedLine {
  test: any;
  catalogueRate: number;
  rate: number;
  lineDiscount: number;
  afterLine: number;
  processingMode: 'In-house' | 'Outsource';
  outsourceLab: string;
  referralRate: number;
  packageId?: string;
  packageName: string;
}

export interface PricedBill {
  items: any[];
  priced: PricedLine[];
  /** The rates added up, before any discount. */
  subtotal: number;
  lineDiscountTotal: number;
  billDiscount: number;
  netAmount: number;
  referralTotal: number;
  /** How far the whole bill sits below the rate card, in percent. */
  effectiveDiscountPercent: number;
}

/**
 * What a set of lines is worth, and what goes onto the bill for each of them.
 *
 * Shared by raising a bill and revising one, because those two have to price
 * the same tests identically - a revision that spread its discount even
 * slightly differently would move a total the patient has already been quoted.
 */
const priceBill = async (args: {
  lines: InvoiceLinePayload[];
  testById: Map<string, any>;
  rateTier: 'corporateRate' | 'doctorRate' | 'patientRate' | 'rate';
  discountType: 'Percentage' | 'Fixed';
  discountValue: number;
  /** Whose limit the concession is measured against. */
  actor?: PermissionHolder;
}): Promise<PricedBill> => {
  const { lines: orderedLines, testById, rateTier, discountType, discountValue, actor } = args;

  const rupees = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

  // The panels the desk says it billed, resolved against the master.
  //
  // A package price is a discount an Admin already approved when the panel
  // was set up - often far past the staff limit, because that is the whole
  // point of selling one. Measuring it as a concession the receptionist gave
  // would refuse every package bill at the counter. So a panel that is on this
  // bill in full is worth its own price, and the cap below is measured against
  // that instead of against the tests' own rates.
  //
  // It is resolved here rather than trusted: a line claiming a packageId is
  // only priced as a package when the master actually holds that panel and
  // every test in it is on this bill.
  const claimedPackageIds = [
    ...new Set(
      orderedLines
        .map((line) => line.packageId)
        .filter((id): id is string => Boolean(id) && isValidObjectIdValue(id as string))
    ),
  ];

  const claimedPackages: any[] = claimedPackageIds.length
    ? await repo.find('testPackage', { where: { id: { in: claimedPackageIds.map((id) => id.toLowerCase()) } } })
    : [];

  // The panel's own name is taken from the master, not from what was posted,
  // so a bill can never print a package under a name the centre does not
  // actually sell.
  const packageNameById = new Map(claimedPackages.map((pkg) => [String(pkg._id), pkg.packageName]));

  // Which tests each claimed panel actually put on this bill. Counted off the
  // lines that name the panel rather than off the bill as a whole, so the
  // panel price replaces exactly the lines it paid for and no others.
  const claimedTestsByPackage = new Map<string, Set<string>>();
  orderedLines.forEach((line) => {
    if (!line.packageId) return;
    const claimed = claimedTestsByPackage.get(line.packageId) ?? new Set<string>();
    claimed.add(line.testId);
    claimedTestsByPackage.set(line.packageId, claimed);
  });

  const completePackages = new Map<string, number>();
  claimedPackages.forEach((pkg) => {
    const testIds = (pkg.tests || []).map((id: any) => String(id));
    const claimed = claimedTestsByPackage.get(String(pkg._id));
    if (testIds.length && claimed && testIds.every((id: string) => claimed.has(id))) {
      completePackages.set(String(pkg._id), Number(pkg.rate) || 0);
    }
  });

  // What the catalogue says this bill is worth. The staff discount cap is
  // measured against this, not against what was typed - otherwise a rate typed
  // down to half price would walk straight past the limit that a discount of
  // the same size is stopped by.
  let grossSubtotal = 0;
  let lineDiscountTotal = 0;

  // Kept in the order the desk added them, so the bill reads the way the
  // counter built it.
  const priced: PricedLine[] = orderedLines.map((line) => {
    const test = testById.get(line.testId)!;
    const catalogueRate = (test as any)[rateTier] || test.rate;
    const rate = rupees(line.rate === undefined || line.rate === null ? catalogueRate : Math.max(0, line.rate));

    // Where the work is done. The master is the default and the desk's own
    // choice wins; an in-house line carries no lab name, so a mode flipped
    // back at the counter cannot leave a courier address behind it.
    const processingMode: 'In-house' | 'Outsource' =
      line.processingMode === 'Outsource' || line.processingMode === 'In-house'
        ? line.processingMode
        : test.processingMode === 'Outsource'
        ? 'Outsource'
        : 'In-house';
    const outsourceLab =
      processingMode === 'Outsource' ? String(line.outsourceLab ?? test.outsourceLab ?? '').trim() : '';

    // The doctor's copy. An older test saved before referral rates existed
    // falls back to its standard rate, so the doctor is never shown a figure
    // below what the centre itself charges.
    const referralRate = rupees(
      line.referralRate === undefined || line.referralRate === null
        ? Number(test.referralRate) || Number(test.rate) || 0
        : Math.max(0, line.referralRate)
    );

    const lineDiscount = rupees(Math.min(rate, Math.max(0, line.discountAmount ?? 0)));
    if (lineDiscount > 0 && test.discountAllowed === false) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `${test.testName} is marked no-discount in the test master - remove the discount on that line`
      );
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

  // A line inside a panel the bill carries in full is not worth its own rate -
  // the panel is worth the panel's price, counted once.
  const inCompletePackage = (line: { packageId?: string }) =>
    Boolean(line.packageId && completePackages.has(line.packageId));

  const catalogueTotal =
    priced.reduce((sum, line) => sum + (inCompletePackage(line) ? 0 : line.catalogueRate), 0) +
    [...completePackages.values()].reduce((sum, price) => sum + price, 0);

  // The bill-wide discount lands on what is left after the per-line ones, so
  // the two never double-count the same rupee.
  const discountableBase = rupees(grossSubtotal - lineDiscountTotal);
  let billDiscount = 0;
  if (discountType === 'Percentage') {
    billDiscount = rupees((discountableBase * Math.min(100, Math.max(0, discountValue))) / 100);
  } else {
    billDiscount = rupees(Math.min(discountableBase, Math.max(0, discountValue)));
  }

  const effectiveTotalDiscount = rupees(lineDiscountTotal + billDiscount);
  const finalNetAmount = Math.max(0, rupees(grossSubtotal - effectiveTotalDiscount));

  // Everything the patient is not paying, measured against the rate card.
  const totalConcession = Math.max(0, rupees(catalogueTotal - finalNetAmount));
  const effectiveDiscountPercent = catalogueTotal > 0 ? (totalConcession / catalogueTotal) * 100 : 0;
  if (effectiveDiscountPercent > MAX_STAFF_DISCOUNT_PERCENT && !can(actor, PERMISSIONS.BILL_DISCOUNT_OVERRIDE)) {
    throw new ApiError(
      HTTP_STATUS.FORBIDDEN,
      `Discounts above ${MAX_STAFF_DISCOUNT_PERCENT}% (this bill is at ${effectiveDiscountPercent.toFixed(
        1
      )}%) require Admin approval.`
    );
  }

  // The bill-wide discount is spread back over the lines in proportion to what
  // each is worth, and the rounding remainder is settled on the last line.
  // Without this the line totals printed on the bill add up to more than the
  // bill total, which is the first thing a patient checks.
  let spread = 0;
  const items = priced.map((line, index) => {
    const share =
      index === priced.length - 1
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
      department: typeof test.department === 'object' ? (test.department as any)._id : test.department,
      departmentName:
        typeof test.department === 'object' ? (test.department as any).departmentName : 'Laboratory',
      rate: line.rate,
      // Kept beside the printed figure so the bill can be revised later
      // without the counter's own concession being counted twice.
      lineDiscountAmount: line.lineDiscount,
      discountAmount,
      netAmount: Math.max(0, rupees(line.rate - discountAmount)),
      processingMode: line.processingMode,
      outsourceLab: line.outsourceLab,
      referralRate: line.referralRate,
      // Only a panel the master actually holds is recorded on the bill, so a
      // line can never name a package that never existed.
      packageId: line.packageId && packageNameById.has(line.packageId) ? line.packageId : undefined,
      packageName: line.packageId ? packageNameById.get(line.packageId) ?? '' : '',
    };
  });

  // The doctor's bill is its own total and stands apart from the patient's: no
  // discount the desk gave the patient comes off it, because it is not the
  // same money.
  const referralTotal = rupees(items.reduce((sum, item) => sum + (Number(item.referralRate) || 0), 0));

  return {
    items,
    priced,
    subtotal: grossSubtotal,
    lineDiscountTotal,
    billDiscount,
    netAmount: finalNetAmount,
    referralTotal,
    effectiveDiscountPercent,
  };
};

export class BillingService {
  /**
   * The most rows one call to the directory will ever return. An export asks
   * for the whole filtered window, so it walks pages of this size rather than
   * naming a page size of its own.
   */
  static readonly MAX_PAGE_SIZE = 500;
  /** The timezone the date filters' setHours() works in. */
  static readonly SERVER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';

  /**
   * One front-desk intake. The receptionist takes the patient's details, what
   * they have come in for, the referring doctor and the tests, and this turns
   * all of it into a registered patient, a bill and a queued sample in a single
   * step - rather than the three separate screens the desk used to walk.
   *
   * A patient registered here is rolled back if the bill fails, so a half-made
   * visit cannot leave an orphan record the desk would re-create on retry.
   */
  static async createVisit(payload: CreateVisitPayload, currentUser?: JwtPayload) {
    const activeUser = currentUser || payload.user || { name: 'System Staff', role: 'Admin' };

    let patientId = payload.patientId;
    let createdPatientId: string | null = null;

    if (!patientId) {
      if (!payload.patient) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Select an existing patient or fill in the new patient details'
        );
      }

      if (!can(activeUser, PERMISSIONS.PATIENT_CREATE)) {
        throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You are not permitted to register a new patient');
      }

      const uhid = await getNextUhid();
      const details = normaliseIdentity({ ...payload.patient });
      const patient = await repo.create('patient', {
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
      const patient = await repo.findById('patient', patientId);

      return {
        ...result,
        patient,
        isNewPatient: Boolean(createdPatientId),
      };
    } catch (error) {
      if (createdPatientId) {
        await repo.deleteById('patient', createdPatientId);
      }
      throw error;
    }
  }

  static async createInvoice(payload: CreateInvoicePayload, currentUser?: JwtPayload) {
    const {
      patientId,
      doctorId,
      doctorName = '',
      organizationId,
      testIds,
      items: lineOverrides,
      discountType = 'Fixed',
      discountValue = 0,
      discountReason = '',
      discountDoctorId,
      discountDoctorName = '',
      paidAmount = 0,
      paymentMethod = 'Cash',
      paymentSplits,
      chiefComplaint = '',
      clinicalNotes = '',
      priority = 'Routine',
    } = payload;

    const activeUser = currentUser || payload.user || { userId: newObjectId(), name: 'System Admin', role: 'Admin' };
    const rawUserId = activeUser.userId || activeUser.id || activeUser._id;
    const userId = isValidObjectIdValue(rawUserId) ? rawUserId : newObjectId();
    const userName = activeUser.name || 'System Staff';

    // `items` is what the desk typed; `testIds` is the older shape. Either
    // way the same test twice on one bill is one line - a duplicate used to
    // fail the count check below with "one or more tests are invalid", which
    // told the desk nothing about what was actually wrong.
    const requestedLines: InvoiceLinePayload[] = (
      lineOverrides?.length ? lineOverrides : (testIds || []).map((testId) => ({ testId }))
    ).filter((line) => Boolean(line?.testId));

    const orderedLines = requestedLines.filter(
      (line, index) => requestedLines.findIndex((other) => other.testId === line.testId) === index
    );

    if (!orderedLines.length) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'At least one lab test must be selected for billing');
    }

    const patient = await repo.findById('patient', patientId);
    if (!patient) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Patient record not found');
    }

    let rateTier: 'corporateRate' | 'doctorRate' | 'patientRate' | 'rate' = 'rate';

    if (organizationId) {
      const org = await repo.findById('organization', organizationId);
      if (org) {
        if (org.contractRate === 'Corporate') rateTier = 'corporateRate';
        else if (org.contractRate === 'Discounted') rateTier = 'doctorRate';
      }
    } else if (doctorId) {
      rateTier = 'doctorRate';
    }

    const orderedIds = orderedLines.map((line) => line.testId);
    const found = await findTests(orderedIds, { status: 'Active' });
    const testById = new Map<string, any>(found.map((test: any) => [test._id.toString(), test]));

    const missing = orderedIds.filter((id) => !testById.has(id));
    if (missing.length) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `${missing.length} selected test${missing.length === 1 ? ' is' : 's are'} no longer in the active catalogue`
      );
    }

    const pricing = await priceBill({
      lines: orderedLines,
      testById,
      rateTier,
      discountType,
      discountValue,
      actor: activeUser,
    });

    const { items, priced } = pricing;
    const calculatedSubtotal = pricing.subtotal;
    const finalNetAmount = pricing.netAmount;
    const referralTotal = pricing.referralTotal;

    // What the desk took at the counter - one tender, or several when the
    // patient settled part in cash and the rest on the machine. Nothing may
    // be collected beyond the bill, so the tenders are capped at its total.
    // Credit can only ever arrive on its own - `readTenders` refuses it as a
    // leg of a split - so it is left to book exactly as it always has rather
    // than being reinterpreted here.
    const collecting = capTenders(readTenders({ paymentSplits, paidAmount, paymentMethod }), finalNetAmount);
    const validPaidAmount = rupeePrecision(collecting.reduce((sum, tender) => sum + tender.amount, 0));
    const finalDueAmount = Math.max(0, rupeePrecision(finalNetAmount - validPaidAmount));
    const breakdown = mergeBreakdown([], collecting);

    let paymentStatus: 'Paid' | 'Partial' | 'Unpaid' | 'Credit' = 'Unpaid';
    if (validPaidAmount >= finalNetAmount && finalNetAmount > 0) {
      paymentStatus = 'Paid';
    } else if (validPaidAmount > 0) {
      paymentStatus = 'Partial';
    } else if (paymentMethod === 'Credit') {
      paymentStatus = 'Credit';
    }

    // The bill is filed under whichever tender brought in the most, so a
    // single-method bill reads exactly as it always did.
    const headline = headlineMethod(breakdown, paymentMethod as CollectionMethod);

    // A paneled doctor's own name wins over anything typed, so the printed
    // bill and the master can never disagree.
    let referralName = doctorName.trim();
    if (doctorId) {
      const panelDoctor = await repo.findById('doctor', doctorId);
      if (panelDoctor) referralName = panelDoctor.doctorName;
    }

    // Who the discount came through, on the same rule. Recorded only when
    // something was actually knocked off - an undiscounted bill carrying a
    // doctor's name against a concession nobody gave would read as that
    // doctor's business when the month is totalled.
    const concessionGiven = pricing.subtotal > finalNetAmount;
    const discountReferral = concessionGiven
      ? await BillingService.resolveDiscountDoctor(discountDoctorId, discountDoctorName)
      : { doctorId: undefined, name: '' };

    const invoiceNumber = await getNextInvoiceNumber();
    const barcodeStr = await getNextBarcode();
    // One per visit. A returning patient keeps their UHID and gets a fresh
    // enquiry number, so the desk can tell which of their draws is being
    // asked about when they ring.
    const enquiryNo = await getNextEnquiryNumber();

    const invoice = await repo.create('invoice', {
      invoiceNumber,
      patient: patient._id,
      uhid: patient.uhid,
      enquiryNo,
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
      discountDoctor: discountReferral.doctorId,
      discountDoctorName: discountReferral.name,
      netAmount: finalNetAmount,
      referralTotal,
      paidAmount: validPaidAmount,
      dueAmount: finalDueAmount,
      paymentStatus,
      paymentMethod: headline,
      paymentBreakdown: breakdown,
      barcode: barcodeStr,
      createdBy: {
        userId,
        name: userName,
      },
    });

    // One receipt per tender: the day's cash reconciles against the drawer
    // and the UPI against the statement, so a split payment cannot be filed
    // as a single row under one of its methods.
    const paymentRecords = [];
    for (const tender of collecting) {
      const receiptNumber = await getNextReceiptNumber();
      paymentRecords.push(
        await repo.create('payment', {
          receiptNumber,
          invoice: invoice._id,
          patient: patient._id,
          amount: tender.amount,
          paymentMethod: tender.method,
          transactionRef: tender.transactionRef || '',
          notes:
            collecting.length > 1
              ? `Initial invoice payment (split ${collecting.length} ways)`
              : 'Initial invoice payment',
          receivedBy: {
            userId,
            name: userName,
          },
        })
      );
    }
    // The first receipt is the one the printed bill quotes, as it always was.
    const paymentRecord = paymentRecords[0] || null;

    const sampleRecords = [];
    // Walked over the priced lines rather than the bare tests, so a line the
    // desk flipped to Outsource reaches the bench as an outsourced sample.
    for (const line of priced) {
      const test = line.test;
      const sampleId = await getNextSampleId();
      const sampleBarcode = await getNextBarcode();

      const sample = await repo.create('sample', {
        sampleId,
        barcode: sampleBarcode,
        invoice: invoice._id,
        patient: patient._id,
        uhid: patient.uhid,
        enquiryNo,
        test: test._id,
        testCode: test.testCode,
        testName: test.testName,
        department: typeof test.department === 'object' ? (test.department as any)._id : test.department,
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

  /**
   * Bills paid by one method. A split bill counts under every method it was
   * paid by, read off the per-method breakdown; an older bill with no
   * breakdown falls back to its filed method, but only once money came in -
   * an untouched bill defaults to Cash and would otherwise swell that bucket.
   * Credit is the bill left to be collected later.
   */
  static paymentMethodFilter(method?: string): any | null {
    if (!method || !(COLLECTION_METHODS as readonly string[]).includes(method)) return null;
    return paymentMethodWhere(method);
  }

  static async getAllInvoices(query: {
    search?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    patient?: string;
    processingMode?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, paymentMethod, paymentStatus, patient, processingMode, from, to, page = 1, limit = 10 } = query;
    const filter: any = { AND: [] };

    // Its own OR, so it goes under AND rather than clashing with the search's.
    const methodFilter = BillingService.paymentMethodFilter(paymentMethod);
    if (methodFilter) filter.AND.push(methodFilter);

    // The directory reads ten rows at a time; an export asks for the whole
    // window at once. Both go through here, so the page size is clamped
    // rather than trusted - a client asking for everything in one request
    // would otherwise pull the entire collection into memory.
    const pageSize = Math.min(Math.max(Number(limit) || 10, 1), BillingService.MAX_PAGE_SIZE);
    const pageNumber = Math.max(Number(page) || 1, 1);

    // One patient's bills - what their profile exports and prints.
    if (patient && isObjectId(patient)) {
      filter.patientId = patient.toLowerCase();
    }

    if (search) {
      const or = await regexAny('invoice', ['invoiceNumber', 'uhid', 'enquiryNo', 'barcode'], String(search));

      const matchingPatients = await prisma.patient.findMany({
        where: await regexAny('patient', ['patientName', 'mobile'], String(search)),
        select: { id: true },
      });

      if (matchingPatients.length > 0) {
        or.OR.push({ patientId: { in: matchingPatients.map((p) => p.id) } });
      }
      filter.AND.push(or);
    }

    // Paid against still owing. "Unpaid" at the counter means money is yet to
    // come in, which covers a part-paid bill and one left on credit as much as
    // one nothing was taken on - a desk chasing today's outstanding wants all
    // three in the list. So the two buckets are disjoint and their counts add
    // up to the window, rather than filtering on the stored label and leaving
    // every partial bill out of both answers.
    if (paymentStatus === 'Paid') {
      filter.dueAmount = { lte: 0 };
    } else if (paymentStatus === 'Unpaid') {
      filter.dueAmount = { gt: 0 };
    } else if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }

    // Bills that were run on our own benches against bills that had anything
    // sent out. The two buckets are kept disjoint - one sent-out line makes
    // the whole bill an outsourced one, because that is the bill the desk
    // chases a referral lab for - so the two counts still add up to the
    // window's total instead of double-counting every mixed bill.
    if (processingMode === 'Outsource') {
      filter.items = { some: { processingMode: 'Outsource' } };
    } else if (processingMode === 'In-house') {
      filter.items = { none: { processingMode: 'Outsource' } };
    }

    // A day filter is inclusive of both ends and works on whole local days -
    // "1st to 1st" has to mean that whole day, not the midnight instant at the
    // start of it, or the desk checking today's billing sees nothing.
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

    const skip = (pageNumber - 1) * pageSize;
    const [invoices, total, totals] = await Promise.all([
      repo.find('invoice', {
        where: filter,
        include: {
          patient: { select: { id: true, uhid: true, patientName: true, gender: true, age: true, mobile: true } },
          referringDoctor: { select: { id: true, doctorName: true, hospital: true } },
          organization: { select: { id: true, organizationName: true, contractRate: true } },
        },
        orderBy: mongoSort('invoice', { createdAt: -1 }),
        skip,
        take: pageSize,
      }),
      repo.count('invoice', filter),
      // Totals for everything the filter matched, not for the ten rows on
      // screen - a day's billing is the question being asked, and adding up
      // one page of it would answer it wrongly.
      prisma.invoice
        .aggregate({
          where: filter,
          _count: { _all: true },
          _sum: { netAmount: true, paidAmount: true, dueAmount: true, subtotal: true },
        })
        .then((t) => ({
          ...t,
          // Gross less net, summed exactly: subtotal and net are both exact numerics.
          discount: t._sum.subtotal && t._sum.netAmount ? t._sum.subtotal.minus(t._sum.netAmount) : null,
        })),
    ]);

    // What the desk gave away, taken from the two totals. There is no
    // `discountAmount` on a bill - the field of that name lives on the lines -
    // so summing it returned zero for every window. The gap between gross and
    // net is the whole of it: the per-line discounts and the bill-wide one.
    // Summed exactly in numeric and read as a double, as Mongo's compensated
    // $sum came out.
    const summed: any = totals._count._all
      ? {
          billed: fromDecimal(totals._sum.netAmount),
          collected: fromDecimal(totals._sum.paidAmount),
          due: fromDecimal(totals._sum.dueAmount),
          discount: fromDecimal(totals.discount),
        }
      : {};

    return {
      invoices,
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
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

  /**
   * Every test booked on every bill, one row per line - the same directory as
   * the bill list, but read at the level the patient asks about ("my sugar
   * test"). Each row carries where its sample has got to, so the desk can see
   * at a glance whether a cancellation is still worth anything back.
   */
  static async getBookedTests(query: {
    search?: string;
    department?: string;
    processingMode?: string;
    status?: string;
    paymentMethod?: string;
    paymentStatus?: string;
    organization?: string;
    doctor?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    /** 'daycount' also returns how many of each test were booked on each day. */
    view?: string;
  }) {
    const {
      view,
      search,
      department,
      processingMode,
      status,
      paymentMethod,
      paymentStatus,
      organization,
      doctor,
      from,
      to,
      page = 1,
      limit = 20,
    } = query;
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), BillingService.MAX_PAGE_SIZE);
    const pageNumber = Math.max(Number(page) || 1, 1);

    // Bill-level narrowing first, so the lines are only read for bills in view.
    const billAnd: Prisma.Sql[] = [];
    if (paymentMethod && (COLLECTION_METHODS as readonly string[]).includes(paymentMethod)) {
      billAnd.push(paymentMethodSql(paymentMethod));
    }

    // The TPA / corporate the bill was raised against.
    if (organization && isObjectId(organization)) {
      billAnd.push(Prisma.sql`b."organizationId" = ${organization.toLowerCase()}`);
    }

    // The referring doctor. A paneled doctor is matched on the link, and also
    // on the name typed at the counter, since a desk that typed the name in
    // instead of picking it from the panel still means the same doctor.
    if (doctor && isObjectId(doctor)) {
      const key = doctor.toLowerCase();
      const panelDoctor = await prisma.doctor.findUnique({ where: { id: key }, select: { doctorName: true } });
      // The typed name matched whole and without regard to case.
      const byName = panelDoctor?.doctorName
        ? Prisma.sql` OR b."referringDoctorName" ILIKE ${escapeLike(panelDoctor.doctorName.trim())}`
        : Prisma.empty;
      billAnd.push(Prisma.sql`(b."referringDoctorId" = ${key}${byName})`);
    }
    if (paymentStatus === 'Paid') billAnd.push(Prisma.sql`b."dueAmount" <= 0`);
    else if (paymentStatus === 'Unpaid') billAnd.push(Prisma.sql`b."dueAmount" > 0`);

    if (from || to) {
      const range: any = {};
      if (from) {
        const start = new Date(from);
        start.setHours(0, 0, 0, 0);
        if (!Number.isNaN(start.getTime())) billAnd.push(Prisma.sql`b."createdAt" >= ${utc(start)}`);
      }
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        if (!Number.isNaN(end.getTime())) billAnd.push(Prisma.sql`b."createdAt" <= ${utc(end)}`);
      }
    }

    const lineAnd: Prisma.Sql[] = [];
    if (search) {
      // Escaped, so the text is matched literally: a case-insensitive contains.
      const q = String(search);
      const like = { contains: q, mode: 'insensitive' as const };
      const [matchingPatients, matchingDoctors] = await Promise.all([
        prisma.patient.findMany({ where: { OR: [{ patientName: like }, { mobile: like }] }, select: { id: true } }),
        prisma.doctor.findMany({ where: { doctorName: like }, select: { id: true } }),
      ]);
      const anyOf = [
        containsSql(Prisma.sql`b."invoiceNumber"`, q),
        containsSql(Prisma.sql`b.uhid`, q),
        containsSql(Prisma.sql`b."enquiryNo"`, q),
        containsSql(Prisma.sql`b.barcode`, q),
        containsSql(Prisma.sql`it."testName"`, q),
        containsSql(Prisma.sql`it."testCode"`, q),
        // The referring doctor, whether picked from the panel or typed at the
        // counter for a doctor who is not on it.
        containsSql(Prisma.sql`b."referringDoctorName"`, q),
        ...(matchingDoctors.length
          ? [Prisma.sql`b."referringDoctorId" IN (${Prisma.join(matchingDoctors.map((d) => d.id))})`]
          : []),
        ...(matchingPatients.length
          ? [Prisma.sql`b."patientId" IN (${Prisma.join(matchingPatients.map((p) => p.id))})`]
          : []),
      ];
      lineAnd.push(Prisma.sql`(${Prisma.join(anyOf, ' OR ')})`);
    }
    if (department && isObjectId(department)) {
      lineAnd.push(Prisma.sql`it."departmentId" = ${department.toLowerCase()}`);
    }
    if (processingMode === 'Outsource' || processingMode === 'In-house') {
      lineAnd.push(Prisma.sql`it."processingMode" = ${processingMode}`);
    }

    // Where the work is, as the desk says it. A cancelled line is its own
    // bucket whatever its sample says, so the others only count live lines.
    const STATUS_BUCKETS: Record<string, string[]> = {
      Pending: ['Registered', 'Pending Collection', 'Recollected'],
      Collected: ['Collected', 'Received'],
      Processing: ['Processing'],
      Completed: ['Completed'],
      Rejected: ['Rejected'],
    };
    const statusAnd: Prisma.Sql[] = [];
    if (status === 'Cancelled') {
      statusAnd.push(Prisma.sql`it.cancelled`);
    } else if (status && STATUS_BUCKETS[status]) {
      statusAnd.push(Prisma.sql`NOT it.cancelled`);
      statusAnd.push(
        Prisma.sql`(s.status IN (${Prisma.join(STATUS_BUCKETS[status])})${
          // A line with no sample yet is still waiting for its draw.
          status === 'Pending' ? Prisma.sql` OR s.id IS NULL` : Prisma.empty
        })`
      );
    }

    const found = await bookedTests({
      bill: billAnd,
      line: lineAnd,
      status: statusAnd,
      dayCountsSkipCancelled: status !== 'Cancelled',
      skip: (pageNumber - 1) * pageSize,
      take: pageSize,
      withDayCounts: view === 'daycount',
      timeZone: BillingService.SERVER_TZ,
    });

    // The pipeline's $project, field for field. A value the bill never had is
    // left out of the row, as $project left it out.
    const present = (row: any, value: any, key: string) => {
      if (value !== null && value !== undefined) row[key] = value;
    };
    const RELEASED = ['Approved', 'Final'];
    const result = {
      rows: found.rows.map((r: any) => {
        const row: any = {
          invoiceId: r.invoiceId,
          reportResultId:
            r.sampleStatus === SAMPLE_STATUS.COMPLETED && RELEASED.includes(r.resultStatus) && !r.unreleased
              ? r.resultKey
              : null,
          invoiceNumber: r.invoiceNumber,
          barcode: r.barcode,
          uhid: r.uhid,
          billedAt: r.createdAt,
          paymentStatus: r.paymentStatus,
          dueAmount: fromDecimal(r.dueAmount),
          patient: {},
          itemIndex: r.itemIndex,
          testName: r.testName,
          testCode: r.testCode,
          departmentName: r.departmentName,
          packageName: r.packageName,
          processingMode: r.processingMode,
          rate: fromDecimal(r.rate),
          netAmount: fromDecimal(r.netAmount),
          cancelled: Boolean(r.cancelled),
          cancellationReason: r.cancellationReason,
          refundedAmount: fromDecimal(r.refundedAmount) ?? 0,
        };
        // The panel's name wins over whatever was typed at the counter.
        present(row, r.panelDoctorName ?? r.referringDoctorName, 'doctorName');
        present(row, r.organizationName, 'organizationName');
        present(row, r.enquiryNo, 'enquiryNo');
        present(row, r.cancelledAt, 'cancelledAt');
        present(row, r.sampleId, 'sampleId');
        present(row, r.sampleStatus, 'sampleStatus');
        present(row.patient, r.patientKey, '_id');
        present(row.patient, r.patientName, 'patientName');
        present(row.patient, r.patientUhid, 'uhid');
        present(row.patient, r.patientMobile, 'mobile');
        return row;
      }),
      totals: found.totals && found.totals.tests ? [found.totals] : [],
      dayCounts: found.dayCounts,
    };

    const summed = result?.totals?.[0] || {};
    const total = summed.tests || 0;

    return {
      tests: result?.rows || [],
      ...(view === 'daycount' ? { dayCounts: result?.dayCounts || [] } : {}),
      pagination: {
        total,
        page: pageNumber,
        limit: pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        summary: {
          tests: total,
          billed: summed.billed || 0,
          cancelled: summed.cancelled || 0,
          refunded: summed.refunded || 0,
        },
      },
    };
  }

  /**
   * Who a concession came through, resolved the way the referring doctor is:
   * a paneled doctor's own name wins over anything typed at the counter.
   */
  static async resolveDiscountDoctor(
    doctorId?: string,
    typedName = ''
  ): Promise<{ doctorId?: string; name: string }> {
    const name = String(typedName || '').trim();
    if (doctorId && isObjectId(doctorId)) {
      const panelDoctor = await prisma.doctor.findUnique({ where: { id: doctorId.toLowerCase() }, select: { doctorName: true } });
      if (panelDoctor) return { doctorId, name: panelDoctor.doctorName };
    }
    return { doctorId: undefined, name };
  }

  /**
   * A bill the desk is changing after it was raised.
   *
   * Two things happen at the counter that the old flow had no answer for. A
   * patient who was billed yesterday comes back for one more test, and
   * raising a second bill for it splits one visit across two numbers, two
   * receipts and two reports. And a patient walks in to settle a due having
   * been promised a concession in the meantime - which has to go onto the
   * bill they are about to pay, not onto a credit note afterwards.
   *
   * So the bill is re-priced in full, through exactly the same routine that
   * priced it when it was raised: the tests already on it keep the rates and
   * the counter's own line discounts, the new ones are priced off the master,
   * and the bill-wide discount is re-spread across all of them. What has
   * already been collected is untouched - money that came in is a receipt,
   * and a revision moves what is owed, never what was paid.
   */
  static async reviseInvoice(
    invoiceId: string,
    payload: ReviseInvoicePayload,
    currentUser: JwtPayload
  ) {
    if (!can(currentUser, PERMISSIONS.BILL_CREATE)) {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Your role is not permitted to revise a bill');
    }

    const invoice: any = await repo.findById('invoice', invoiceId);
    if (!invoice) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Invoice record not found');
    }

    const patient = await repo.findById('patient', invoice.patient);
    if (!patient) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Patient record not found');
    }

    const existing: any[] = (invoice.items || []) as any[];

    /**
     * A line the patient cancelled is settled money: it has been refunded
     * against the policy and what the centre kept is already off the total.
     * Re-pricing it would undo that, so cancelled lines are carried through
     * untouched and left out of the re-pricing entirely.
     */
    const cancelledLines = existing.filter((item) => item.cancelled);
    const liveLines = existing.filter((item) => !item.cancelled);

    /**
     * Whether the bill can still say what the desk itself knocked off each
     * line, as against that line's share of the bill-wide discount.
     *
     * A bill raised before revisions existed stored only the two added
     * together, and re-spreading a changed bill discount over that figure
     * would charge the counter's own concession twice. Mongoose fills the
     * missing field with a zero when such a bill is loaded, so its absence
     * cannot be tested for directly - what is tested instead is whether the
     * stored figures still reconcile with the discount on record.
     */
    const storedLineDiscountTotal = liveLines.reduce(
      (sum, item) => sum + (Number(item.lineDiscountAmount) || 0),
      0
    );
    const storedDiscountTotal = liveLines.reduce((sum, item) => sum + (Number(item.discountAmount) || 0), 0);
    const liveSubtotal = liveLines.reduce((sum, item) => sum + (Number(item.rate) || 0), 0);
    const storedDiscountValue = Number(invoice.discountValue) || 0;

    const refuseLegacy = () => {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'This bill was raised before bills could be revised, and its per-test discounts cannot be told ' +
          'apart from the discount on the whole bill - re-pricing it would count them twice. Raise the ' +
          'extra tests on a new bill instead.'
      );
    };

    if (storedDiscountValue === 0) {
      // With no bill-wide discount, every rupee off a line is the counter's
      // own. The two figures must therefore already agree.
      if (Math.abs(storedDiscountTotal - storedLineDiscountTotal) > 1) refuseLegacy();
    } else if (!cancelledLines.length) {
      // With one, the line discounts plus the bill discount they imply have to
      // add back up to what the bill actually printed. (Skipped once a line
      // has been cancelled: the bill discount was spread over lines that are
      // no longer being priced, so the two cannot be expected to tally.)
      const base = rupeePrecision(liveSubtotal - storedLineDiscountTotal);
      const impliedBillDiscount =
        invoice.discountType === 'Percentage'
          ? rupeePrecision((base * Math.min(100, Math.max(0, storedDiscountValue))) / 100)
          : rupeePrecision(Math.min(base, Math.max(0, storedDiscountValue)));
      if (Math.abs(storedDiscountTotal - (storedLineDiscountTotal + impliedBillDiscount)) > 1) refuseLegacy();
    }

    const addLines: InvoiceLinePayload[] = (payload.addItems || []).filter((line) => Boolean(line?.testId));

    const liveTestIds = new Set(liveLines.map((item) => String(item.test)));
    const duplicate = addLines.find((line) => liveTestIds.has(String(line.testId)));
    if (duplicate) {
      const onBill = liveLines.find((item) => String(item.test) === String(duplicate.testId));
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `${onBill?.testName || 'That test'} is already on this bill`
      );
    }

    // The lines already on the bill, put back into the shape the pricer takes.
    // Their rates and their own discounts are what the counter agreed on the
    // day, so they are carried over rather than re-read off the master, which
    // may have been re-rated since.
    const keptLines: InvoiceLinePayload[] = liveLines.map((item) => ({
      testId: String(item.test),
      rate: Number(item.rate) || 0,
      discountAmount: Number(item.lineDiscountAmount ?? item.discountAmount ?? 0),
      processingMode: item.processingMode,
      outsourceLab: item.outsourceLab,
      referralRate: Number(item.referralRate) || 0,
      packageId: item.packageId ? String(item.packageId) : undefined,
      packageName: item.packageName,
    }));

    const orderedLines = [...keptLines, ...addLines];
    if (!orderedLines.length) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'A bill cannot be left with no tests on it. Cancel the bill instead of emptying it.'
      );
    }

    // The same rate tier the bill was raised on, so re-pricing never silently
    // moves a corporate patient onto the walk-in card.
    let rateTier: 'corporateRate' | 'doctorRate' | 'patientRate' | 'rate' = 'rate';
    if (invoice.organization) {
      const org = await repo.findById('organization', invoice.organization);
      if (org) {
        if (org.contractRate === 'Corporate') rateTier = 'corporateRate';
        else if (org.contractRate === 'Discounted') rateTier = 'doctorRate';
      }
    } else if (invoice.referringDoctor) {
      rateTier = 'doctorRate';
    }

    const orderedIds = orderedLines.map((line) => line.testId);
    const found = await findTests(orderedIds);
    const testById = new Map<string, any>(found.map((test: any) => [test._id.toString(), test]));

    // A test added today must still be on the active catalogue; one already on
    // the bill only has to still exist, because it was ordered when it was.
    const missingNew = addLines.filter((line) => {
      const test = testById.get(line.testId);
      return !test || test.status !== 'Active';
    });
    if (missingNew.length) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `${missingNew.length} test${missingNew.length === 1 ? ' is' : 's are'} no longer in the active catalogue`
      );
    }
    const missingKept = keptLines.filter((line) => !testById.has(line.testId));
    if (missingKept.length) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'A test already on this bill is no longer in the catalogue, so the bill cannot be re-priced'
      );
    }

    const discountType = payload.discountType ?? (invoice.discountType as 'Percentage' | 'Fixed');
    const discountValue =
      payload.discountValue === undefined ? Number(invoice.discountValue) || 0 : Math.max(0, payload.discountValue);

    const pricing = await priceBill({
      lines: orderedLines,
      testById,
      rateTier,
      discountType,
      discountValue,
      actor: currentUser,
    });

    // What the cancelled lines still contribute: the centre kept the work it
    // had already done on them, and that stays on the bill.
    const retainedOnCancelled = cancelledLines.reduce(
      (sum, item) => sum + (Number(item.retainedAmount) || 0),
      0
    );
    const cancelledSubtotal = cancelledLines.reduce((sum, item) => sum + (Number(item.rate) || 0), 0);

    const netBefore = Number(invoice.netAmount) || 0;
    const newNet = rupeePrecision(pricing.netAmount + retainedOnCancelled);
    const paid = Number(invoice.paidAmount) || 0;

    // A revision moves what is owed. If it would drop the bill below what the
    // patient has already handed over, the difference is their money and has
    // to go back through the refund desk, where it is receipted.
    if (newNet < paid) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        `This revision brings the bill to Rs.${newNet}, below the Rs.${paid} already collected. ` +
          'Issue a refund for the difference from Accounts instead, so the money leaving the drawer is receipted.'
      );
    }

    const concessionGiven = pricing.subtotal > pricing.netAmount;
    const discountReferral = concessionGiven
      ? await BillingService.resolveDiscountDoctor(
          payload.discountDoctorId === undefined
            ? invoice.discountDoctor
              ? String(invoice.discountDoctor)
              : undefined
            : payload.discountDoctorId,
          payload.discountDoctorName === undefined ? invoice.discountDoctorName : payload.discountDoctorName
        )
      : { doctorId: undefined, name: '' };

    // The new lines go on the end, after the ones already printed, and the
    // cancelled ones are put back where the bill can still show them.
    invoice.items = [...pricing.items, ...cancelledLines] as any;
    invoice.subtotal = rupeePrecision(pricing.subtotal + cancelledSubtotal);
    invoice.discountType = discountType;
    invoice.discountValue = discountValue;
    if (payload.discountReason !== undefined) invoice.discountReason = payload.discountReason;
    invoice.discountDoctor = discountReferral.doctorId as any;
    invoice.discountDoctorName = discountReferral.name;
    invoice.netAmount = newNet;
    invoice.referralTotal = pricing.referralTotal;
    invoice.dueAmount = Math.max(0, rupeePrecision(newNet - paid));
    invoice.paymentStatus =
      invoice.dueAmount === 0 && newNet > 0 ? 'Paid' : paid === 0 ? (invoice.paymentStatus === 'Credit' ? 'Credit' : 'Unpaid') : 'Partial';

    if (payload.clinicalNotes !== undefined) invoice.clinicalNotes = payload.clinicalNotes;
    if (payload.priority) invoice.priority = payload.priority;

    const addedNames = addLines
      .map((line) => testById.get(line.testId)?.testName)
      .filter(Boolean) as string[];

    const summaryParts: string[] = [];
    if (addedNames.length) summaryParts.push(`${addedNames.length} test(s) added`);
    if (rupeePrecision(netBefore) !== rupeePrecision(newNet)) {
      summaryParts.push(`bill moved from Rs.${rupeePrecision(netBefore)} to Rs.${rupeePrecision(newNet)}`);
    }
    if (payload.revisionNote) summaryParts.push(payload.revisionNote);

    invoice.revisions = [
      ...((invoice.revisions || []) as any[]),
      {
        at: new Date(),
        by: {
          userId: String(currentUser?.userId || ''),
          name: currentUser?.name,
          role: currentUser?.role,
        },
        summary: summaryParts.join(' · ') || 'Bill revised',
        testsAdded: addedNames,
        netBefore: rupeePrecision(netBefore),
        netAfter: rupeePrecision(newNet),
      },
    ] as any;

    const saved = await repo.save('invoice', invoice);

    // A test added to the bill is work the bench has not been told about yet,
    // so it is queued for collection exactly as it would have been had it been
    // on the bill from the start - same visit, same enquiry number.
    const newSamples = [];
    const addedById = new Map(addLines.map((line) => [line.testId, line]));
    for (const line of pricing.priced) {
      const testId = String(line.test._id);
      if (!addedById.has(testId)) continue;

      const sampleId = await getNextSampleId();
      const sampleBarcode = await getNextBarcode();

      newSamples.push(
        await repo.create('sample', {
          sampleId,
          barcode: sampleBarcode,
          invoice: invoice._id,
          patient: patient._id,
          uhid: patient.uhid,
          enquiryNo: invoice.enquiryNo,
          test: line.test._id,
          testCode: line.test.testCode,
          testName: line.test.testName,
          department:
            typeof line.test.department === 'object' ? (line.test.department as any)._id : line.test.department,
          sampleType: line.test.sampleType || 'Whole Blood',
          sampleContainer: line.test.sampleContainer || 'EDTA Vial',
          processingMode: line.processingMode,
          outsourceLab: line.outsourceLab,
          status: 'Pending Collection',
          priority: invoice.priority,
          chiefComplaint: invoice.chiefComplaint,
          expectedAt: computeExpectedAt(line.test.turnaroundTime),
          statusHistory: [
            {
              fromStatus: 'Registered',
              toStatus: 'Pending Collection',
              updatedBy: {
                userId: currentUser?.userId,
                name: currentUser?.name,
                role: currentUser?.role ?? 'System',
              },
              timestamp: new Date(),
              notes: `Added to invoice ${invoice.invoiceNumber} on revision`,
            },
          ],
        })
      );
    }

    return {
      invoice: saved,
      samples: newSamples,
      testsAdded: addedNames,
      netBefore: rupeePrecision(netBefore),
      netAfter: rupeePrecision(newNet),
      /** What the patient owes once the revision is on the bill. */
      dueAmount: invoice.dueAmount,
    };
  }

  static async getInvoiceById(id: string) {
    const invoice = await repo.findById('invoice', id, { include: BILL_REFS });

    if (!invoice) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Invoice record not found');
    }

    const payments = await repo.find('payment', {
      where: { invoiceId: invoice._id },
      orderBy: mongoSort('payment', { createdAt: -1 }),
    });
    const samples = await repo.find('sample', { where: { invoiceId: invoice._id } });

    return {
      invoice,
      payments,
      samples,
    };
  }

  static async getByBarcode(barcode: string) {
    const invoice = await repo.findOne('invoice', { barcode: String(barcode) }, { include: BILL_REFS });

    if (!invoice) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, `No invoice found for barcode: ${barcode}`);
    }

    const payments = await repo.find('payment', {
      where: { invoiceId: invoice._id },
      orderBy: mongoSort('payment', { createdAt: -1 }),
    });
    const samples = await repo.find('sample', { where: { invoiceId: invoice._id } });

    return {
      invoice,
      payments,
      samples,
    };
  }

  /**
   * Money collected against an outstanding bill.
   *
   * Takes either one method and an amount, or `paymentSplits` when the patient
   * settled part in cash and the rest on the machine. Each leg becomes its own
   * receipt, because that is how the day reconciles - the cash against the
   * drawer, the UPI against the statement - but together they move the bill's
   * due down once.
   */
  static async addPayment(
    invoiceId: string,
    payload: {
      amount?: number;
      paymentMethod?: CollectionMethod;
      paymentSplits?: PaymentTender[];
      transactionRef?: string;
      notes?: string;
    },
    currentUser: JwtPayload
  ) {
    const invoice: any = await repo.findById('invoice', invoiceId);
    if (!invoice) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Invoice record not found');
    }

    if (invoice.dueAmount <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invoice is already fully paid');
    }

    const offered = readTenders({
      paymentSplits: payload.paymentSplits,
      paidAmount: payload.amount,
      paymentMethod: payload.paymentMethod,
    });

    // Credit can only ever arrive on its own - `readTenders` refuses it as a
    // leg of a split - so it books exactly as it always has.
    const tenders = capTenders(offered, invoice.dueAmount);
    const payAmount = rupeePrecision(tenders.reduce((sum, tender) => sum + tender.amount, 0));
    if (payAmount <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Payment amount must be greater than zero');
    }

    const rawUserId = currentUser.userId || (currentUser as any).id || (currentUser as any)._id;
    const userId = isValidObjectIdValue(rawUserId) ? rawUserId : newObjectId();

    const paymentRecords = [];
    for (const tender of tenders) {
      const receiptNumber = await getNextReceiptNumber();
      paymentRecords.push(
        await repo.create('payment', {
          receiptNumber,
          invoice: invoice._id,
          patient: invoice.patient,
          amount: tender.amount,
          paymentMethod: tender.method,
          transactionRef: tender.transactionRef || payload.transactionRef || '',
          notes:
            payload.notes ||
            (tenders.length > 1
              ? `Invoice due payment (split ${tenders.length} ways)`
              : 'Additional invoice due payment'),
          receivedBy: {
            userId,
            name: currentUser.name,
          },
        })
      );
    }

    // A bill raised before the per-method summary existed carries money but
    // no breakdown. Folding only the new tender in would file the whole bill
    // under whatever was collected last, so the money already on it is
    // seeded against the method it was filed under first.
    const priorBreakdown =
      (invoice.paymentBreakdown?.length ? invoice.paymentBreakdown : null) ||
      (invoice.paidAmount > 0 ? [{ method: invoice.paymentMethod, amount: invoice.paidAmount }] : []);

    invoice.paidAmount = rupeePrecision(invoice.paidAmount + payAmount);
    invoice.dueAmount = Math.max(0, rupeePrecision(invoice.netAmount - invoice.paidAmount));
    invoice.paymentBreakdown = mergeBreakdown(priorBreakdown as any, tenders) as any;
    invoice.paymentMethod = headlineMethod(invoice.paymentBreakdown as any, invoice.paymentMethod);

    if (invoice.dueAmount === 0) {
      invoice.paymentStatus = 'Paid';
    } else {
      invoice.paymentStatus = 'Partial';
    }

    const saved = await repo.save('invoice', invoice);

    return {
      invoice: saved,
      // The last receipt written, as the single-payment caller always got.
      paymentRecord: paymentRecords[paymentRecords.length - 1] || null,
      paymentRecords,
    };
  }
}
