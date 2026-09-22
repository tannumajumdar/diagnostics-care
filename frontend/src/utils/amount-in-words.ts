/**
 * The rupee amount spelled out, the way an Indian bill prints it -
 * lakh and crore, not million.
 *
 * A bill is a receipt: the figure and the words have to agree, and the words
 * are what settles an argument at the counter. Paise are only spoken when
 * there are any, so a round amount reads "Two Thousand Seven Hundred Fifty
 * Rs. Only/-" rather than trailing a pointless "and Zero Paise".
 */
const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 0-99 in words. */
const twoDigits = (n: number): string => {
  if (n < 20) return ONES[n];
  const tens = TENS[Math.floor(n / 10)];
  const unit = ONES[n % 10];
  return unit ? `${tens} ${unit}` : tens;
};

/** 0-999 in words. */
const threeDigits = (n: number): string => {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
};

/** A whole number in words, grouped crore / lakh / thousand / hundred. */
export const numberToWords = (value: number): string => {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));

  return parts.join(' ');
};

/**
 * The full "In Words" line for a bill, paise included only when the amount
 * actually carries them.
 */
export const amountInWords = (amount: number): string => {
  const value = Math.abs(Number(amount) || 0);
  const rupees = Math.floor(value);
  // Rounded, not truncated: 0.005 short of a paisa still owes that paisa.
  const paise = Math.round((value - rupees) * 100);

  const negative = Number(amount) < 0 ? 'Minus ' : '';
  if (!paise) return `${negative}${numberToWords(rupees)} Rs. Only/-`;
  return `${negative}${numberToWords(rupees)} Rs. and ${twoDigits(paise)} Paise Only/-`;
};
