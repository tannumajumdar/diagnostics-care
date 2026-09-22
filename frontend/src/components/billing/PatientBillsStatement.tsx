import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';
import { amountInWords } from '../../utils/amount-in-words';
import { ageSexLabel } from '../../utils/age';
import { invoiceTotals, paidByLabel, referredBy, testsOn } from '../../utils/invoice-export';

/**
 * One patient's billing statement.
 *
 * Not a bill - a bill is a single visit, and `BillPrint` already prints that.
 * This is the account: every bill the patient has been raised, oldest to
 * newest, with what was charged, what was collected and what is still owed at
 * the foot. The desk hands it over when a patient asks what they have paid
 * across their visits, and insurers and employers ask for the same sheet.
 *
 * It prints on the centre's letterhead so it stands on its own once it leaves
 * the counter. Screen furniture stays out - this component prints.
 */

const money = (value: unknown) => (Number(value) || 0).toFixed(2);

/** `07-09-2026`, the way the counter's stationery reads a date. */
const billDate = (value?: string | Date) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

/** A labelled line in the identity block. */
const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start leading-[14px]">
    <span className="w-[86px] shrink-0 font-bold">{label}</span>
    <span className="w-[8px] shrink-0">:</span>
    <span className="min-w-0 break-words">{value || '-'}</span>
  </div>
);

export interface PatientBillsStatementProps {
  patient: any;
  /** The patient's bills, newest first as the API returns them. */
  invoices: any[];
  /** Shown under the heading when the desk printed a filtered window. */
  periodLabel?: string;
  centre?: CentreProfile;
}

export const PatientBillsStatement: React.FC<PatientBillsStatementProps> = ({
  patient,
  invoices,
  periodLabel,
  centre = CENTRE,
}) => {
  // A statement reads forwards - the account opens at the first visit and the
  // balance at the foot is what is owed today.
  const rows = [...(invoices || [])].sort(
    (a, b) => new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime()
  );
  const totals = invoiceTotals(rows);

  // Until the centre drops its artwork into `frontend/public` this is a
  // missing file, and an empty box on a letterhead looks like a printing
  // fault - so a failed load drops the cell entirely.
  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));

  const mailLine = contactLine([
    ['Mail-ID', centre.email],
    ['WebSite', centre.website],
  ]);
  const phoneLine = contactLine([
    ['Ph No.', centre.phones],
    ['Mob No.', centre.mobiles],
  ]);

  return (
    <div className="bill-sheet bg-white font-sans text-black">
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
            {mailLine && <p className="text-[8px] leading-[10px]">{mailLine}</p>}
            {phoneLine && <p className="text-[8px] leading-[10px]">{phoneLine}</p>}
          </div>
        </div>

        <div className="flex items-center border-b border-black px-2 py-[3px] text-[9px]">
          <span className="w-1/3 font-bold">Printed : {billDate(new Date())}</span>
          <span className="w-1/3 text-center text-[13px] font-bold leading-[15px]">BILLING STATEMENT</span>
          <span className="w-1/3 text-right font-bold">{periodLabel || 'All bills'}</span>
        </div>

        {/* Who the account belongs to */}
        <div className="grid grid-cols-2 gap-x-4 border-b border-black px-2 py-1 text-[9px]">
          <div>
            <Field label="Pt. Reg. No." value={patient?.uhid} />
            <Field label="Pt. Name" value={<span className="font-bold">{patient?.patientName}</span>} />
            <Field label="Pt. Age / Sex" value={ageSexLabel(patient || {})} />
          </div>
          <div>
            <Field label="Mobile No." value={patient?.mobile} />
            <Field label="Centre" value={centre.processingCentre} />
            <Field label="Total Bills" value={rows.length} />
          </div>
        </div>

        {/* The account, one line per bill */}
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-black font-bold">
              <th className="w-[30px] px-1 py-[3px] text-left">Sr</th>
              <th className="w-[68px] px-1 py-[3px] text-left">Date</th>
              <th className="w-[92px] px-1 py-[3px] text-left">Bill No.</th>
              <th className="px-1 py-[3px] text-left">Tests / Referred By</th>
              <th className="w-[76px] px-1 py-[3px] text-left">Paid By</th>
              <th className="w-[58px] px-1 py-[3px] text-right">Net</th>
              <th className="w-[58px] px-1 py-[3px] text-right">Paid</th>
              <th className="w-[58px] px-1 py-[3px] text-right">Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((invoice, index) => {
              const tests = testsOn(invoice);
              return (
                <tr key={invoice?._id || invoice?.id || index} className="border-b border-gray-300 align-top">
                  <td className="px-1 py-[3px] text-center">{index + 1}</td>
                  <td className="px-1 py-[3px]">{billDate(invoice?.createdAt)}</td>
                  <td className="px-1 py-[3px]">{invoice?.invoiceNumber || '-'}</td>
                  <td className="px-1 py-[3px]">
                    {/* The tests are only on the record when the bill carries
                        its lines; the referral is always known, so the column
                        still identifies the visit either way. */}
                    {tests || '-'}
                    <span className="block text-[7px] leading-[9px]">Ref. Dr. : {referredBy(invoice)}</span>
                  </td>
                  {/* A bill settled two ways reads "Cash 500 + UPI 700", so
                      the patient's own copy says where each part went. */}
                  <td className="px-1 py-[3px]">{paidByLabel(invoice) || '-'}</td>
                  <td className="px-1 py-[3px] text-right">{money(invoice?.netAmount)}</td>
                  <td className="px-1 py-[3px] text-right">{money(invoice?.paidAmount)}</td>
                  <td className="px-1 py-[3px] text-right">{money(invoice?.dueAmount)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-1 py-3 text-center">
                  No bills have been raised for this patient.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-y border-black font-bold">
              <td className="px-1 py-[4px] text-right" colSpan={5}>
                TOTAL
              </td>
              <td className="px-1 py-[4px] text-right">{money(totals.billed)}</td>
              <td className="px-1 py-[4px] text-right">{money(totals.paid)}</td>
              <td className="px-1 py-[4px] text-right">{money(totals.due)}</td>
            </tr>
          </tfoot>
        </table>

        {/* The balance, spelled out - the figure the patient is asked for. */}
        <div className="flex items-start justify-between gap-4 px-2 py-[5px] text-[9px]">
          <div className="min-w-0">
            <p className="font-bold">
              Balance Outstanding : {money(totals.due)} ({amountInWords(totals.due)})
            </p>
            <p className="text-[8px] leading-[10px]">
              This statement is a record of billing only and is not a receipt for any single payment.
            </p>
          </div>
          <div className="w-[150px] shrink-0 pt-6 text-center">
            <p className="border-t border-black pt-[2px] text-[8px]">Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
};
