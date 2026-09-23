import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';
import { amountInWords } from '../../utils/amount-in-words';
import { ageSexLabel } from '../../utils/age';
import { formatDateTime, formatDay } from '../../utils/dates';
import { methodLabel } from '../../config/payment-methods';

const money = (value: unknown) => (Number(value) || 0).toFixed(2);

const billDate = (value?: string | Date) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
};

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start leading-[14px]">
    <span className="w-[86px] shrink-0 font-bold">{label}</span>
    <span className="w-[8px] shrink-0">:</span>
    <span className="min-w-0 break-words">{value || '-'}</span>
  </div>
);

export interface PatientLedgerBillProps {
  patient: any;
  invoices: any[];
  transactions: any[];
  summary?: {
    totalBilled?: number;
    totalPaid?: number;
    totalRefunded?: number;
    balanceDue?: number;
    totalVisits?: number;
  };
  periodLabel?: string;
  centre?: CentreProfile;
}

export const PatientLedgerBill: React.FC<PatientLedgerBillProps> = ({
  patient,
  invoices = [],
  transactions = [],
  summary,
  periodLabel,
  centre = CENTRE,
}) => {
  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));

  const paymentsOnly = transactions.filter((t) => t.flow === 'INFLOW');
  const refundsOnly = transactions.filter((t) => t.flow === 'OUTFLOW');

  const computedTotalBilled = invoices.reduce((sum, inv) => sum + (inv.netAmount || 0), 0);
  const computedTotalPaid = paymentsOnly.reduce((sum, t) => sum + (t.amount || 0), 0);
  const computedTotalRefunded = refundsOnly.reduce((sum, t) => sum + (t.amount || 0), 0);
  const computedDue = Math.max(0, computedTotalBilled - computedTotalPaid + computedTotalRefunded);

  const totalBilled = summary?.totalBilled ?? computedTotalBilled;
  const totalPaid = summary?.totalPaid ?? computedTotalPaid;
  const totalRefunded = summary?.totalRefunded ?? computedTotalRefunded;
  const balanceDue = summary?.balanceDue ?? computedDue;

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
        {/* Centre Letterhead Header */}
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

        {/* Title Bar */}
        <div className="flex items-center border-b border-black bg-slate-100 px-2 py-[4px] text-[9px]">
          <span className="w-1/3 font-bold">Printed: {formatDateTime(new Date())}</span>
          <span className="w-1/3 text-center text-[13px] font-extrabold uppercase tracking-wide leading-[15px]">
            PATIENT PAYMENT LEDGER BILL
          </span>
          <span className="w-1/3 text-right font-bold">{periodLabel || 'Complete Account History'}</span>
        </div>

        {/* Patient Details Identity Block */}
        <div className="grid grid-cols-2 gap-x-4 border-b border-black px-2 py-1.5 text-[9px]">
          <div>
            <Field label="Pt. Reg. No." value={<span className="font-mono font-bold">{patient?.uhid || '-'}</span>} />
            <Field label="Pt. Name" value={<span className="font-bold">{patient?.patientName || '-'}</span>} />
            <Field label="Pt. Age / Sex" value={ageSexLabel(patient || {})} />
            <Field label="Address" value={patient?.address ? `${patient.address}, ${patient.city || ''} ${patient.pinCode || ''}` : '-'} />
          </div>
          <div>
            <Field label="Mobile No." value={<span className="font-semibold">{patient?.mobile || '-'}</span>} />
            <Field label="Centre" value={centre.processingCentre} />
            <Field label="Total Visits" value={invoices.length} />
            <Field label="Total Receipts" value={paymentsOnly.length} />
          </div>
        </div>

        {/* Summary Metric Ribbon */}
        <div className="grid grid-cols-4 border-b border-black bg-slate-50 text-center text-[9px]">
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Total Billed</span>
            <span className="font-mono text-[11px] font-bold">₹{money(totalBilled)}</span>
          </div>
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Total Paid</span>
            <span className="font-mono text-[11px] font-bold text-emerald-800">₹{money(totalPaid)}</span>
          </div>
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Refunds Issued</span>
            <span className="font-mono text-[11px] font-bold text-rose-800">₹{money(totalRefunded)}</span>
          </div>
          <div className="p-1 bg-amber-50">
            <span className="block text-[8px] font-semibold text-amber-900 uppercase">Balance Outstanding</span>
            <span className="font-mono text-[12px] font-extrabold text-red-600">₹{money(balanceDue)}</span>
          </div>
        </div>

        {/* 1. Payment Receipts Ledger Table */}
        <div className="border-b border-black px-2 py-1 bg-slate-100 text-[10px] font-bold">
          1. PAYMENT RECEIPTS LEDGER (Breakdown of every payment by Date &amp; Method)
        </div>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-black font-bold bg-slate-50">
              <th className="w-[28px] px-1 py-[3px] text-center">Sr</th>
              <th className="w-[75px] px-1 py-[3px] text-left">Date &amp; Time</th>
              <th className="w-[85px] px-1 py-[3px] text-left">Receipt No.</th>
              <th className="w-[85px] px-1 py-[3px] text-left">Bill Ref No.</th>
              <th className="w-[90px] px-1 py-[3px] text-left">Payment Method</th>
              <th className="px-1 py-[3px] text-left">Txn / Cheque Ref</th>
              <th className="w-[75px] px-1 py-[3px] text-left">Received By</th>
              <th className="w-[65px] px-1 py-[3px] text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {paymentsOnly.map((t, index) => (
              <tr key={t.id || t._id || index} className="border-b border-gray-200">
                <td className="px-1 py-[3px] text-center font-mono">{index + 1}</td>
                <td className="px-1 py-[3px]">{formatDay(t.date)}</td>
                <td className="px-1 py-[3px] font-mono font-semibold">{t.receiptNumber}</td>
                <td className="px-1 py-[3px] font-mono">{t.invoiceNumber || '-'}</td>
                <td className="px-1 py-[3px] font-semibold">{methodLabel(t.paymentMethod)}</td>
                <td className="px-1 py-[3px] text-slate-600">{t.transactionRef || t.notes || '-'}</td>
                <td className="px-1 py-[3px]">{t.handledBy || '-'}</td>
                <td className="px-1 py-[3px] text-right font-mono font-bold text-emerald-800">
                  {money(t.amount)}
                </td>
              </tr>
            ))}
            {paymentsOnly.length === 0 && (
              <tr>
                <td colSpan={8} className="px-1 py-3 text-center text-slate-500">
                  No payment collections recorded for this patient.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-y border-black font-bold bg-slate-50">
              <td colSpan={7} className="px-1 py-[3px] text-right">
                TOTAL COLLECTED:
              </td>
              <td className="px-1 py-[3px] text-right font-mono text-[10px] font-bold text-emerald-900">
                ₹{money(totalPaid)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Refunds Section (if any) */}
        {refundsOnly.length > 0 && (
          <>
            <div className="border-b border-black px-2 py-1 bg-rose-50 text-[10px] font-bold text-rose-900">
              2. REFUNDS &amp; PAYOUTS (Cash Returned / Reimbursed to Patient)
            </div>
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="border-b border-black font-bold bg-slate-50">
                  <th className="w-[28px] px-1 py-[3px] text-center">Sr</th>
                  <th className="w-[75px] px-1 py-[3px] text-left">Date</th>
                  <th className="w-[85px] px-1 py-[3px] text-left">Voucher No.</th>
                  <th className="w-[85px] px-1 py-[3px] text-left">Bill Ref</th>
                  <th className="w-[90px] px-1 py-[3px] text-left">Refund Mode</th>
                  <th className="px-1 py-[3px] text-left">Reason / Description</th>
                  <th className="w-[65px] px-1 py-[3px] text-right">Refunded (₹)</th>
                </tr>
              </thead>
              <tbody>
                {refundsOnly.map((r, idx) => (
                  <tr key={r.id || idx} className="border-b border-gray-200">
                    <td className="px-1 py-[3px] text-center">{idx + 1}</td>
                    <td className="px-1 py-[3px]">{formatDay(r.date)}</td>
                    <td className="px-1 py-[3px] font-mono">{r.receiptNumber}</td>
                    <td className="px-1 py-[3px] font-mono">{r.invoiceNumber}</td>
                    <td className="px-1 py-[3px]">{methodLabel(r.paymentMethod)}</td>
                    <td className="px-1 py-[3px]">{r.notes || 'Refund'}</td>
                    <td className="px-1 py-[3px] text-right font-mono font-bold text-rose-800">
                      {money(r.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* 2. Visits & Invoices Account Table */}
        <div className="border-b border-black px-2 py-1 bg-slate-100 text-[10px] font-bold">
          {refundsOnly.length > 0 ? '3' : '2'}. VISITS &amp; BILLS ACCOUNT (All Invoices Raised)
        </div>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-black font-bold bg-slate-50">
              <th className="w-[28px] px-1 py-[3px] text-center">Sr</th>
              <th className="w-[75px] px-1 py-[3px] text-left">Date</th>
              <th className="w-[95px] px-1 py-[3px] text-left">Bill No.</th>
              <th className="px-1 py-[3px] text-left">Referred Doctor / Tests</th>
              <th className="w-[65px] px-1 py-[3px] text-right">Net Billed</th>
              <th className="w-[65px] px-1 py-[3px] text-right">Paid</th>
              <th className="w-[65px] px-1 py-[3px] text-right">Due Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv, idx) => {
              const doc = inv.referringDoctorName || inv.referringDoctor?.doctorName || 'Self / Walk-in';
              const testNames = (inv.items || []).map((i: any) => i.testName || i.packageName).filter(Boolean).join(', ');
              return (
                <tr key={inv._id || idx} className="border-b border-gray-200">
                  <td className="px-1 py-[3px] text-center">{idx + 1}</td>
                  <td className="px-1 py-[3px]">{billDate(inv.createdAt)}</td>
                  <td className="px-1 py-[3px] font-mono font-semibold">{inv.invoiceNumber}</td>
                  <td className="px-1 py-[3px]">
                    <span className="font-semibold text-slate-800">{doc}</span>
                    {testNames && <span className="block text-[8px] text-slate-500 truncate max-w-[280px]">{testNames}</span>}
                  </td>
                  <td className="px-1 py-[3px] text-right font-mono">{money(inv.netAmount)}</td>
                  <td className="px-1 py-[3px] text-right font-mono font-semibold text-emerald-800">{money(inv.paidAmount)}</td>
                  <td className="px-1 py-[3px] text-right font-mono font-bold text-red-600">{money(inv.dueAmount)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-y border-black font-bold bg-slate-50">
              <td colSpan={4} className="px-1 py-[4px] text-right">
                ACCOUNT TOTALS:
              </td>
              <td className="px-1 py-[4px] text-right font-mono">₹{money(totalBilled)}</td>
              <td className="px-1 py-[4px] text-right font-mono text-emerald-900">₹{money(totalPaid)}</td>
              <td className="px-1 py-[4px] text-right font-mono text-red-700">₹{money(balanceDue)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer & Signature Section */}
        <div className="flex items-start justify-between gap-4 p-2 text-[9px] bg-white">
          <div className="min-w-0 max-w-sm">
            <p className="font-extrabold text-[10px] text-slate-900">
              Net Balance Outstanding: ₹{money(balanceDue)} ({amountInWords(balanceDue)})
            </p>
            <p className="text-[7.5px] leading-[10px] text-slate-500 mt-1">
              * This Patient Payment Ledger is an authorized summary of all financial transactions recorded
              between the patient and {centre.name}.
            </p>
          </div>
          <div className="flex gap-8 shrink-0 pt-6 text-center">
            <div className="w-[110px]">
              <p className="border-t border-black pt-[2px] text-[8px] font-semibold">Accountant / Cashier</p>
            </div>
            <div className="w-[120px]">
              <p className="border-t border-black pt-[2px] text-[8px] font-bold">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
