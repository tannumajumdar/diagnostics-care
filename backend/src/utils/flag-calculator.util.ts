export type ResultFlag = 'Normal' | 'Low' | 'High' | 'Critical';

interface CriticalLimits {
  criticalLow?: string | number;
  criticalHigh?: string | number;
  /** The master's HIGH / LOW RANGE - above / below them reads High / Low. */
  highRange?: string | number;
  lowRange?: string | number;
}

const toNumber = (value: unknown): number => parseFloat(String(value ?? ''));

/**
 * Reads the flag off a value and the range printed beside it.
 *
 * Ranges on a report are not all written the same way - a haemoglobin comes as
 * "13.0 - 17.0", a cholesterol as "< 200" and an HDL as "> 40" - so all three
 * shapes are understood rather than only the first. Critical limits, when the
 * test master carries them, override Low/High: a potassium of 2.1 is not merely
 * low, it is the call the bench makes to the ward before anything else.
 */
export const calculateResultFlag = (
  valueStr: string,
  referenceRange?: string,
  limits: CriticalLimits = {}
): ResultFlag => {
  const val = toNumber(valueStr);
  if (isNaN(val)) return 'Normal';

  const criticalLow = toNumber(limits.criticalLow);
  const criticalHigh = toNumber(limits.criticalHigh);
  if (!isNaN(criticalLow) && val < criticalLow) return 'Critical';
  if (!isNaN(criticalHigh) && val > criticalHigh) return 'Critical';

  const highAt = toNumber(limits.highRange);
  const lowAt = toNumber(limits.lowRange);
  if (!isNaN(highAt) || !isNaN(lowAt)) {
    if (!isNaN(highAt) && val > highAt) return 'High';
    if (!isNaN(lowAt) && val < lowAt) return 'Low';
    return 'Normal';
  }

  if (!referenceRange) return 'Normal';

  const band = referenceRange.match(/([\d.]+)\s*-\s*([\d.]+)/);
  if (band) {
    const low = parseFloat(band[1]);
    const high = parseFloat(band[2]);
    if (!isNaN(low) && val < low) return 'Low';
    if (!isNaN(high) && val > high) return 'High';
    return 'Normal';
  }

  const upperBound = referenceRange.match(/<\s*=?\s*([\d.]+)/);
  if (upperBound) {
    const high = parseFloat(upperBound[1]);
    return !isNaN(high) && val > high ? 'High' : 'Normal';
  }

  const lowerBound = referenceRange.match(/>\s*=?\s*([\d.]+)/);
  if (lowerBound) {
    const low = parseFloat(lowerBound[1]);
    return !isNaN(low) && val < low ? 'Low' : 'Normal';
  }

  return 'Normal';
};

export const calculateParameterFlag = calculateResultFlag;
