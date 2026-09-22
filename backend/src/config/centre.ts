/**
 * Who the downloadable PDF report says it came from.
 *
 * The browser prints from `frontend/src/config/centre.ts`; this is the same
 * letterhead for the PDF the server generates, read from the same variable
 * names minus the `VITE_` prefix the frontend bundler requires. Set both in
 * their own `.env` and the bill, the on-screen report and the PDF agree.
 *
 * Anything left unset does not print. A report is a medical document a patient
 * keeps, so a line it cannot fill is left off rather than filled with a
 * placeholder - an invented phone number is worse than no phone number, and an
 * accreditation the centre does not hold is a false claim.
 */
const env = (key: string, fallback = ''): string => {
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
};

export const CENTRE = {
  name: env('CENTRE_NAME', 'DIAGNOSTIC CENTRE'),
  address: env('CENTRE_ADDRESS'),
  email: env('CENTRE_EMAIL'),
  phones: env('CENTRE_PHONES'),
  mobiles: env('CENTRE_MOBILES'),
  reportingEnquiryNumbers: env('CENTRE_ENQUIRY_NUMBERS'),
  /** Only ever what the centre actually holds, e.g. "NABL Accredited". */
  accreditation: env('CENTRE_ACCREDITATION'),
  /**
   * The logo drawn on the PDF letterhead - an absolute path, or one relative
   * to where the server runs, e.g. `../frontend/public/logo.png` so the PDF
   * and the browser print the same artwork. Left unset the header still keeps
   * the space for it and simply prints nothing there.
   */
  logoPath: env('CENTRE_LOGO_PATH'),
};

/** Joins labelled contact parts, dropping the ones with nothing set. */
export const contactLine = (parts: Array<[label: string, value?: string]>): string =>
  parts
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `${label}: ${value}`)
    .join(' | ');
