import crypto from 'crypto';
import { ENV } from '../config/env';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';
import { formatAbhaNumber, formatAbhaAddress, photoDataUri } from '../utils/abha.util';

/**
 * ABDM Milestone 1, the two journeys the registration desk needs, as the
 * sandbox Postman collection lays them out:
 *
 *  - Verify an ABHA the patient already has: OTP to the ABHA number (on the
 *    Aadhaar-linked or ABHA-linked mobile) or to the mobile, then the profile.
 *  - Create one from Aadhaar: Aadhaar OTP, the communication mobile (verified
 *    separately when it is not the Aadhaar one), then an ABHA address.
 *
 * Every Aadhaar number, mobile, ABHA number and OTP leaves here RSA-encrypted
 * with ABDM's public key. Nothing is stored: the Aadhaar number is never kept,
 * and the patient's X-token lives in memory only for the few minutes the
 * journey takes - the browser carries the txnId, never the token.
 */

/** ABDM itself failing, as opposed to the desk's input being wrong. */
const UPSTREAM = 502;
const SESSION_SLACK_MS = 60_000;
const JOURNEY_TTL_MS = 15 * 60_000;

let session: { token: string; expiresAt: number } | null = null;
let publicKey: string | null = null;

/** The patient tokens ABDM hands back, keyed by the txnId the browser holds. */
const journeys = new Map<string, { xToken?: string; tToken?: string; expiresAt: number }>();

const remember = (txnId: string, tokens: { xToken?: string; tToken?: string }) => {
  const now = Date.now();
  for (const [key, value] of journeys) if (value.expiresAt < now) journeys.delete(key);
  journeys.set(txnId, { ...journeys.get(txnId), ...tokens, expiresAt: now + JOURNEY_TTL_MS });
};

/** ABDM may hand back a new txnId mid-journey; the tokens follow it. */
const carry = (from: string, to: string) => {
  const found = journeys.get(from);
  if (found && to && to !== from) journeys.set(to, found);
  return to || from;
};

const recall = (txnId: string) => {
  const found = journeys.get(txnId);
  if (!found || found.expiresAt < Date.now()) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This ABHA session has expired - start again');
  }
  return found;
};

const configured = () => {
  if (!ENV.ABDM_CLIENT_ID || !ENV.ABDM_CLIENT_SECRET) {
    throw new ApiError(
      503,
      'ABDM is not set up on this server - add ABDM_CLIENT_ID and ABDM_CLIENT_SECRET, or ABDM_DEMO=true to try it'
    );
  }
};

/** ABDM answers a failure in several shapes; this finds the sentence in any of them. */
const abdmMessage = (body: any): string => {
  if (!body || typeof body !== 'object') return typeof body === 'string' && body ? body : '';
  if (body.error?.message) return String(body.error.message);
  if (body.message && body.authResult !== 'success') return String(body.message);
  if (body.description) return String(body.description);
  // { "loginId": "Invalid LoginId", "timestamp": "..." }
  const field = Object.entries(body).find(([key, value]) => key !== 'timestamp' && typeof value === 'string');
  return field ? String(field[1]) : '';
};

const headers = (extra: Record<string, string> = {}) => ({
  'Content-Type': 'application/json',
  'REQUEST-ID': crypto.randomUUID(),
  TIMESTAMP: new Date().toISOString(),
  ...extra,
});

const send = async (url: string, init: RequestInit): Promise<any> => {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000) });
  } catch {
    throw new ApiError(UPSTREAM, 'ABDM could not be reached - try again');
  }
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    /* plain text */
  }
  if (!res.ok) {
    // A lapsed or revoked gateway session: ask for a fresh one next time.
    if (res.status === 401) session = null;
    const status = res.status >= 400 && res.status < 500 ? HTTP_STATUS.BAD_REQUEST : UPSTREAM;
    throw new ApiError(status, abdmMessage(body) || `ABDM refused the request (${res.status})`);
  }
  return body;
};

/** The gateway session (client credentials), reused until a minute before it lapses. */
const accessToken = async (): Promise<string> => {
  configured();
  if (session && session.expiresAt > Date.now()) return session.token;
  const body = await send(`${ENV.ABDM_GATEWAY_URL}/sessions`, {
    method: 'POST',
    headers: headers({ 'X-CM-ID': ENV.ABDM_CM_ID }),
    body: JSON.stringify({
      clientId: ENV.ABDM_CLIENT_ID,
      clientSecret: ENV.ABDM_CLIENT_SECRET,
      grantType: 'client_credentials',
    }),
  });
  if (!body?.accessToken) throw new ApiError(UPSTREAM, 'ABDM did not grant a session');
  session = {
    token: body.accessToken,
    expiresAt: Date.now() + Number(body.expiresIn || 600) * 1000 - SESSION_SLACK_MS,
  };
  return session.token;
};

/** A call to the ABHA service, with the gateway session and any patient token. */
const abha = async (
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  extra: Record<string, string> = {}
): Promise<any> =>
  send(`${ENV.ABDM_ABHA_URL}${path}`, {
    method,
    headers: headers({ Authorization: `Bearer ${await accessToken()}`, ...extra }),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const encrypt = async (value: string): Promise<string> => {
  if (!publicKey) {
    const body = await abha('GET', '/profile/public/certificate');
    const key = String(body?.publicKey || '').replace(/\s/g, '');
    if (!key) throw new ApiError(UPSTREAM, 'ABDM did not send its public key');
    publicKey = `-----BEGIN PUBLIC KEY-----\n${key.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`;
  }
  // RSA/ECB/OAEPWithSHA-1AndMGF1Padding, as the certificate API names it.
  return crypto
    .publicEncrypt(
      { key: publicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha1' },
      Buffer.from(value, 'utf8')
    )
    .toString('base64');
};

const GENDERS: Record<string, string> = { M: 'Male', F: 'Female', O: 'Other', T: 'Other' };

/** dd-mm-yyyy, or the day/month/year fields, as yyyy-mm-dd; '' when unknown. */
const isoDate = (p: any): string => {
  const raw = String(p?.dob || p?.dateOfBirth || '');
  const m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  if (p?.yearOfBirth && p?.monthOfBirth && p?.dayOfBirth) {
    return `${p.yearOfBirth}-${String(p.monthOfBirth).padStart(2, '0')}-${String(p.dayOfBirth).padStart(2, '0')}`;
  }
  return '';
};

/** An ABHA address as ABDM writes it, with the CM suffix when it came without one. */
const fullAddress = (value: unknown): string => {
  const text = formatAbhaAddress(value);
  if (!text) return '';
  return text.includes('@') ? text : `${text}@${ENV.ABDM_CM_ID === 'sbx' ? 'sbx' : 'abdm'}`;
};

/** The KYC'd profile, in the shape the patient form reads. */
export interface AbhaProfile {
  abhaNumber: string;
  abhaAddress: string;
  name: string;
  gender: string;
  dateOfBirth: string;
  mobile: string;
  address: string;
  state: string;
  district: string;
  pinCode: string;
  /** A data: URI ready for an <img>; '' when ABDM sent none. */
  photo: string;
}

const toProfile = (p: any): AbhaProfile => {
  const name =
    p?.name ||
    [p?.firstName, p?.middleName, p?.lastName]
      .map((s: any) => String(s ?? '').trim())
      .filter(Boolean)
      .join(' ');
  const addresses: string[] = Array.isArray(p?.phrAddress) ? p.phrAddress : [];
  return {
    abhaNumber: formatAbhaNumber(p?.ABHANumber || p?.abhaNumber || p?.healthIdNumber || ''),
    abhaAddress: fullAddress(p?.preferredAbhaAddress || addresses[0] || ''),
    name: String(name || ''),
    gender: GENDERS[String(p?.gender || '').toUpperCase()] || '',
    dateOfBirth: isoDate(p),
    mobile: String(p?.mobile || ''),
    address: String(p?.address || ''),
    state: String(p?.stateName || ''),
    district: String(p?.districtName || ''),
    pinCode: String(p?.pinCode || p?.pincode || ''),
    photo: photoDataUri(p?.photo || p?.profilePhoto || p?.kycPhoto || ''),
  };
};

const profileFromXToken = async (xToken: string): Promise<AbhaProfile> =>
  toProfile(await abha('GET', '/profile/account', undefined, { 'X-token': `Bearer ${xToken}` }));

const digits = (value: string) => String(value ?? '').replace(/\D/g, '');
/** The last ten digits, so +91 or a leading 0 typed at the desk still reads. */
const mobile10 = (value: string) => digits(value).slice(-10);

/** Which OTP the desk asked for when verifying an ABHA. */
export type LoginMethod = 'abha-aadhaar-otp' | 'abha-mobile-otp' | 'mobile-otp';

const LOGIN: Record<LoginMethod, { scope: string[]; loginHint: string; otpSystem: string }> = {
  'abha-aadhaar-otp': { scope: ['abha-login', 'aadhaar-verify'], loginHint: 'abha-number', otpSystem: 'aadhaar' },
  'abha-mobile-otp': { scope: ['abha-login', 'mobile-verify'], loginHint: 'abha-number', otpSystem: 'abdm' },
  'mobile-otp': { scope: ['abha-login', 'mobile-verify'], loginHint: 'mobile', otpSystem: 'abdm' },
};

const failed = (body: any) => {
  if (body?.authResult && body.authResult !== 'success') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, body.message || 'OTP could not be verified');
  }
};

export class AbdmService {
  /* ------------------------------ Verify ------------------------------ */

  static async loginRequestOtp(method: LoginMethod, value: string) {
    const rule = LOGIN[method];
    const loginId = rule.loginHint === 'mobile' ? mobile10(value) : formatAbhaNumber(value);
    const body = await abha('POST', '/profile/login/request/otp', {
      scope: rule.scope,
      loginHint: rule.loginHint,
      loginId: await encrypt(loginId),
      otpSystem: rule.otpSystem,
    });
    return { txnId: body.txnId as string, message: String(body.message || 'OTP sent') };
  }

  /**
   * By ABHA number the OTP opens the profile straight away. By mobile it opens
   * the list of ABHAs on that number, and the desk picks the patient's.
   */
  static async loginVerifyOtp(method: LoginMethod, txnId: string, otp: string) {
    const body = await abha('POST', '/profile/login/verify', {
      scope: LOGIN[method].scope,
      authData: { authMethods: ['otp'], otp: { txnId, otpValue: await encrypt(otp) } },
    });
    failed(body);
    const nextTxn = body.txnId || txnId;

    if (LOGIN[method].loginHint === 'mobile') {
      remember(nextTxn, { tToken: body.token });
      const accounts = (Array.isArray(body.accounts) ? body.accounts : []).map((a: any) => ({
        abhaNumber: formatAbhaNumber(a.ABHANumber),
        abhaAddress: fullAddress(a.preferredAbhaAddress),
        name: String(a.name || ''),
        gender: GENDERS[String(a.gender || '').toUpperCase()] || '',
        dateOfBirth: isoDate(a),
      }));
      if (!accounts.length) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'No ABHA is linked to this mobile');
      return { txnId: nextTxn, accounts };
    }

    return { txnId: nextTxn, profile: await profileFromXToken(body.token) };
  }

  /** After a mobile login: the ABHA the desk picked from the list. */
  static async loginPickAccount(txnId: string, abhaNumber: string) {
    const { tToken } = recall(txnId);
    if (!tToken) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Verify the mobile OTP first');
    const body = await abha(
      'POST',
      '/profile/login/verify/user',
      { ABHANumber: formatAbhaNumber(abhaNumber), txnId },
      { 'T-token': `Bearer ${tToken}` }
    );
    journeys.delete(txnId);
    return { profile: await profileFromXToken(body.token) };
  }

  /* ------------------------------ Create ------------------------------ */

  static async enrolRequestOtp(aadhaar: string) {
    const body = await abha('POST', '/enrollment/request/otp', {
      txnId: '',
      scope: ['abha-enrol'],
      loginHint: 'aadhaar',
      loginId: await encrypt(digits(aadhaar)),
      otpSystem: 'aadhaar',
    });
    return { txnId: body.txnId as string, message: String(body.message || 'OTP sent to the Aadhaar-linked mobile') };
  }

  /**
   * Makes the ABHA (or finds the one this Aadhaar already has). ABDM leaves the
   * profile's mobile empty when the one given is not the Aadhaar-linked mobile;
   * that one then has its own OTP before it is the ABHA's.
   */
  static async enrolVerifyOtp(txnId: string, otp: string, mobile: string) {
    const body = await abha('POST', '/enrollment/enrol/byAadhaar', {
      authData: {
        authMethods: ['otp'],
        otp: { txnId, otpValue: await encrypt(otp), mobile: mobile10(mobile) },
      },
      consent: { code: 'abha-enrollment', version: '1.4' },
    });
    const nextTxn = body.txnId || txnId;
    if (body.tokens?.token) remember(nextTxn, { xToken: body.tokens.token });
    const profile = toProfile(body.ABHAProfile || {});
    return {
      txnId: nextTxn,
      isNew: body.isNew !== false,
      message: String(body.message || ''),
      mobileVerified: mobile10(profile.mobile) === mobile10(mobile),
      profile,
    };
  }

  static async enrolMobileOtp(txnId: string, mobile: string) {
    const body = await abha('POST', '/enrollment/request/otp', {
      txnId,
      scope: ['abha-enrol', 'mobile-verify'],
      loginHint: 'mobile',
      loginId: await encrypt(mobile10(mobile)),
      otpSystem: 'abdm',
    });
    return { txnId: carry(txnId, body.txnId), message: String(body.message || 'OTP sent') };
  }

  static async enrolMobileVerify(txnId: string, otp: string) {
    const body = await abha('POST', '/enrollment/auth/byAbdm', {
      scope: ['abha-enrol', 'mobile-verify'],
      authData: {
        authMethods: ['otp'],
        otp: { timeStamp: new Date().toISOString(), txnId, otpValue: await encrypt(otp) },
      },
    });
    failed(body);
    return { txnId: carry(txnId, body.txnId), message: String(body.message || 'Mobile verified') };
  }

  static async enrolSuggestions(txnId: string) {
    const body = await abha('GET', '/enrollment/enrol/suggestion', undefined, { Transaction_Id: txnId });
    return { txnId: carry(txnId, body.txnId), suggestions: (body.abhaAddressList || []) as string[] };
  }

  /** Sets the address and reads the finished profile back. */
  static async enrolSetAddress(txnId: string, abhaAddress: string) {
    const body = await abha('POST', '/enrollment/enrol/abha-address', {
      txnId,
      abhaAddress: formatAbhaAddress(abhaAddress).replace(/@.*$/, ''),
      preferred: 1,
    });
    return { profile: await AbdmService.enrolProfile(txnId, body) };
  }

  /** The profile at the end of creation, from the X-token when there is one. */
  static async enrolProfile(txnId: string, fallback: any = {}): Promise<AbhaProfile> {
    const found = journeys.get(txnId);
    if (found?.xToken) {
      journeys.delete(txnId);
      return profileFromXToken(found.xToken);
    }
    return toProfile(fallback);
  }
}
