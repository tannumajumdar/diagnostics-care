import { CENTRE } from '../config/centre';

/**
 * Click-to-chat on WhatsApp. Nothing is sent from the server: the link opens
 * WhatsApp (app or web) on the counter's own number with the message already
 * typed, and the staff member presses Send.
 */

/**
 * The number in the international form wa.me expects - digits only, with the
 * country code. Patients are registered with bare 10-digit Indian mobiles, so
 * those get 91 in front. Anything that is not a plausible mobile returns null
 * rather than opening a chat with the wrong person.
 */
export const toWhatsAppNumber = (mobile?: string | null): string | null => {
  let digits = String(mobile || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) return /^[6-9]/.test(digits) ? `91${digits}` : null;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return null;
};

const money = (n: number) => `Rs. ${Number(n || 0).toLocaleString('en-IN')}`;

interface PatientMessage {
  patientName?: string;
  invoiceNumber?: string;
  /** True once the final report is out and can be collected. */
  reportReady: boolean;
  dueAmount?: number;
}

export const buildPatientMessage = ({ patientName, invoiceNumber, reportReady, dueAmount = 0 }: PatientMessage) => {
  const lines = [`Dear ${patientName || 'Patient'},`, ''];
  lines.push(
    reportReady
      ? 'Your test report is ready. Please visit the centre to collect it.'
      : 'Your tests are being processed. We will inform you once the report is ready.'
  );
  if (invoiceNumber) lines.push(`Bill No: ${invoiceNumber}`);
  if (dueAmount > 0) {
    lines.push('', `Balance due: ${money(dueAmount)}. Kindly clear it at the time of collection.`);
  }
  const contact = CENTRE.reportingEnquiryNumbers || CENTRE.phones || CENTRE.mobiles;
  lines.push('', 'Thank you,', CENTRE.name);
  if (contact) lines.push(`Ph: ${contact}`);
  return lines.join('\n');
};

/** Opens the chat in a new tab. Returns false when the mobile is unusable. */
export const openWhatsApp = (mobile: string | null | undefined, message: string): boolean => {
  const number = toWhatsAppNumber(mobile);
  if (!number) return false;
  window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
  return true;
};
