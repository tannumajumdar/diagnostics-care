/**
 * ABHA - the Ayushman Bharat Health Account a patient may carry.
 *
 * Format and checks only; the ABDM calls that verify or create one live in
 * services/abdm.service.ts. The number is 14
 * digits, written 12-3456-7890-1234; the address is a name at the ABDM
 * domain, like ramesh.kumar@abdm (or @sbx on the ABDM sandbox).
 */

/** 14 digits in any spacing, written back as XX-XXXX-XXXX-XXXX; '' stays ''. */
export const formatAbhaNumber = (value: unknown): string => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length !== 14) return String(value ?? '').trim();
  return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}-${digits.slice(10)}`;
};

export const isAbhaNumber = (value: unknown): boolean => {
  const text = String(value ?? '').trim();
  return text === '' || /^\d{14}$/.test(text.replace(/[\s-]/g, ''));
};

/** Lower case and trimmed, the way ABDM reads it. */
export const formatAbhaAddress = (value: unknown): string => String(value ?? '').trim().toLowerCase();

export const isAbhaAddress = (value: unknown): boolean => {
  const text = formatAbhaAddress(value);
  return text === '' || /^[a-z0-9][a-z0-9._]{2,31}@[a-z]+$/.test(text);
};

/** The two fields of a patient payload, cleaned in place if present. */
export const normaliseAbha = <T extends Record<string, any>>(data: T): T => {
  if (data && 'abhaNumber' in data) (data as any).abhaNumber = formatAbhaNumber(data.abhaNumber);
  if (data && 'abhaAddress' in data) (data as any).abhaAddress = formatAbhaAddress(data.abhaAddress);
  return data;
};

/**
 * Whether the patient came with an ABHA or asked for one to be made: '' when
 * the desk didn't say. A new ABHA is made through ABDM from the patient's
 * Aadhaar OTP (services/abdm.service.ts); the record keeps the result.
 */
export const ABHA_STATUSES = ['Existing', 'New'] as const;

/** The ID proofs the desk accepts; Aadhaar first, since ABHA is made from it. */
export const ID_PROOF_TYPES = ['Aadhaar', 'PAN', 'Voter ID', 'Driving Licence', 'Passport', 'Other'] as const;

/** Upper case with the spaces and dashes taken out; '' stays ''. */
export const formatIdProofNumber = (value: unknown): string =>
  String(value ?? '').replace(/[\s-]/g, '').toUpperCase();

/** '' when the number fits its proof (or both are empty), otherwise the message. */
export const idProofError = (type: unknown, number: unknown): string => {
  const kind = String(type ?? '').trim();
  const text = formatIdProofNumber(number);
  if (!kind && !text) return '';
  if (!kind) return 'Pick the ID proof type';
  if (!text) return `Enter the ${kind} number`;
  if (kind === 'Aadhaar' && !/^\d{12}$/.test(text)) return 'Aadhaar number must be 12 digits';
  if (kind === 'PAN' && !/^[A-Z]{5}\d{4}[A-Z]$/.test(text)) return 'PAN must look like ABCDE1234F';
  if (text.length < 4 || text.length > 20) return 'ID number must be 4 to 20 characters';
  return '';
};

/** The photo ABDM sends with a verified ABHA: a JPEG or PNG (SVG for the demo) data URI. */
const PHOTO = /^data:image\/(jpeg|png|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;
/** About 375 KB of image; ABHA photos are a fraction of that. */
export const PHOTO_MAX_LENGTH = 500_000;

export const isPatientPhoto = (value: unknown): boolean => {
  const text = String(value ?? '');
  return text === '' || (text.length <= PHOTO_MAX_LENGTH && PHOTO.test(text));
};

/** ABDM's bare base64 as a data URI the browser can show; a data URI stays as it is. */
export const photoDataUri = (value: unknown): string => {
  const text = String(value ?? '').replace(/\s/g, '');
  if (!text) return '';
  if (text.startsWith('data:')) return text;
  return `data:image/${text.startsWith('iVBOR') ? 'png' : 'jpeg'};base64,${text}`;
};

/** ABHA status and ID proof of a patient payload, cleaned in place if present. */
export const normaliseIdentity = <T extends Record<string, any>>(data: T): T => {
  normaliseAbha(data);
  if (data && 'idProofNumber' in data) (data as any).idProofNumber = formatIdProofNumber(data.idProofNumber);
  if (data && 'idProofType' in data) (data as any).idProofType = String(data.idProofType ?? '').trim();
  return data;
};
