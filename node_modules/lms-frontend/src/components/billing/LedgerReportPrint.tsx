import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';
import { amountInWords } from '../../utils/amount-in-words';
import { formatDay, formatDateTime } from '../../utils/dates';
import { methodLabel } from '../../config/payment-methods';

const money = (value: unknown) => (Number(value) || 0).toFixed(2);

export interface LedgerReportPrintProps {
  /** The overall totals for the whole filtered period. */
  summary: {
    totalCollections: number;
    totalPayouts: number;
    netBalance: number;
    totalCount: number;
    collectionCount: number;
    payoutCount: number;
  };
  /** Day-wise rows for the whole filtered period. */
  byDay: any[];
  /** Ledger entries to itemise - ideally every entry under the filter. */
  transactions: any[];
  /** Human-readable lines describing the filters in force, e.g. "Period: ...". */
  filterLines: string[];
  centre?: CentreProfile;
}

/**
 * The overall ledger report - summary, method and type breakdowns, day-wise
 * cash flow and the itemised entries for whatever the ledger filter covers.
 *
 * The totals come from the server's summary, so they are complete even if the
 * itemised list is not; the sheet says so when fewer rows were loaded.
 */
export const LedgerReportPrint: React.FC<LedgerReportPrintProps> = ({
  summary,
  byDay,
  transactions,
  filterLines,
  centre = CENTRE,
}) => {
  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));

  const listedAll = transactions.length >= summary.totalCount;

  // Collections by method across every day in the period.
  const methodTotals = new Map<string, number>();
  byDay.forEach((d) => {
    Object.entries(d.byMethod || {}).forEach(([m, amt]) => {
      methodTotals.set(m, (methodTotals.get(m) || 0) + (Number(amt) || 0));
    });
  });
  const methods = Array.from(methodTotals.entries()).sort((a, b) => b[1] - a[1]);

  // Entries grouped by type (Patient Collection, Doctor Payout, Refund ...).
  const typeTotals = new Map<string, { flow: string; count: number; amount: number }>();
  transactions.forEach((t) => {
    const key = t.type || 'Other';
    const row = typeTotals.get(key) || { flow: t.flow, count: 0, amount: 0 };
    row.count++;
    row.amount += Number(t.amount) || 0;
    typeTotals.set(key, row);
  });
  const types = Array.from(typeTotals.entries()).sort((a, b) =>
    a[1].flow === b[1].flow ? b[1].amount - a[1].amount : a[1].flow === 'INFLOW' ? -1 : 1
  );

  const days = [...byDay].sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const mailLine = contactLine([
    ['Mail-ID', centre.email],
    ['WebSite', centre.website],
  ]);
  const phoneLine = contactLine([
    ['Ph No.', centre.phones],
    ['Mob No.', centre.mobiles],
  ]);

  const sectionHead = 'border-y border-black px-2 py-1 bg-slate-100 text-[10px] font-bold';
  const headRow = 'border-b border-black font-bold bg-slate-50';
  const footRow = 'border-y border-black font-bold bg-slate-50';

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
            PAYMENT LEDGER REPORT
          </span>
          <span className="w-1/3 text-right font-bold">{summary.totalCount} entries</span>
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

        {/* Summary Metric Ribbon */}
        <div className="grid grid-cols-4 border-b border-black bg-slate-50 text-center text-[9px]">
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Collections (Inflow)</span>
            <span className="font-mono text-[11px] font-bold text-emerald-800">₹{money(summary.totalCollections)}</span>
            <span className="block text-[7.5px] text-slate-500">
              {summary.collectionCount} receipt{summary.collectionCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Payouts &amp; Refunds</span>
            <span className="font-mono text-[11px] font-bold text-rose-800">₹{money(summary.totalPayouts)}</span>
            <span className="block text-[7.5px] text-slate-500">
              {summary.payoutCount} payout{summary.payoutCount === 1 ? '' : 's'}
            </span>
          </div>
          <div className="border-r border-black p-1">
            <span className="block text-[8px] font-semibold text-slate-600 uppercase">Total Entries</span>
            <span className="font-mono text-[11px] font-bold">{summary.totalCount}</span>
            <span className="block text-[7.5px] text-slate-500">
              {days.length} day{days.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="p-1 bg-amber-50">
            <span className="block text-[8px] font-semibold text-amber-900 uppercase">Net Cash Flow</span>
            <span className="font-mono text-[12px] font-extrabold">₹{money(summary.netBalance)}</span>
          </div>
        </div>

        {/* 1. Collections by method + 2. Entries by type, side by side */}
        <div className="grid grid-cols-2 border-b border-black" style={{ breakInside: 'avoid' }}>
          <div className="border-r border-black">
            <div className="border-b border-black px-2 py-1 bg-slate-100 text-[10px] font-bold">
              1. COLLECTIONS BY PAYMENT METHOD
            </div>
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className={headRow}>
                  <th className="w-[24px] px-1 py-[3px] text-center">Sr</th>
                  <th className="px-1 py-[3px] text-left">Method</th>
                  <th className="w-[90px] px-1 py-[3px] text-right">Amount (₹)</th>
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
                      No collections in this period.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className={footRow}>
                  <td colSpan={2} className="px-1 py-[3px] text-right">
                    TOTAL:
                  </td>
                  <td className="px-1 py-[3px] text-right font-mono text-emerald-900">
                    ₹{money(summary.totalCollections)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div>
            <div className="border-b border-black px-2 py-1 bg-slate-100 text-[10px] font-bold">
              2. ENTRIES BY TYPE
            </div>
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className={headRow}>
                  <th className="px-1 py-[3px] text-left">Type</th>
                  <th className="w-[36px] px-1 py-[3px] text-center">Nos.</th>
                  <th className="w-[90px] px-1 py-[3px] text-right">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {types.length > 0 ? (
                  types.map(([type, row]) => (
                    <tr key={type} className="border-b border-gray-200">
                      <td className="px-1 py-[3px] font-semibold">
                        {type}
                        <span className="ml-1 text-[7.5px] text-slate-500">
                          ({row.flow === 'INFLOW' ? 'In' : 'Out'})
                        </span>
                      </td>
                      <td className="px-1 py-[3px] text-center font-mono">{row.count}</td>
                      <td
                        className={`px-1 py-[3px] text-right font-mono font-bold ${
                          row.flow === 'INFLOW' ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        {money(row.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-1 py-3 text-center text-slate-500">
                      No entries in this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Day-wise cash flow */}
        <div className="border-b border-black px-2 py-1 bg-slate-100 text-[10px] font-bold">
          3. DAY-WISE CASH FLOW
        </div>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className={headRow}>
              <th className="w-[24px] px-1 py-[3px] text-center">Sr</th>
              <th className="w-[80px] px-1 py-[3px] text-left">Date</th>
              <th className="px-1 py-[3px] text-left">Methods</th>
              <th className="w-[36px] px-1 py-[3px] text-center">Nos.</th>
              <th className="w-[70px] px-1 py-[3px] text-right">Inflow (₹)</th>
              <th className="w-[70px] px-1 py-[3px] text-right">Outflow (₹)</th>
              <th className="w-[70px] px-1 py-[3px] text-right">Net (₹)</th>
            </tr>
          </thead>
          <tbody>
            {days.length > 0 ? (
              days.map((d, index) => (
                <tr key={d.date} className="border-b border-gray-200" style={{ breakInside: 'avoid' }}>
                  <td className="px-1 py-[3px] text-center font-mono">{index + 1}</td>
                  <td className="px-1 py-[3px] font-semibold">{formatDay(d.date)}</td>
                  <td className="px-1 py-[3px] text-[8px]">
                    {Object.entries(d.byMethod || {})
                      .map(([m, amt]) => `${methodLabel(m)}: ${money(amt)}`)
                      .join(', ') || '-'}
                  </td>
                  <td className="px-1 py-[3px] text-center font-mono">{d.totalCount}</td>
                  <td className="px-1 py-[3px] text-right font-mono font-bold text-emerald-800">
                    {money(d.collections)}
                  </td>
                  <td className="px-1 py-[3px] text-right font-mono font-bold text-rose-800">{money(d.payouts)}</td>
                  <td className="px-1 py-[3px] text-right font-mono font-bold">{money(d.net)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-1 py-3 text-center text-slate-500">
                  No activity in this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className={footRow}>
              <td colSpan={3} className="px-1 py-[4px] text-right">
                PERIOD TOTALS:
              </td>
              <td className="px-1 py-[4px] text-center font-mono">{summary.totalCount}</td>
              <td className="px-1 py-[4px] text-right font-mono text-emerald-900">
                ₹{money(summary.totalCollections)}
              </td>
              <td className="px-1 py-[4px] text-right font-mono text-rose-900">₹{money(summary.totalPayouts)}</td>
              <td className="px-1 py-[4px] text-right font-mono">₹{money(summary.netBalance)}</td>
            </tr>
          </tfoot>
        </table>

        {/* 4. Itemised ledger entries */}
        <div className={sectionHead}>
          4. LEDGER ENTRIES
          {!listedAll && (
            <span className="ml-1 text-[8px] font-semibold text-slate-600">
              (showing {transactions.length} of {summary.totalCount} entries - totals above cover all entries)
            </span>
          )}
        </div>
        <table className="w-full border-collapse text-[8.5px]">
          <thead className="table-header-group">
            <tr className={headRow}>
              <th className="w-[22px] px-1 py-[3px] text-center">Sr</th>
              <th className="w-[80px] px-1 py-[3px] text-left">Date / Time</th>
              <th className="w-[75px] px-1 py-[3px] text-left">Receipt / Ref</th>
              <th className="px-1 py-[3px] text-left">Party / Type</th>
              <th className="w-[62px] px-1 py-[3px] text-left">Method</th>
              <th className="w-[62px] px-1 py-[3px] text-left">Handled By</th>
              <th className="w-[60px] px-1 py-[3px] text-right">Inflow (₹)</th>
              <th className="w-[60px] px-1 py-[3px] text-right">Outflow (₹)</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length > 0 ? (
              transactions.map((t, index) => {
                const isInflow = t.flow === 'INFLOW';
                return (
                  <tr key={t.id || index} className="border-b border-gray-200" style={{ breakInside: 'avoid' }}>
                    <td className="px-1 py-[3px] text-center font-mono">{index + 1}</td>
                    <td className="px-1 py-[3px]">{formatDateTime(t.date)}</td>
                    <td className="px-1 py-[3px] font-mono font-semibold">
                      {t.receiptNumber || '-'}
                      {t.invoiceNumber && (
                        <span className="block text-[7.5px] font-normal text-slate-500">{t.invoiceNumber}</span>
                      )}
                    </td>
                    <td className="px-1 py-[3px]">
                      <span className="font-semibold">{t.partyName}</span>
                      {t.partyUhid && <span className="ml-1 text-[7.5px] text-slate-500">({t.partyUhid})</span>}
                      <span className="block text-[7.5px] text-slate-500">{t.type}</span>
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
                  No ledger entries match the current filter.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className={footRow}>
              <td colSpan={6} className="px-1 py-[4px] text-right">
                GRAND TOTALS:
              </td>
              <td className="px-1 py-[4px] text-right font-mono text-emerald-900">
                ₹{money(summary.totalCollections)}
              </td>
              <td className="px-1 py-[4px] text-right font-mono text-rose-900">₹{money(summary.totalPayouts)}</td>
            </tr>
          </tfoot>
        </table>

        {/* Footer & Signature Section */}
        <div className="flex items-start justify-between gap-4 p-2 text-[9px] bg-white" style={{ breakInside: 'avoid' }}>
          <div className="min-w-0 max-w-sm">
            <p className="font-extrabold text-[10px] text-slate-900">
              Net Cash Flow: ₹{money(summary.netBalance)} ({amountInWords(Number(summary.netBalance) || 0)})
            </p>
            <p className="text-[7.5px] leading-[10px] text-slate-500 mt-1">
              * Ledger report generated from the payment ledger of {centre.name}.
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

export default LedgerReportPrint;
