import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';
import { amountInWords } from '../../utils/amount-in-words';
import { formatDay, formatDateTime } from '../../utils/dates';
import { methodLabel } from '../../config/payment-methods';

const money = (value: unknown) => (Number(value) || 0).toFixed(2);

/** The date is the sheet's own heading, so each row only needs its clock time. */
const timeOnly = (value?: string | Date) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
};

export interface DayCollectionPrintProps {
  /** One row of the day-wise ledger: the day's totals and method breakdown. */
  day: {
    date: string;
    collections: number;
    payouts: number;
    net: number;
    collectionCount: number;
    payoutCount: number;
    totalCount: number;
    byMethod?: Record<string, number>;
  };
  /**
   * The ledger rows already on screen. Only the ones falling on this day are
   * printed - when the filter covers a wider period the sheet still prints,
   * with the day's totals alone.
   */
  transactions?: any[];
  centre?: CentreProfile;
}

/**
 * The day's cash statement - what the cashier closes the counter with.
 *
 * The totals are the day-wise row itself, so the paper always agrees with the
 * screen. The itemised list underneath is only as complete as the rows the
 * current filter loaded, and the sheet says so rather than implying it is the
 * full day.
 */
export const DayCollectionPrint: React.FC<DayCollectionPrintProps> = ({
  day,
  transactions = [],
  centre = CENTRE,
}) => {
  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));

  const sameDay = (value: string | Date) => {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return key === day.date;
  };

  const dayRows = transactions.filter((t) => t?.date && sameDay(t.date));
  const listedAll = dayRows.length === day.totalCount;

  const methods = Object.entries(day.byMethod || {});

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
            DAILY COLLECTION STATEMENT
          </span>
          <span className="w-1/3 text-right font-bold">{formatDay(day.date)}</span>
        </div>

        {/* Summary Metric Ribbon */}
        <div className="grid grid-cols-4 border-b border-black bg-slate-50 text-center text-[9px]">
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Collections (Inflow)</span>
            <span className="font-mono text-[11px] font-bold text-emerald-800">₹{money(day.collections)}</span>
            <span className="block text-[7.5px] text-slate-500">
              {day.collectionCount} receipt{day.collectionCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Payouts &amp; Refunds</span>
            <span className="font-mono text-[11px] font-bold text-rose-800">₹{money(day.payouts)}</span>
            <span className="block text-[7.5px] text-slate-500">
              {day.payoutCount} payout{day.payoutCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Total Entries</span>
            <span className="font-mono text-[11px] font-bold">{day.totalCount}</span>
          </div>
          <div className="p-1 bg-amber-50">
            <span className="block text-[8px] font-semibold text-amber-900 uppercase">Net Cash In Hand</span>
            <span className="font-mono text-[12px] font-extrabold">₹{money(day.net)}</span>
          </div>
        </div>

        {/* 1. Collections by payment method */}
        <div className="border-b border-black px-2 py-1 bg-slate-100 text-[10px] font-bold">
          1. COLLECTIONS BY PAYMENT METHOD
        </div>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-black font-bold bg-slate-50">
              <th className="w-[28px] px-1 py-[3px] text-center">Sr</th>
              <th className="px-1 py-[3px] text-left">Payment Method</th>
              <th className="w-[110px] px-1 py-[3px] text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {methods.length > 0 ? (
              methods.map(([method, amount], index) => (
                <tr key={method} className="border-b border-gray-200">
                  <td className="px-1 py-[3px] text-center font-mono">{index + 1}</td>
                  <td className="px-1 py-[3px] font-semibold">{methodLabel(method)}</td>
                  <td className="px-1 py-[3px] text-right font-mono font-bold text-emerald-800">
                    {money(amount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-1 py-3 text-center text-slate-500">
                  No collections recorded on this day.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-y border-black font-bold bg-slate-50">
              <td colSpan={2} className="px-1 py-[3px] text-right">
                TOTAL COLLECTED:
              </td>
              <td className="px-1 py-[3px] text-right font-mono text-[10px] font-bold text-emerald-900">
                ₹{money(day.collections)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* 2. Itemised entries for the day */}
        <div className="border-y border-black px-2 py-1 bg-slate-100 text-[10px] font-bold">
          2. LEDGER ENTRIES FOR {formatDay(day.date).toUpperCase()}
          {!listedAll && (
            <span className="ml-1 text-[8px] font-semibold text-slate-600">
              (showing {dayRows.length} of {day.totalCount} entries loaded under the current filter)
            </span>
          )}
        </div>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-black font-bold bg-slate-50">
              <th className="w-[28px] px-1 py-[3px] text-center">Sr</th>
              <th className="w-[75px] px-1 py-[3px] text-left">Time</th>
              <th className="w-[85px] px-1 py-[3px] text-left">Receipt / Ref</th>
              <th className="px-1 py-[3px] text-left">Party / Patient</th>
              <th className="w-[85px] px-1 py-[3px] text-left">Method</th>
              <th className="w-[75px] px-1 py-[3px] text-left">Handled By</th>
              <th className="w-[65px] px-1 py-[3px] text-right">Inflow (₹)</th>
              <th className="w-[65px] px-1 py-[3px] text-right">Outflow (₹)</th>
            </tr>
          </thead>
          <tbody>
            {dayRows.length > 0 ? (
              dayRows.map((t, index) => {
                const isInflow = t.flow === 'INFLOW';
                return (
                  <tr key={t.id || index} className="border-b border-gray-200">
                    <td className="px-1 py-[3px] text-center font-mono">{index + 1}</td>
                    <td className="px-1 py-[3px]">{timeOnly(t.date)}</td>
                    <td className="px-1 py-[3px] font-mono font-semibold">{t.receiptNumber || '-'}</td>
                    <td className="px-1 py-[3px]">
                      <span className="font-semibold">{t.partyName}</span>
                      {t.partyUhid && <span className="ml-1 text-[8px] text-slate-500">({t.partyUhid})</span>}
                    </td>
                    <td className="px-1 py-[3px]">{methodLabel(t.paymentMethod)}</td>
                    <td className="px-1 py-[3px]">{t.handledBy || '-'}</td>
                    <td className="px-1 py-[3px] text-right font-mono font-bold text-emerald-800">
                      {isInflow ? money(t.amount) : '-'}
                    </td>
                    <td className="px-1 py-[3px] text-right font-mono font-bold text-rose-800">
                      {!isInflow ? money(t.amount) : '-'}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-1 py-3 text-center text-slate-500">
                  Itemised entries for this day are not loaded under the current filter - the day's totals above
                  remain complete.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-y border-black font-bold bg-slate-50">
              <td colSpan={6} className="px-1 py-[4px] text-right">
                DAY TOTALS:
              </td>
              <td className="px-1 py-[4px] text-right font-mono text-emerald-900">₹{money(day.collections)}</td>
              <td className="px-1 py-[4px] text-right font-mono text-rose-900">₹{money(day.payouts)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer & Signature Section */}
        <div className="flex items-start justify-between gap-4 p-2 text-[9px] bg-white">
          <div className="min-w-0 max-w-sm">
            <p className="font-extrabold text-[10px] text-slate-900">
              Net Cash In Hand: ₹{money(day.net)} ({amountInWords(Number(day.net) || 0)})
            </p>
            <p className="text-[7.5px] leading-[10px] text-slate-500 mt-1">
              * Day-end collection statement generated from the payment ledger of {centre.name}.
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

export default DayCollectionPrint;
