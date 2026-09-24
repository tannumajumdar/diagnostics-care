import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';
import { amountInWords } from '../../utils/amount-in-words';
import { formatDateTime } from '../../utils/dates';
import { methodLabel } from '../../config/payment-methods';

const money = (value: unknown) => (Number(value) || 0).toFixed(2);

export interface PatientsLedgerPrintProps {
  /** One ledger response per patient - its patient, patientSummary and transactions. */
  bills: any[];
  /** Human-readable lines describing the filters in force, e.g. "Period: ...". */
  filterLines: string[];
  centre?: CentreProfile;
}

/**
 * Every patient in the filtered ledger on one continuous statement - a single
 * letterhead, then each patient's receipts and refunds with a subtotal, and
 * the grand total across all of them at the end.
 */
export const PatientsLedgerPrint: React.FC<PatientsLedgerPrintProps> = ({
  bills,
  filterLines,
  centre = CENTRE,
}) => {
  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));

  const rows = bills.map((bill) => {
    const transactions: any[] = [...(bill.transactions || [])].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    const collected = transactions
      .filter((t) => t.flow === 'INFLOW')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const refunded = transactions
      .filter((t) => t.flow === 'OUTFLOW')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    return {
      patient: bill.patient || {},
      due: Number(bill.patientSummary?.balanceDue) || 0,
      transactions,
      collected,
      refunded,
    };
  });

  const totalCollected = rows.reduce((sum, r) => sum + r.collected, 0);
  const totalRefunded = rows.reduce((sum, r) => sum + r.refunded, 0);
  const totalDue = rows.reduce((sum, r) => sum + r.due, 0);
  const totalEntries = rows.reduce((sum, r) => sum + r.transactions.length, 0);
  const net = totalCollected - totalRefunded;

  const mailLine = contactLine([
    ['Mail-ID', centre.email],
    ['WebSite', centre.website],
  ]);
  const phoneLine = contactLine([
    ['Ph No.', centre.phones],
    ['Mob No.', centre.mobiles],
  ]);

  const cell = 'px-1.5 py-[3px]';

  return (
    <div className="report-sheet bg-white font-sans text-black">
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
            PATIENT-WISE LEDGER
          </span>
          <span className="w-1/3 text-right font-bold">
            {rows.length} patient{rows.length === 1 ? '' : 's'} · {totalEntries} entries
          </span>
        </div>

        {/* Filters in force */}
        {filterLines.length > 0 && (
          <div className="border-b border-black px-2 py-1 text-[8.5px] leading-[12px]">
            {filterLines.map((line) => (
              <span key={line} className="mr-4 inline-block">
                {line}
              </span>
            ))}
          </div>
        )}

        {/* All patients, one after another */}
        <table className="w-full border-collapse text-[8.5px]">
          <thead>
            <tr className="border-b border-black bg-slate-50 font-bold">
              <th className={`${cell} text-left`}>Receipt / Ref</th>
              <th className={`${cell} text-left`}>Bill No.</th>
              <th className={`${cell} text-left`}>Method</th>
              <th className={`${cell} text-left`}>Handled By</th>
              <th className={`${cell} text-right`}>Received (₹)</th>
              <th className={`${cell} text-right`}>Refund (₹)</th>
            </tr>
          </thead>
          {rows.map((r, i) => (
            <tbody key={r.patient.id || r.patient._id || i} style={{ breakInside: 'avoid' }}>
              <tr className="border-t border-black bg-slate-100 font-bold">
                <td className={cell} colSpan={6}>
                  {i + 1}. {r.patient.patientName || 'Patient'}
                  {r.patient.uhid ? `  |  UHID: ${r.patient.uhid}` : ''}
                  {r.patient.mobile ? `  |  Mob: ${r.patient.mobile}` : ''}
                </td>
              </tr>
              {r.transactions.map((t: any) => (
                <tr key={t.id} className="border-t border-slate-300">
                  <td className={cell}>{t.receiptNumber || '-'}</td>
                  <td className={cell}>{t.invoiceNumber || '-'}</td>
                  <td className={cell}>{methodLabel(t.paymentMethod)}</td>
                  <td className={cell}>{t.handledBy || '-'}</td>
                  <td className={`${cell} text-right font-mono`}>
                    {t.flow === 'INFLOW' ? money(t.amount) : ''}
                  </td>
                  <td className={`${cell} text-right font-mono`}>
                    {t.flow === 'OUTFLOW' ? money(t.amount) : ''}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-400 font-semibold">
                <td className={`${cell} text-right`} colSpan={4}>
                  Subtotal{r.due > 0 ? `  (Balance Due: ₹${money(r.due)})` : ''}
                </td>
                <td className={`${cell} text-right font-mono`}>{money(r.collected)}</td>
                <td className={`${cell} text-right font-mono`}>{r.refunded ? money(r.refunded) : '-'}</td>
              </tr>
            </tbody>
          ))}
          <tfoot>
            <tr className="border-y border-black bg-slate-50 font-bold">
              <td className={`${cell} text-right`} colSpan={4}>
                GRAND TOTAL ({rows.length} patient{rows.length === 1 ? '' : 's'})
              </td>
              <td className={`${cell} text-right font-mono`}>{money(totalCollected)}</td>
              <td className={`${cell} text-right font-mono`}>{money(totalRefunded)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="px-2 py-1.5 text-[9px] leading-[13px]">
          <p className="font-bold">
            Net Received: ₹{money(net)} ({amountInWords(net)})
          </p>
          {totalDue > 0 && <p className="font-bold">Total Balance Outstanding: ₹{money(totalDue)}</p>}
        </div>
      </div>
    </div>
  );
};

export default PatientsLedgerPrint;
