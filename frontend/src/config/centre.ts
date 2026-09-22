/**
 * Who the printed paper says it came from.
 *
 * The bill and the report are the two things a patient carries home, so the
 * letterhead has to be the centre's own. Everything the counter would ever
 * want to correct (a new phone line, a changed UPI handle, the collection
 * notice at the foot of the bill) is read from the environment, so the centre
 * is set once in `frontend/.env` and never edited in code.
 *
 * Anything left unset simply does not print. That is deliberate: a bill that
 * shows "Ph No. : 00000-000000" is worse than one that shows no phone line at
 * all, because a patient will try to ring it. The same profile feeds the bill,
 * the doctor's copy and the lab report, so all three stay in step.
 *
 * The backend keeps its own copy of this for the downloadable PDF - see
 * `backend/src/config/centre.ts`. Both read the same variable names.
 */
export interface CentreProfile {
  /** Printed large at the top of every bill and report. */
  name: string;
  /** The small line under the logo, e.g. the owning company. Optional. */
  unitLine?: string;
  /** The strap-line beside the logo. Optional. */
  tagline?: string;
  address: string;
  email: string;
  website: string;
  /** Landlines, already comma-joined the way they should print. */
  phones: string;
  /** Mobiles, already comma-joined. */
  mobiles: string;
  /** The "call us about your report" numbers, printed top-right. */
  reportingEnquiryNumbers: string;
  /** The processing centre named on the bill body ("Centre :" line). */
  processingCentre: string;
  /**
   * Any accreditation the centre actually holds, e.g. "NABL Accredited".
   * Blank by default and printed only when set - claiming an accreditation
   * the centre does not hold is a false statement on a medical report.
   */
  accreditation?: string;
  /**
   * Logo and payment QR are served from `frontend/public`, so dropping
   * `logo.png` / `upi-qr.png` in there is all it takes. Either may be left
   * blank - the bill then prints the centre's initials and the UPI id as
   * text instead of a missing-image box.
   */
  logoUrl?: string;
  upiQrUrl?: string;
  /** Printed under the totals, next to the QR - the payee the QR resolves to. */
  upiPayeeLine?: string;
  /** The notice across the foot of the patient's copy. */
  collectionNote: string;
  /** The software credit line. The old vendor's bill carried theirs here. */
  poweredByLine: string;
}

/** An unset or whitespace-only variable reads as "not configured". */
const env = (key: string, fallback = ''): string => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

export const CENTRE: CentreProfile = {
  // The one field with a fallback: a bill has to say something at the top, and
  // a generic word is honest in a way a made-up lab name is not.
  name: env('VITE_CENTRE_NAME', 'DIAGNOSTIC CENTRE'),
  unitLine: env('VITE_CENTRE_UNIT_LINE'),
  tagline: env('VITE_CENTRE_TAGLINE'),
  address: env('VITE_CENTRE_ADDRESS'),
  email: env('VITE_CENTRE_EMAIL'),
  website: env('VITE_CENTRE_WEBSITE'),
  phones: env('VITE_CENTRE_PHONES'),
  mobiles: env('VITE_CENTRE_MOBILES'),
  reportingEnquiryNumbers: env('VITE_CENTRE_ENQUIRY_NUMBERS'),
  processingCentre: env('VITE_CENTRE_PROCESSING_LAB'),
  accreditation: env('VITE_CENTRE_ACCREDITATION'),
  // Drop logo.png / upi-qr.png into `frontend/public` and these start printing;
  // until then the bill leaves both cells out rather than showing a broken box.
  logoUrl: env('VITE_CENTRE_LOGO_URL', '/logo.png'),
  upiQrUrl: env('VITE_CENTRE_UPI_QR_URL', '/upi-qr.png'),
  upiPayeeLine: env('VITE_CENTRE_UPI_PAYEE'),
  collectionNote: env('VITE_CENTRE_COLLECTION_NOTE', 'Please collect the report within 1 month.'),
  poweredByLine: env('VITE_CENTRE_POWERED_BY', 'Powered By LMS'),
};

/**
 * Joins the parts of a contact line, dropping the labels whose value is unset.
 *
 * `Ph No. : 00000, Mob No. : ` reads as a broken bill; with nothing configured
 * this returns an empty string and the line is left off the letterhead.
 */
export const contactLine = (parts: Array<[label: string, value?: string]>): string =>
  parts
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label} : ${value}`)
    .join(', ');
