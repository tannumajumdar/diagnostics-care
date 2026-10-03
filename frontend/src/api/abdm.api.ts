import api from './axios';

/** The KYC'd ABHA profile, shaped for the patient form. */
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
  photo: string;
}

export interface AbhaAccount {
  abhaNumber: string;
  abhaAddress: string;
  name: string;
  gender: string;
  dateOfBirth: string;
}

export type AbhaLoginMethod = 'abha-aadhaar-otp' | 'abha-mobile-otp' | 'mobile-otp';

/** The ABDM M1 journeys, one call per step; the server holds the tokens. */
export const abdmApi = {
  /** live: ABDM is called. demo: the server answers itself, OTP demoOtp. off: neither. */
  status: (): Promise<{ mode: 'live' | 'demo' | 'off'; demoOtp?: string }> => api.get('/abdm/status'),
  loginOtp: (method: AbhaLoginMethod, value: string): Promise<{ txnId: string; message: string }> =>
    api.post('/abdm/login/otp', { method, value }),
  loginVerify: (
    method: AbhaLoginMethod,
    txnId: string,
    otp: string
  ): Promise<{ txnId: string; profile?: AbhaProfile; accounts?: AbhaAccount[] }> =>
    api.post('/abdm/login/verify', { method, txnId, otp }),
  loginAccount: (txnId: string, abhaNumber: string): Promise<{ profile: AbhaProfile }> =>
    api.post('/abdm/login/account', { txnId, abhaNumber }),

  enrolOtp: (aadhaar: string): Promise<{ txnId: string; message: string }> => api.post('/abdm/enrol/otp', { aadhaar }),
  enrolVerify: (
    txnId: string,
    otp: string,
    mobile: string
  ): Promise<{ txnId: string; isNew: boolean; mobileVerified: boolean; message: string; profile: AbhaProfile }> =>
    api.post('/abdm/enrol/verify', { txnId, otp, mobile }),
  enrolMobileOtp: (txnId: string, mobile: string): Promise<{ txnId: string; message: string }> =>
    api.post('/abdm/enrol/mobile/otp', { txnId, mobile }),
  enrolMobileVerify: (txnId: string, otp: string): Promise<{ txnId: string; message: string }> =>
    api.post('/abdm/enrol/mobile/verify', { txnId, otp }),
  enrolSuggestions: (txnId: string): Promise<{ txnId: string; suggestions: string[] }> =>
    api.get('/abdm/enrol/suggestions', { params: { txnId } }),
  enrolAddress: (txnId: string, abhaAddress: string): Promise<{ profile: AbhaProfile }> =>
    api.post('/abdm/enrol/address', { txnId, abhaAddress }),
  enrolProfile: (txnId: string): Promise<{ profile: AbhaProfile }> => api.post('/abdm/enrol/profile', { txnId }),
};
