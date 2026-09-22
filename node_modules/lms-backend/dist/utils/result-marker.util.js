"use strict";
/**
 * The mark that goes beside a result on a report.
 *
 * A report does not carry a column that says "High" in words - it prints the
 * value and an `H` or an `L` against it, which is what the bench and the
 * referring doctor have always read. A critical value is marked `H*` / `L*`:
 * the flag is stored without a direction, so the direction is read back off
 * the reference range printed on the same line.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resultMarker = void 0;
/** Which side of the printed range a value falls on, or null if it is inside it. */
const rangeDirection = (value, range) => {
    const val = parseFloat(String(value ?? ''));
    if (!Number.isFinite(val) || !range)
        return null;
    const band = range.match(/([\d.]+)\s*-\s*([\d.]+)/);
    if (band) {
        if (val < parseFloat(band[1]))
            return 'Low';
        if (val > parseFloat(band[2]))
            return 'High';
        return null;
    }
    const upper = range.match(/<\s*=?\s*([\d.]+)/);
    if (upper)
        return val > parseFloat(upper[1]) ? 'High' : null;
    const lower = range.match(/>\s*=?\s*([\d.]+)/);
    if (lower)
        return val < parseFloat(lower[1]) ? 'Low' : null;
    return null;
};
/** `H`, `L`, `H*`, `L*` - or an empty string, because a normal result needs no mark. */
const resultMarker = (result) => {
    const flag = result?.flag || 'Normal';
    if (flag === 'Normal')
        return '';
    if (flag === 'High')
        return 'H';
    if (flag === 'Low')
        return 'L';
    const direction = rangeDirection(result?.value, result?.referenceRange);
    return direction === 'Low' ? 'L*' : direction === 'High' ? 'H*' : '*';
};
exports.resultMarker = resultMarker;
