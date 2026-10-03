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

/*
 * Where the chat opens, chosen once per counter PC and remembered there:
 *  - 'app': the WhatsApp desktop app, through its whatsapp:// link - the chat
 *    opens in the app already running, with no browser tab at all;
 *  - 'web': WhatsApp Web, straight to the chat (web.whatsapp.com/send skips
 *    wa.me's "Continue to chat" page) and always in the one tab this software
 *    opened, so a day of messages does not leave a row of WhatsApp tabs.
 *
 * It is asked rather than guessed: a browser cannot see whether the app is
 * installed, and on a Windows PC without it the link brings up Windows' own
 * "find an app" prompt. Ctrl+click on a WhatsApp button asks again. A WhatsApp
 * Web tab the user opened by hand stays out of reach - no site can drive
 * another site's tab.
 */
type WhatsAppMode = 'app' | 'web';
const MODE_KEY = 'lms_whatsapp_mode';
const WEB_TAB = 'lms-whatsapp';

const savedMode = (): WhatsAppMode | null => {
  try {
    const mode = localStorage.getItem(MODE_KEY);
    return mode === 'app' || mode === 'web' ? mode : null;
  } catch {
    return null;
  }
};

const askMode = (): WhatsAppMode => {
  const mode: WhatsAppMode = window.confirm(
    [
      'Is the WhatsApp desktop app installed on this computer?',
      '',
      'OK - open chats in the WhatsApp app',
      'Cancel - open chats in WhatsApp Web',
      '',
      'This is remembered on this computer. Ctrl+click WhatsApp to change it.',
    ].join('\n')
  )
    ? 'app'
    : 'web';
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* private window - asked again next time */
  }
  return mode;
};

/**
 * Opens the chat with the message typed in, in the app or the one WhatsApp
 * Web tab as this computer is set. Returns false when the mobile is unusable.
 * `notify` reports a blocked WhatsApp Web tab.
 */
export const openWhatsApp = (
  mobile: string | null | undefined,
  message: string,
  notify?: (message: string, type?: 'success' | 'error' | 'info') => void
): boolean => {
  const number = toWhatsAppNumber(mobile);
  if (!number) return false;
  const text = encodeURIComponent(message);

  const changing = typeof window.event !== 'undefined' && (window.event as MouseEvent | undefined)?.ctrlKey;
  const mode = (!changing && savedMode()) || askMode();

  if (mode === 'app') {
    window.location.href = `whatsapp://send?phone=${number}&text=${text}`;
    return true;
  }

  const tab = window.open(`https://web.whatsapp.com/send?phone=${number}&text=${text}`, WEB_TAB);
  if (tab) tab.focus();
  else notify?.('The browser blocked the WhatsApp tab - press WhatsApp again.', 'info');
  return true;
};
