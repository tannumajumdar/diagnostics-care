import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';
import { amountInWords } from '../../utils/amount-in-words';
import { ageSexLabel } from '../../utils/age';
import { paymentBreakdownOf } from '../../utils/invoice-export';
import { BarcodeGenerator } from './BarcodeGenerator';

/**
 * The printed bill.
 *
 * Laid out to match the counter's existing stationery: the centre's
 * letterhead, the patient block, the tests with their department and code,
 * the totals with the amount in words, and - below the tear line - the lab's
 * own copy carrying the sample barcode instead of the receipt number. The
 * front desk hands the top half to the patient and the bottom half travels
 * with the sample, which is why both halves repeat the identity block.
 *
 * Everything on it is data the invoice already holds; nothing here is typed
 * twice. Screen furniture stays out - this component prints.
 */

const money = (value: unknown) => (Number(value) || 0).toFixed(2);

/** `07-09-2026 / 01:24 PM`, the way the stationery has always shown it. */
const billDateTime = (value?: string | Date) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = d.getHours() % 12 || 12;
  const meridiem = d.getHours() < 12 ? 'AM' : 'PM';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} / ${pad(hours)}:${pad(
    d.getMinutes()
  )} ${meridiem}`;
};

/** The trailing digits of an id - what the counter reads out over the phone. */
const shortNumber = (value?: string) => {
  const digits = String(value || '').replace(/\D/g, '').replace(/^0+/, '');
  return digits || String(value || '-');
};

/** A labelled line in the identity block. */
const Field: React.FC<{ label: string; value?: React.ReactNode; labelWidth?: string }> = ({
  label,
  value,
  labelWidth = 'w-[84px]',
}) => (
  <div className="flex items-start leading-[14px]">
    <span className={`${labelWidth} shrink-0 font-bold`}>{label}</span>
    <span className="w-[8px] shrink-0">:</span>
    <span className="min-w-0 break-words">{value || '-'}</span>
  </div>
);

export interface BillPrintProps {
  invoice: any;
  /** Newest first, as the API returns them - the top one is this bill's receipt. */
  payments?: any[];
  centre?: CentreProfile;
}

export const BillPrint: React.FC<BillPrintProps> = ({ invoice, payments = [], centre = CENTRE }) => {
  const patient = typeof invoice?.patient === 'object' && invoice?.patient ? invoice.patient : {};
  const items: any[] = Array.isArray(invoice?.items) ? invoice.items : [];

  const referredBy =
    (typeof invoice?.referringDoctor === 'object' ? invoice?.referringDoctor?.doctorName : '') ||
    invoice?.referringDoctorName ||
    'Self / Walk-in';

  const subtotal = Number(invoice?.subtotal ?? 0);
  const netAmount = Number(invoice?.netAmount ?? 0);
  // Taken from the two totals rather than from discountValue: a percentage
  // discount is stored as the percentage, and the bill has to show rupees.
  const discountAmount = Math.max(0, subtotal - netAmount);
  // Who the concession came through, when there was one. Printed so the
  // patient's own copy says whose reference the rate was given on.
  const discountThrough =
    discountAmount > 0
      ? (typeof invoice?.discountDoctor === 'object' ? invoice?.discountDoctor?.doctorName : '') ||
        invoice?.discountDoctorName ||
        ''
      : '';

  const paidAmount = Number(invoice?.paidAmount ?? 0);
  const dueAmount = Number(invoice?.dueAmount ?? 0);

  const receiptNumber = payments[0]?.receiptNumber || '-';
  /** What came in by each method - one entry for a bill settled one way. */
  const tenders = paymentBreakdownOf(invoice);
  const registrationNo = invoice?.uhid || patient?.uhid || '-';

  // Until the centre drops its artwork into `frontend/public`, these are
  // missing files. A bill with an empty box where the QR should be invites a
  // patient to scan nothing, so a failed load drops the cell entirely.
  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));
  const [qrShown, setQrShown] = useState(Boolean(centre.upiQrUrl));

  const mailLine = contactLine([
    ['Mail-ID', centre.email],
    ['WebSite', centre.website],
  ]);
  const phoneLine = contactLine([
    ['Ph No.', centre.phones],
    ['Mob No.', centre.mobiles],
  ]);

  /** The identity block, repeated on both halves of the sheet. */
  const IdentityBlock: React.FC<{ variant: 'bill' | 'lab' }> = ({ variant }) => (
    <div className="grid grid-cols-2 gap-x-4 px-2 py-1 text-[9px]">
      <div>
        <Field label="Pt. Reg. No." value={registrationNo} />
        <Field label="Pt. Name" value={<span className="font-bold">{patient?.patientName}</span>} />
        <Field label="Ref. Dr." value={referredBy} />
        <Field label="Pt. Age / Sex" value={ageSexLabel(patient)} />
        <Field label="Centre" value={centre.processingCentre} />
      </div>
      <div>
        <Field label="Bill No." value={invoice?.invoiceNumber} labelWidth="w-[80px]" />
        <Field label="Bill Date / Time" value={billDateTime(invoice?.createdAt)} labelWidth="w-[80px]" />
        <Field label="Mobile No." value={patient?.mobile} labelWidth="w-[80px]" />
        {variant === 'bill' ? (
          <Field label="Receipt No." value={receiptNumber} labelWidth="w-[80px]" />
        ) : (
          <Field label="Barcode No." value={shortNumber(invoice?.barcode)} labelWidth="w-[80px]" />
        )}
        <Field label="Lab No" value={shortNumber(invoice?.invoiceNumber)} labelWidth="w-[80px]" />
      </div>
    </div>
  );

  /** The tests. The lab's copy heads the money column differently. */
  const ItemsTable: React.FC<{ variant: 'bill' | 'lab' }> = ({ variant }) => (
    <table className="w-full border-collapse text-[9px]">
      <thead>
        <tr className="border-y border-black font-bold">
          <th className="w-[36px] px-1 py-[3px] text-left">Sr No.</th>
          <th className="w-[110px] px-1 py-[3px] text-left">Department</th>
          <th className="w-[70px] px-1 py-[3px] text-left">Test Code</th>
          <th className="px-1 py-[3px] text-left">Test Name</th>
          <th className="w-[60px] px-1 py-[3px] text-right">Rate</th>
          <th className="w-[64px] px-1 py-[3px] text-right">{variant === 'lab' ? 'TOT-AMT' : 'Total'}</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => (
          <tr key={item._id || `${item.testCode}-${index}`} className={variant === 'lab' ? 'h-[22px]' : ''}>
            <td className="px-1 py-[2px] text-center">{index + 1}</td>
            <td className="px-1 py-[2px] uppercase">{item.departmentName || '-'}</td>
            <td className="px-1 py-[2px]">{item.testCode}</td>
            <td className="px-1 py-[2px]">
              {item.testName}
              {/* The package a line was sold inside, and - on the copy that
                  travels with the sample - where the sample is actually
                  going. The bench has to know before the vial is racked. */}
              {item.packageName ? ` (${item.packageName})` : ''}
              {variant === 'lab' && item.processingMode === 'Outsource' && (
                <span className="ml-1 font-bold">
                  [OUT{item.outsourceLab ? ` - ${item.outsourceLab}` : ''}]
                </span>
              )}
            </td>
            <td className="px-1 py-[2px] text-right">{money(item.rate)}</td>
            <td className="px-1 py-[2px] text-right">{money(item.netAmount ?? item.rate)}</td>
          </tr>
        ))}
        {items.length === 0 && (
          <tr>
            <td colSpan={6} className="px-1 py-2 text-center">
              No tests billed on this invoice.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );

  return (
    <div className="bill-sheet bg-white font-sans text-black">
      {/* ---------------- The patient's copy ---------------- */}
      <div className="border border-black">
        {/* The band keeps a fixed height and a logo cell of its own whether or
            not artwork is configured: the centre prints on its own letterhead,
            and a header that collapsed with no logo set would move every line
            below it the day `logo.png` is dropped into `frontend/public`. */}
        <div className="flex min-h-[86px] items-stretch border-b border-black">
          <div className="flex w-[120px] shrink-0 flex-col items-center justify-center border-r border-black px-1 py-1 text-center">
            {logoShown && (
              <img
                src={centre.logoUrl}
                alt=""
                className="max-h-[62px] max-w-full object-contain"
                onError={() => setLogoShown(false)}
              />
            )}
            {centre.tagline && <span className="mt-[2px] text-[6px] leading-[7px]">{centre.tagline}</span>}
            {centre.unitLine && <span className="text-[6px] leading-[7px]">{centre.unitLine}</span>}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1">
            <p className="text-[13px] font-bold leading-[15px]">{centre.name}</p>
            {centre.address && <p className="text-[8px] leading-[10px]">{centre.address}</p>}
            {/* Each contact line is left off entirely when nothing is set for
                it, rather than printing an empty or placeholder number the
                patient would try to ring. */}
            {mailLine && <p className="text-[8px] leading-[10px]">{mailLine}</p>}
            {phoneLine && <p className="text-[8px] leading-[10px]">{phoneLine}</p>}
          </div>
        </div>

        {/* The body sits to the left of the barcode strip, which runs the full
            height of it - the same edge the counter staples. */}
        <div className="flex min-h-[224px] items-stretch">
          <div className="min-w-0 flex-1">
            {/* The reporting line, the word BILL, and the enquiry numbers */}
            <div className="flex items-center border-b border-black px-2 py-[3px] text-[9px]">
              <span className="w-1/3 font-bold">Reporting Time :</span>
              <span className="w-1/3 text-center text-[15px] font-bold leading-[17px]">BILL</span>
              {/* This visit's own number. A returning patient quotes it to ask
                  about this draw specifically - their UHID covers every visit
                  they have ever made and cannot identify one. */}
              <span className="w-1/3 text-right font-bold leading-[11px]">
                Reporting Enquery No. :
                <br />
                {invoice?.enquiryNo || '-'}
              </span>
            </div>

            <IdentityBlock variant="bill" />

            <ItemsTable variant="bill" />
          </div>

          {/* Turned on its side so a full id fits at a width a scanner can
              still read - the bench scans this to pull the bill up. */}
          <div className="relative w-[54px] shrink-0 border-l border-black">
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 rotate-90 flex-col items-center">
              <BarcodeGenerator value={invoice?.barcode || invoice?.invoiceNumber || ''} height={28} />
              <p className="whitespace-nowrap text-[6px] leading-[7px]">{invoice?.barcode}</p>
            </div>
          </div>
        </div>

        {/* The totals, with the QR the patient scans to pay */}
        <div className="flex items-stretch border-t border-black">
          {qrShown && (
            <div className="flex w-[100px] shrink-0 flex-col items-center justify-center border-r border-black p-1">
              <img
                src={centre.upiQrUrl}
                alt=""
                className="h-[72px] w-[72px] object-contain"
                onError={() => setQrShown(false)}
              />
            </div>
          )}

          <div className="min-w-0 flex-1 p-1 text-[9px]">
            <div className="flex gap-2">
              <div className="w-[120px] shrink-0">
                <p className="font-bold">In Words -</p>
                <p className="leading-[11px]">{amountInWords(netAmount)}</p>
              </div>

              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-2 gap-x-3">
                  <Field label="Total Amount" value={money(subtotal)} labelWidth="w-[92px]" />
                  <Field label="Discount Amount" value={money(discountAmount)} labelWidth="w-[92px]" />
                  <Field label="Total Bill Amount" value={money(netAmount)} labelWidth="w-[92px]" />
                  <Field label="Total Paid" value={money(paidAmount)} labelWidth="w-[92px]" />
                  {/* A patient who paid part in cash and the rest by UPI is
                      handed a bill that says so - one figure under a single
                      method sends them back to the counter to ask. */}
                  <Field
                    label="Paid By"
                    value={tenders.map((t) => `${t.method} ${money(t.amount)}`).join(' + ') || '-'}
                    labelWidth="w-[92px]"
                  />
                  <Field label="Balance Amount" value={money(dueAmount)} labelWidth="w-[92px]" />
                  {discountThrough && (
                    <Field label="Discount Through" value={discountThrough} labelWidth="w-[92px]" />
                  )}
                </div>
                {centre.upiPayeeLine && (
                  <p className="mt-[2px] border-t border-black pt-[2px] text-right text-[8px] font-bold">
                    {centre.upiPayeeLine}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-black px-2 py-[3px] text-[9px] font-bold">
          <span>{qrShown ? 'SCAN TO PAY' : centre.upiPayeeLine}</span>
          <span className="font-normal">{centre.poweredByLine}</span>
          <span>{invoice?.paymentMethod || 'Cash'} Sign.</span>
        </div>

        <p className="border-t border-black py-[2px] text-center text-[7px]">{centre.collectionNote}</p>
      </div>

      {/* ---------------- The tear line ---------------- */}
      <div className="my-[6px] border-t border-dashed border-black" />

      {/* ---------------- The lab's copy ---------------- */}
      <div className="border border-black">
        <IdentityBlock variant="lab" />

        <ItemsTable variant="lab" />

        <div className="flex justify-end border-y border-black px-2 py-[3px] text-[9px] font-bold">
          <span>Total Amount&nbsp;&nbsp;:&nbsp;&nbsp;{money(netAmount)}</span>
        </div>

        {/* The bench writes on this space - readings, a rejection, a repeat. */}
        <div className="min-h-[220px]" />

        <div className="flex items-center justify-between border-t border-black px-2 py-[3px] text-[9px]">
          <span>Pathology Technician</span>
          <span>{centre.poweredByLine}</span>
        </div>
      </div>
    </div>
  );
};

export default BillPrint;
