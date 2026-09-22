import React from 'react';

/**
 * A Code 128 (subset B) barcode drawn as inline SVG.
 *
 * Inline because the bill is printed, often from a machine with no internet:
 * an <img> pointed at a barcode service prints as an empty box on the one day
 * the line is down, and a bill with no scannable barcode is a bill the bench
 * cannot accession. Subset B covers the whole printable ASCII range, which is
 * what our ids use (`BAR-2026-000123`), so there is no mode switching to do.
 */

/**
 * The standard Code 128 element-width table. Each entry is six widths -
 * bar, space, bar, space, bar, space - except the stop pattern, which carries
 * a seventh element. Index is the code value; 103-105 are the start codes for
 * subsets A, B and C, and 106 is stop.
 */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const START_B = 104;
const STOP = 106;

/**
 * The code values for one string in subset B, checksum and stop included.
 * Characters outside printable ASCII are dropped rather than encoded wrongly -
 * a scanner reading half an id is worse than a short one.
 */
const encode = (value: string): number[] => {
  const codes: number[] = [START_B];

  value.split('').forEach((char) => {
    const point = char.charCodeAt(0);
    if (point < 32 || point > 126) return;
    codes.push(point - 32);
  });

  // Weighted modulo 103: the start code counts once, every data code counts
  // by its position.
  const checksum = codes.reduce((sum, code, index) => sum + code * (index || 1), 0) % 103;

  codes.push(checksum, STOP);
  return codes;
};

export interface BarcodeGeneratorProps {
  /** What to encode. Rendered empty if blank. */
  value: string;
  /** Height of the bars in px. */
  height?: number;
  /** Width of one module (the narrowest bar) in px. */
  moduleWidth?: number;
  /** Print the human-readable value under the bars. */
  displayValue?: boolean;
  className?: string;
}

export const BarcodeGenerator: React.FC<BarcodeGeneratorProps> = ({
  value,
  height = 40,
  moduleWidth = 1,
  displayValue = false,
  className,
}) => {
  const text = String(value ?? '').trim();
  if (!text) return null;

  const codes = encode(text);

  // Walk the pattern table once, laying bars left to right. Elements alternate
  // bar, space, bar, ... so only the even ones are drawn.
  const bars: { x: number; width: number }[] = [];
  let x = 0;

  codes.forEach((code) => {
    PATTERNS[code].split('').forEach((width, index) => {
      const w = Number(width) * moduleWidth;
      if (index % 2 === 0) bars.push({ x, width: w });
      x += w;
    });
  });

  const totalWidth = x;
  const labelHeight = displayValue ? 10 : 0;

  return (
    <svg
      className={className}
      width={totalWidth}
      height={height + labelHeight}
      viewBox={`0 0 ${totalWidth} ${height + labelHeight}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`Barcode ${text}`}
    >
      <rect x={0} y={0} width={totalWidth} height={height + labelHeight} fill="#fff" />
      {bars.map((bar, index) => (
        <rect key={index} x={bar.x} y={0} width={bar.width} height={height} fill="#000" />
      ))}
      {displayValue && (
        <text
          x={totalWidth / 2}
          y={height + labelHeight - 1}
          textAnchor="middle"
          fontFamily="monospace"
          fontSize={9}
          fill="#000"
        >
          {text}
        </text>
      )}
    </svg>
  );
};

export default BarcodeGenerator;
