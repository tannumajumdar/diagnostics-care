import React from 'react';
import qrcode from 'qrcode-generator';

/**
 * A QR drawn as inline SVG, for the same reason the bill's barcode is
 * (see BarcodeGenerator): the counter often has no internet, and a QR served
 * from a remote image is a blank square on the day the line is down - which,
 * for a payment QR, means the patient cannot pay at all.
 *
 * Error correction is M. A payment QR is held up on a screen and scanned from
 * a foot away; L would be smaller but leaves no margin for a scuffed display,
 * and Q/H would push the module count up for no benefit at this distance.
 */
export interface QrCodeProps {
  value: string;
  /** Rendered size in pixels, including the quiet zone. */
  size?: number;
  className?: string;
  /** Alternative text for a screen reader - what the code is *for*. */
  label?: string;
}

export const QrCode: React.FC<QrCodeProps> = ({ value, size = 200, className = '', label = 'QR code' }) => {
  const path = React.useMemo(() => {
    if (!value) return null;

    // Type 0 lets the library pick the smallest version that fits.
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();

    const count = qr.getModuleCount();
    const parts: string[] = [];

    /**
     * One path for the whole symbol rather than a rect per module - a version
     * 7 code is about 2,000 modules, and that many DOM nodes visibly janks
     * the modal it opens in. Runs of dark modules on a row are merged into a
     * single horizontal segment, which also keeps the seams from showing as
     * hairlines when the browser rounds subpixels.
     */
    for (let row = 0; row < count; row += 1) {
      let runStart = -1;
      for (let col = 0; col <= count; col += 1) {
        const dark = col < count && qr.isDark(row, col);
        if (dark && runStart === -1) runStart = col;
        if (!dark && runStart !== -1) {
          parts.push(`M${runStart} ${row}h${col - runStart}v1h-${col - runStart}z`);
          runStart = -1;
        }
      }
    }

    return { d: parts.join(''), count };
  }, [value]);

  if (!path) return null;

  // The quiet zone is part of the spec, not padding - a scanner needs four
  // clear modules around the symbol to find its edges.
  const quiet = 4;
  const extent = path.count + quiet * 2;

  return (
    <svg
      role="img"
      aria-label={label}
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${extent} ${extent}`}
      shapeRendering="crispEdges"
    >
      <rect width={extent} height={extent} fill="#ffffff" />
      <g transform={`translate(${quiet} ${quiet})`}>
        <path d={path.d} fill="#0f172a" />
      </g>
    </svg>
  );
};

export default QrCode;
