import React from 'react';
import { CENTRE, type CentreProfile } from '../../config/centre';
import { formatDateTime } from '../../utils/dates';
import { CentreLetterhead } from './CentreLetterhead';

export interface ListPrintColumn {
  header: string;
  /** Right-aligned and monospaced - money and counts. */
  numeric?: boolean;
  /** Kept on one line - codes like an invoice number read badly broken. */
  nowrap?: boolean;
}

export interface ListPrintSheetProps {
  title: string;
  /** Human-readable lines describing the filters in force. */
  filterLines: string[];
  columns: ListPrintColumn[];
  rows: React.ReactNode[][];
  /** Label/value pairs printed under the table, e.g. totals. */
  totals?: Array<[string, string]>;
  /** Shown in the title bar's right corner, e.g. "42 bills". */
  countLabel?: string;
  /** Printed when the list was cut short at the export ceiling. */
  note?: string;
  centre?: CentreProfile;
}

/**
 * A filtered directory on paper: the letterhead, the filters it was taken
 * under, every row, and the totals - the same list the screen shows, but all
 * of it rather than one page.
 */
export const ListPrintSheet: React.FC<ListPrintSheetProps> = ({
  title,
  filterLines,
  columns,
  rows,
  totals = [],
  countLabel,
  note,
  centre = CENTRE,
}) => {
  const cell = 'px-2 py-1.5 align-middle';

  return (
    <div className="report-sheet bg-white font-sans text-black">
      <div className="border border-black">
        <CentreLetterhead centre={centre} />

        <div className="flex items-center border-b border-black bg-slate-100 px-3 py-1.5 text-[10.5px]">
          <span className="w-1/3 font-semibold">Printed: {formatDateTime(new Date())}</span>
          <span className="w-1/3 text-center text-[15px] font-extrabold uppercase leading-tight tracking-wide text-black">
            {title}
          </span>
          <span className="w-1/3 text-right font-bold">{countLabel}</span>
        </div>

        {filterLines.length > 0 && (
          <div className="border-b border-black bg-white px-3 py-1 text-[10px] leading-tight text-slate-700">
            {filterLines.map((line) => (
              <span key={line} className="mr-4 inline-block font-medium">
                {line}
              </span>
            ))}
          </div>
        )}

        <table className="w-full border-collapse text-[10.5px] leading-tight">
          <thead>
            <tr className="border-b border-black bg-slate-100 font-bold text-[10.5px] text-black">
              <th className={`${cell} text-left w-[36px]`}>#</th>
              {columns.map((c) => (
                <th
                  key={c.header}
                  className={`${cell} ${c.numeric ? 'text-right' : 'text-left'} ${c.nowrap ? 'whitespace-nowrap' : ''}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className={`${cell} py-6 text-center text-slate-500`} colSpan={columns.length + 1}>
                  Nothing matches this filter.
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-300" style={{ breakInside: 'avoid' }}>
                  <td className={`${cell} font-medium text-slate-600`}>{i + 1}</td>
                  {row.map((value, j) => (
                    <td
                      key={j}
                      className={`${cell} ${columns[j]?.numeric ? 'text-right font-mono font-medium' : ''} ${
                        columns[j]?.nowrap ? 'whitespace-nowrap' : ''
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>

        {(totals.length > 0 || note) && (
          <div className="border-t-2 border-black bg-slate-50 px-3 py-2 text-[10.5px] leading-snug">
            {totals.map(([label, value]) => (
              <span key={label} className="mr-6 inline-block font-bold text-black">
                {label}: <span className="font-mono">{value}</span>
              </span>
            ))}
            {note && <p className="mt-1 text-[9.5px] italic text-slate-600">{note}</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default ListPrintSheet;
