import crypto from 'crypto';
import { ENV } from '../config/env';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS } from '../constants/messages';
import { formatAbhaNumber, formatAbhaAddress } from '../utils/abha.util';
import type { AbhaProfile, LoginMethod } from './abdm.service';

/**
 * A stand-in for ABDM, for while the lab has no sandbox credentials: every
 * journey of AbdmService, same inputs and same replies, with nothing sent
 * anywhere. The OTP is always DEMO_OTP. An ABHA created here is remembered
 * (until the server restarts) so it can be verified afterwards, and every
 * demo ABHA number reads 91-0000-XXXX-XXXX, which no real one does.
 */

export const DEMO_OTP = '123456';

/** live: ABDM is called. demo: this file answers. off: neither. */
export const abdmMode = (): 'live' | 'demo' | 'off' => {
  if (ENV.ABDM_DEMO === 'true') return 'demo';
  if (ENV.ABDM_CLIENT_ID && ENV.ABDM_CLIENT_SECRET) return 'live';
  // No credentials: demo while developing, never silently on a live server.
  return process.env.NODE_ENV === 'production' || ENV.ABDM_DEMO === 'false' ? 'off' : 'demo';
};

const TTL_MS = 15 * 60_000;

interface Journey {
  expiresAt: number;
  otpFor: 'login' | 'enrol' | 'mobile' | 'none';
  method?: LoginMethod;
  value?: string;
  mobile?: string;
  profile?: AbhaProfile;
  accounts?: AbhaProfile[];
}

const journeys = new Map<string, Journey>();
/** ABHAs made in demo mode, so they can be verified afterwards. */
const registry = new Map<string, AbhaProfile>();

const digits = (value: string) => String(value ?? '').replace(/\D/g, '');
const mobile10 = (value: string) => digits(value).slice(-10);
const pause = () => new Promise((resolve) => setTimeout(resolve, 400));

const open = (journey: Omit<Journey, 'expiresAt'>) => {
  const now = Date.now();
  for (const [key, value] of journeys) if (value.expiresAt < now) journeys.delete(key);
  const txnId = crypto.randomUUID();
  journeys.set(txnId, { ...journey, expiresAt: now + TTL_MS });
  return txnId;
};

const find = (txnId: string): Journey => {
  const found = journeys.get(txnId);
  if (!found || found.expiresAt < Date.now()) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This ABHA session has expired - start again');
  }
  return found;
};

const checkOtp = (otp: string) => {
  if (otp !== DEMO_OTP) throw new ApiError(HTTP_STATUS.BAD_REQUEST, `OTP did not match - in demo mode it is ${DEMO_OTP}`);
};

/** A demo ABHA number from any seed: 91-0000- and eight digits. */
const demoNumber = (seed: string) => {
  const n = parseInt(crypto.createHash('sha1').update(seed).digest('hex').slice(0, 8), 16) % 1e8;
  return formatAbhaNumber(`910000${String(n).padStart(8, '0')}`);
};

const demoProfile = (abhaNumber: string, mobile = '', name = 'Demo Patient'): AbhaProfile =>
  registry.get(abhaNumber) ?? {
    abhaNumber,
    abhaAddress: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}.${abhaNumber.slice(-4)}@sbx`,
    name,
    gender: 'Male',
    dateOfBirth: '1990-01-01',
    mobile,
    address: 'Demo address, ABDM sandbox',
    state: 'Delhi',
    district: 'New Delhi',
    pinCode: '110001',
    photo: demoPhoto(name),
  };

/** A plain silhouette with the initials, standing in for the KYC photo. */
const demoPhoto = (name: string) => {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="150" viewBox="0 0 120 150">' +
    '<rect width="120" height="150" fill="#dbeafe"/>' +
    '<circle cx="60" cy="55" r="28" fill="#93c5fd"/>' +
    '<path d="M14 150c4-34 22-52 46-52s42 18 46 52z" fill="#93c5fd"/>' +
    `<text x="60" y="64" font-family="Arial" font-size="24" font-weight="700" fill="#1e3a8a" text-anchor="middle">${initials}</text>` +
    '</svg>';
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
};

const message = (to: string) => `Demo mode - no SMS is sent. Enter ${DEMO_OTP} as the OTP for ${to}.`;

export class AbdmDemo {
  /* ------------------------------ Verify ------------------------------ */

  static async loginRequestOtp(method: LoginMethod, value: string) {
    await pause();
    const loginValue = method === 'mobile-otp' ? mobile10(value) : formatAbhaNumber(value);
    const to = method === 'mobile-otp' ? `the mobile ending ${loginValue.slice(-4)}` : `ABHA ${loginValue}`;
    return { txnId: open({ otpFor: 'login', method, value: loginValue }), message: message(to) };
  }

  /** By mobile: the ABHAs made here on that number, or two made-up ones so the picker shows. */
  static async loginVerifyOtp(method: LoginMethod, txnId: string, otp: string) {
    await pause();
    const journey = find(txnId);
    if (journey.otpFor !== 'login') throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Send the OTP first');
    checkOtp(otp);
    const value = journey.value ?? '';

    if (method === 'mobile-otp') {
      const made = [...registry.values()].filter((p) => mobile10(p.mobile) === value);
      const accounts = made.length
        ? made
        : [demoProfile(demoNumber(`${value}-1`), value), demoProfile(demoNumber(`${value}-2`), value, 'Demo Family Member')];
      journey.otpFor = 'none';
      journey.accounts = accounts;
      return {
        txnId,
        accounts: accounts.map(({ abhaNumber, abhaAddress, name, gender, dateOfBirth }) => ({
          abhaNumber,
          abhaAddress,
          name,
          gender,
          dateOfBirth,
        })),
      };
    }

    journeys.delete(txnId);
    return { txnId, profile: demoProfile(value) };
  }

  static async loginPickAccount(txnId: string, abhaNumber: string) {
    await pause();
    const journey = find(txnId);
    const picked = journey.accounts?.find((a) => a.abhaNumber === formatAbhaNumber(abhaNumber));
    if (!picked) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Verify the mobile OTP first');
    journeys.delete(txnId);
    return { profile: picked };
  }

  /* ------------------------------ Create ------------------------------ */

  static async enrolRequestOtp(aadhaar: string) {
    await pause();
    const value = digits(aadhaar);
    return {
      txnId: open({ otpFor: 'enrol', value }),
      message: message(`the mobile linked to Aadhaar XXXX XXXX ${value.slice(-4)}`),
    };
  }

  /**
   * An Aadhaar used here before gets its ABHA back (isNew false), the way ABDM
   * does. The mobile always takes its own OTP, so the demo walks every step.
   */
  static async enrolVerifyOtp(txnId: string, otp: string, mobile: string) {
    await pause();
    const journey = find(txnId);
    if (journey.otpFor !== 'enrol') throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Send the Aadhaar OTP first');
    checkOtp(otp);
    const abhaNumber = demoNumber(`aadhaar-${journey.value}`);
    const existing = registry.get(abhaNumber);
    const profile = existing ?? { ...demoProfile(abhaNumber), abhaAddress: '', mobile: '' };
    journey.otpFor = 'none';
    journey.mobile = mobile10(mobile);
    journey.profile = profile;
    return {
      txnId,
      isNew: !existing,
      message: existing ? 'This Aadhaar already has an ABHA (demo)' : 'ABHA created (demo)',
      mobileVerified: false,
      profile,
    };
  }

  static async enrolMobileOtp(txnId: string, mobile: string) {
    await pause();
    const journey = find(txnId);
    journey.mobile = mobile10(mobile);
    journey.otpFor = 'mobile';
    return { txnId, message: message(`the mobile ending ${journey.mobile.slice(-4)}`) };
  }

  static async enrolMobileVerify(txnId: string, otp: string) {
    await pause();
    const journey = find(txnId);
    if (journey.otpFor !== 'mobile' || !journey.profile) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Send the mobile OTP first');
    checkOtp(otp);
    journey.otpFor = 'none';
    journey.profile = { ...journey.profile, mobile: journey.mobile ?? '' };
    return { txnId, message: 'Mobile verified (demo)' };
  }

  static async enrolSuggestions(txnId: string) {
    await pause();
    const journey = find(txnId);
    const tail = (journey.profile?.abhaNumber ?? '').slice(-4);
    return { txnId, suggestions: [`demo.patient${tail}`, `demopatient_${tail}`, `demo.patient.1990`, `patient.demo${tail}`] };
  }

  static async enrolSetAddress(txnId: string, abhaAddress: string) {
    await pause();
    const journey = find(txnId);
    if (!journey.profile) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Verify the Aadhaar OTP first');
    const address = `${formatAbhaAddress(abhaAddress).replace(/@.*$/, '')}@sbx`;
    const taken = [...registry.values()].some((p) => p.abhaAddress === address && p.abhaNumber !== journey.profile!.abhaNumber);
    if (taken) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This ABHA address is already taken');
    const profile = { ...journey.profile, abhaAddress: address };
    registry.set(profile.abhaNumber, profile);
    journeys.delete(txnId);
    return { profile };
  }

  static async enrolProfile(txnId: string): Promise<AbhaProfile> {
    await pause();
    const journey = find(txnId);
    if (!journey.profile) throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Verify the Aadhaar OTP first');
    const profile = registry.get(journey.profile.abhaNumber) ?? journey.profile;
    journeys.delete(txnId);
    return profile;
  }
}
