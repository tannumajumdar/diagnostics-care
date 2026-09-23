import React from 'react';

/**
 * One place every chart in the app reads its colours, ink and formatting from.
 *
 * The screens used to pick their own hex codes per card, which is how the
 * reports page ended up with a seven-colour rainbow cycling through pie slices
 * and a different blue on every bar chart. The categorical order below is
 * fixed and validated for colour-vision deficiency - slots are assigned in
 * order and never cycled, so a ninth series folds into "Other" rather than
 * inventing a hue nobody can tell from slot 3.
 */

/** Categorical - for telling distinct series apart. Assigned in order. */
export const SERIES = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
] as const;

/**
 * Sequential - one hue, light to dark, for magnitude. Anything that is "more
 * is bigger" uses this rather than a second categorical colour, which would
 * read as a second series that is not there.
 */
export const BLUE_RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#2a78d6', '#256abf', '#184f95'] as const;

/** Reserved for state. Never used as "series 4". */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const;

/**
 * Chart chrome. Grid and axis sit one step off the card surface and stay
 * solid hairlines - a dashed grid reads as a threshold line that isn't there.
 */
export const INK = {
  surface: '#ffffff',
  primary: '#0f172a',
  secondary: '#475569',
  muted: '#94a3b8',
  grid: '#e2e8f0',
  axis: '#cbd5e1',
} as const;

/** ₹1,24,500 - Indian digit grouping, which is what the centre's books use. */
export const inr = (value: number): string => `₹${Math.round(Number(value) || 0).toLocaleString('en-IN')}`;

/** ₹1.2L on an axis tick, where the full figure would not fit. */
export const compactInr = (value: number): string => {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (Math.abs(n) >= 1000) return `₹${Math.round(n / 1000)}k`;
  return `₹${Math.round(n)}`;
};

export const compactCount = (value: number): string => {
  const n = Number(value) || 0;
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n));
};

/** Shared axis styling, so every chart's ticks read the same weight. */
export const axisProps = {
  tick: { fontSize: 11, fill: INK.muted },
  tickLine: false,
  axisLine: { stroke: INK.axis },
} as const;

export const gridProps = {
  stroke: INK.grid,
  strokeWidth: 1,
  vertical: false,
} as const;

/**
 * Recharts' default tooltip is an unstyled white box with a black border. This
 * one matches the cards around it and puts the series colour on a swatch
 * rather than on the text, which is illegible for the lighter slots.
 */
export const ChartTooltip: React.FC<any> = ({
  active,
  payload,
  label,
  formatter = (v: number) => String(v),
  labelFormatter = (l: any, _p?: any) => String(l),
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
      {/* The payload rides along, so a caller can title the tooltip with a
          field on the row (a full date) rather than with the axis tick. */}
      <p className="mb-1 font-semibold text-slate-900">{labelFormatter(label, payload)}</p>
      <div className="space-y-0.5">
        {payload.map((entry: any) => (
          <div key={entry.dataKey ?? entry.name} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color || entry.payload?.fill }}
            />
            <span className="text-slate-500">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-900">
              {formatter(entry.value, entry.name, entry)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** A legend swatch row, used where recharts' own legend is too loud. */
export const LegendKey: React.FC<{ color: string; label: string; value?: string }> = ({ color, label, value }) => (
  <span className="inline-flex items-center gap-1.5 text-[12px] text-slate-500">
    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    {label}
    {value && <span className="font-semibold tabular-nums text-slate-700">{value}</span>}
  </span>
);

/**
 * Past six slices a part-to-whole chart stops being readable, so the tail is
 * folded into a single "Other" rather than given hues of its own.
 */
export const foldTail = <T extends Record<string, any>>(
  rows: T[],
  valueKey: keyof T,
  nameKey: keyof T,
  keep = 6
): { name: string; value: number }[] => {
  const sorted = [...rows]
    .map((r) => ({ name: String(r[nameKey] ?? 'Unknown'), value: Number(r[valueKey]) || 0 }))
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= keep) return sorted;
  const head = sorted.slice(0, keep - 1);
  const tail = sorted.slice(keep - 1);
  return [...head, { name: `Other (${tail.length})`, value: tail.reduce((s, r) => s + r.value, 0) }];
};
