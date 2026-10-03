/**
 * ABHA - the Ayushman Bharat Health Account a patient may carry. Format and
 * checks only (ABDM itself is reached through api/abdm.api.ts); mirrors
 * backend/src/utils/abha.util.ts so the form says what the server would.
 */

/** As the desk types: digits only, grouped 12-3456-7890-1234, at most 14. */
export const typeAbhaNumber = (value: string): string => {
  const d = value.replace(/\D/g, '').slice(0, 14);
  return [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10), d.slice(10)].filter(Boolean).join('-');
};

/** '' when fine (or empty), otherwise the message to show under the box. */
export const abhaNumberError = (value?: string): string => {
  const text = String(value ?? '').trim();
  if (!text || /^\d{14}$/.test(text.replace(/[\s-]/g, ''))) return '';
  return 'ABHA number must be 14 digits, like 12-3456-7890-1234';
};

export const abhaAddressError = (value?: string): string => {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || /^[a-z0-9][a-z0-9._]{2,31}@[a-z]+$/.test(text)) return '';
  return 'ABHA address must look like name@abdm';
};

/** Mirrors ABHA_STATUSES / ID_PROOF_TYPES in the server's abha.util. */
export const ABHA_STATUSES = ['Existing', 'New'] as const;
export const ID_PROOF_TYPES = ['Aadhaar', 'PAN', 'Voter ID', 'Driving Licence', 'Passport', 'Other'] as const;

/** As the desk types: Aadhaar as 1234 5678 9012, anything else upper case. */
export const typeIdProofNumber = (type: string, value: string): string => {
  if (type === 'Aadhaar') {
    const d = value.replace(/\D/g, '').slice(0, 12);
    return [d.slice(0, 4), d.slice(4, 8), d.slice(8)].filter(Boolean).join(' ');
  }
  return value.replace(/\s/g, '').toUpperCase().slice(0, 20);
};

/** '' when the number fits its proof (or both are empty), otherwise the message. */
export const idProofError = (type?: string, number?: string): string => {
  const kind = String(type ?? '').trim();
  const text = String(number ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!kind && !text) return '';
  if (!kind) return 'Pick the ID proof type';
  if (!text) return `Enter the ${kind} number`;
  if (kind === 'Aadhaar' && !/^\d{12}$/.test(text)) return 'Aadhaar number must be 12 digits';
  if (kind === 'PAN' && !/^[A-Z]{5}\d{4}[A-Z]$/.test(text)) return 'PAN must look like ABCDE1234F';
  if (text.length < 4 || text.length > 20) return 'ID number must be 4 to 20 characters';
  return '';
};

/** Only the last four shown back, the way an Aadhaar is quoted. */
export const maskIdProofNumber = (value?: string): string => {
  const text = String(value ?? '').replace(/\s/g, '');
  return text.length > 4 ? `${'X'.repeat(text.length - 4)}${text.slice(-4)}` : text;
};

/**
 * What a verified ABHA puts on the patient form: every detail ABDM sent,
 * over whatever was typed - it is the patient's KYC record. Blank values are
 * left out so they never wipe a field, and a "Male Child" stays a child.
 */
export const abhaFormValues = (
  profile: {
    abhaNumber: string;
    abhaAddress: string;
    name: string;
    gender: string;
    dateOfBirth: string;
    mobile: string;
    address: string;
    state: string;
    pinCode: string;
    photo: string;
  },
  currentGender = ''
): Record<string, string> => {
  const mobile = profile.mobile.replace(/\D/g, '').slice(-10);
  const values: Record<string, string> = {
    abhaNumber: profile.abhaNumber,
    abhaAddress: profile.abhaAddress,
    patientName: profile.name,
    gender: currentGender === `${profile.gender} Child` ? currentGender : profile.gender,
    // ABDM masks the mobile on some replies (XXXXXX3210): only a whole one is used.
    mobile: /^\d{10}$/.test(mobile) ? mobile : '',
    dateOfBirth: profile.dateOfBirth,
    address: profile.address,
    state: profile.state,
    pinCode: profile.pinCode,
    photo: profile.photo,
  };
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v && v.trim()));
};
