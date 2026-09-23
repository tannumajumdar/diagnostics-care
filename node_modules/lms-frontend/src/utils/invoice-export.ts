/**
 * What a bill looks like in a spreadsheet.
 *
 * The billing directory exports a window of bills and a patient's profile
 * exports that one patient's bills; both go through here so the two files have
 * the same columns in the same order. An accountant who opens one and then the
 * other is reading the same sheet, and a column added for one arrives in both.
 *
 * Money is written as a bare number, not as "₹1,200" - a formatted rupee value
 * lands in Excel as text and will not add up.
 */

import { COLLECTION_METHODS } from '../config/payment-methods';

/** `07-09-2026 01:24 PM` - the way the counter's stationery reads a bill. */
const stamp = (value?: string | Date) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = date.getHours() % 12 || 12;
  const meridiem = date.getHours() < 12 ? 'AM' : 'PM';
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(hours)}:${pad(
    date.getMinutes()
  )} ${meridiem}`;
};

const amount = (value: unknown) => Number(value || 0);

/** The doctor a bill was referred by, however the record happens to carry it. */
export const referredBy = (invoice: any) =>
  invoice?.referringDoctorName ||
  (typeof invoice?.referringDoctor === 'object' ? invoice?.referringDoctor?.doctorName : '') ||
  'Self / Walk-in';

/**
 * What came in by each method against a bill.
 *
 * Read from the bill's own summary, which the server keeps up to date as each
 * receipt is written. Bills raised before that summary existed fall back to
 * the single method they were filed under, so an old row still says how it
 * was paid rather than showing nothing.
 */
export const paymentBreakdownOf = (invoice: any): Array<{ method: string; amount: number }> => {
  const breakdown = Array.isArray(invoice?.paymentBreakdown) ? invoice.paymentBreakdown : [];
  const entries = breakdown
    .map((entry: any) => ({ method: String(entry?.method || ''), amount: Number(entry?.amount) || 0 }))
    .filter((entry: any) => entry.method && entry.amount > 0);

  if (entries.length) return entries;

  const paid = Number(invoice?.paidAmount) || 0;
  if (paid > 0 && invoice?.paymentMethod) return [{ method: invoice.paymentMethod, amount: paid }];
  return [];
};

/** `Cash ₹500 + UPI ₹700`, or just the method when a bill was paid one way. */
export const paidByLabel = (invoice: any): string => {
  const entries = paymentBreakdownOf(invoice);
  if (!entries.length) return '';
  if (entries.length === 1) return entries[0].method;
  return entries.map((entry) => `${entry.method} ${entry.amount}`).join(' + ');
};

/** One column per method the centre takes, zero where none came in by it. */
const methodColumns = (invoice: any): Record<string, number> => {
  const byMethod = new Map(paymentBreakdownOf(invoice).map((entry) => [entry.method, entry.amount]));
  return Object.fromEntries(
    COLLECTION_METHODS.map((method) => [`Paid - ${method.label}`, byMethod.get(method.value) || 0])
  );
};

/**
 * Whether a bill was run on our own benches or had anything sent out.
 *
 * One outsourced line makes the whole bill an outsourced one - that is the
 * bill the desk chases a referral lab over - so the two answers never overlap.
 * The directory's In/Out filter splits a window the same way, which is what
 * lets a filtered export hold exactly the rows that were on screen.
 */
export const processingModeOf = (invoice: any): 'In-house' | 'Outsource' | '' => {
  const items: any[] = Array.isArray(invoice?.items) ? invoice.items : [];
  if (!items.length) return '';
  return items.some((item) => item?.processingMode === 'Outsource') ? 'Outsource' : 'In-house';
};

/** The tests on a bill, joined for a single spreadsheet cell. */
export const testsOn = (invoice: any) => {
  const items: any[] = Array.isArray(invoice?.items) ? invoice.items : [];
  return items.map((item) => item.testName).filter(Boolean).join('; ');
};

/**
 * One row per bill. `items` is only populated on the detail response, so the
 * Tests column is left empty rather than wrong when the list endpoint fed the
 * rows - every other column is present either way.
 */
export const invoiceExportRows = (invoices: any[]): Record<string, any>[] =>
  (invoices || []).map((invoice) => {
    const patient = typeof invoice?.patient === 'object' && invoice?.patient ? invoice.patient : {};
    const subtotal = amount(invoice?.subtotal);
    const net = amount(invoice?.netAmount);

    return {
      'Bill Date': stamp(invoice?.createdAt),
      'Invoice No': invoice?.invoiceNumber || '',
      Barcode: invoice?.barcode || '',
      UHID: invoice?.uhid || patient?.uhid || '',
      'Patient Name': patient?.patientName || '',
      Mobile: patient?.mobile || '',
      'Referred By': referredBy(invoice),
      Tests: testsOn(invoice),
      Processing: processingModeOf(invoice),
      'Gross Amount': subtotal || net,
      // Taken from the two totals rather than from discountValue, which stores
      // a percentage discount as the percentage and not as rupees.
      Discount: Math.max(0, (subtotal || net) - net),
      'Net Amount': net,
      'Paid Amount': amount(invoice?.paidAmount),
      'Due Amount': amount(invoice?.dueAmount),
      // A bill settled half in cash and half by UPI has to reconcile against
      // both the drawer and the statement, so the split is spelled out and
      // each method gets a column of its own to total down.
      //
      // Every method is a column on every row, including the ones that
      // brought in nothing. A column that appeared only on the bills that
      // used it would be missing from the sheet whenever the first bill in
      // the window happened not to, and the rest of its figures with it.
      'Paid By': paidByLabel(invoice),
      ...methodColumns(invoice),
      'Payment Status': invoice?.paymentStatus || '',
    };
  });

/** What the totals row at the foot of an export adds up to. */
export const invoiceTotals = (invoices: any[]) =>
  (invoices || []).reduce(
    (totals, invoice) => ({
      billed: totals.billed + amount(invoice?.netAmount),
      paid: totals.paid + amount(invoice?.paidAmount),
      due: totals.due + amount(invoice?.dueAmount),
    }),
    { billed: 0, paid: 0, due: 0 }
  );
