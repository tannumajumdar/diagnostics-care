import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { abdmApi, type AbhaAccount, type AbhaLoginMethod, type AbhaProfile } from '../../api/abdm.api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { typeAbhaNumber, typeIdProofNumber } from '../../utils/abha';
import { BadgeCheck, FlaskConical, ShieldCheck, X } from 'lucide-react';

/**
 * The two ABDM Milestone 1 journeys the desk runs, as a dialog over the
 * patient form:
 *
 *  - verify: an ABHA the patient already has, by OTP to the ABHA number or
 *    to the mobile, ending in the KYC'd profile;
 *  - create: a new ABHA from Aadhaar OTP, the communication mobile and an
 *    ABHA address.
 *
 * Either way the profile goes back through onDone and the form fills itself.
 * Rendered on document.body, so Enter in its boxes never submits the form
 * it was opened from.
 * The Aadhaar number goes to the server only to be encrypted for ABDM.
 */

type Step = 'start' | 'otp' | 'accounts' | 'mobile-otp' | 'address';

interface Props {
  mode: 'verify' | 'create';
  isOpen: boolean;
  onClose: () => void;
  onDone: (profile: AbhaProfile) => void;
  /** Whatever the form already has, so the desk does not type it twice. */
  initial?: { abhaNumber?: string; mobile?: string; aadhaar?: string };
}

const METHODS: { value: AbhaLoginMethod; label: string; hint: string }[] = [
  { value: 'abha-mobile-otp', label: 'ABHA number - OTP on ABHA mobile', hint: 'OTP to the mobile linked to the ABHA' },
  { value: 'abha-aadhaar-otp', label: 'ABHA number - OTP on Aadhaar mobile', hint: 'OTP to the Aadhaar-linked mobile' },
  { value: 'mobile-otp', label: 'Mobile number', hint: 'Lists every ABHA on that mobile' },
];

const selectClass =
  'flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label className="mb-1 block text-xs font-semibold">{children}</label>
);

const otpDigits = (value: string) => value.replace(/\D/g, '').slice(0, 6);

export const AbhaDialog: React.FC<Props> = ({ mode, isOpen, onClose, onDone, initial }) => {
  const [step, setStep] = useState<Step>('start');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [txnId, setTxnId] = useState('');
  const [otp, setOtp] = useState('');

  // verify
  const [method, setMethod] = useState<AbhaLoginMethod>('abha-mobile-otp');
  const [loginValue, setLoginValue] = useState('');
  const [accounts, setAccounts] = useState<AbhaAccount[]>([]);

  // create
  const [aadhaar, setAadhaar] = useState('');
  const [mobile, setMobile] = useState('');
  const [consent, setConsent] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [address, setAddress] = useState('');
  // Whether ABDM made a new ABHA or found the one this Aadhaar already had.
  const [isNew, setIsNew] = useState(true);

  const { data: status } = useQuery({
    queryKey: ['abdm-status'],
    queryFn: abdmApi.status,
    enabled: isOpen,
    staleTime: 5 * 60_000,
  });

  // Every opening starts over: a txnId from an earlier attempt is dead.
  useEffect(() => {
    if (!isOpen) return;
    setStep('start');
    setBusy(false);
    setError('');
    setNotice('');
    setTxnId('');
    setOtp('');
    setAccounts([]);
    setSuggestions([]);
    setAddress('');
    setConsent(false);
    setMethod(initial?.abhaNumber ? 'abha-mobile-otp' : 'mobile-otp');
    setLoginValue(initial?.abhaNumber ? typeAbhaNumber(initial.abhaNumber) : (initial?.mobile ?? ''));
    setAadhaar(initial?.aadhaar ? typeIdProofNumber('Aadhaar', initial.aadhaar) : '');
    setMobile(initial?.mobile ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  /** Runs one ABDM step; its error is shown in the dialog, not as a toast. */
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (err: any) {
      setError(err?.message || 'ABDM did not accept that - try again');
    } finally {
      setBusy(false);
    }
  };

  const finish = (profile: AbhaProfile) => {
    onDone(profile);
    onClose();
  };

  /* ------------------------------ verify ------------------------------ */

  const sendLoginOtp = () =>
    run(async () => {
      const res = await abdmApi.loginOtp(method, loginValue);
      setTxnId(res.txnId);
      setOtp('');
      setNotice(res.message);
      setStep('otp');
    });

  const verifyLoginOtp = () =>
    run(async () => {
      const res = await abdmApi.loginVerify(method, txnId, otp);
      setTxnId(res.txnId);
      if (res.profile) return finish(res.profile);
      const list = res.accounts ?? [];
      if (list.length === 1) {
        const picked = await abdmApi.loginAccount(res.txnId, list[0].abhaNumber);
        return finish(picked.profile);
      }
      setAccounts(list);
      setStep('accounts');
    });

  const pickAccount = (abhaNumber: string) =>
    run(async () => {
      const res = await abdmApi.loginAccount(txnId, abhaNumber);
      finish(res.profile);
    });

  /* ------------------------------ create ------------------------------ */

  const sendAadhaarOtp = () =>
    run(async () => {
      const res = await abdmApi.enrolOtp(aadhaar);
      setTxnId(res.txnId);
      setOtp('');
      setNotice(res.message);
      setStep('otp');
    });

  /** The address step for a new ABHA; an Aadhaar that already had one is done. */
  const afterMobile = async (txn: string, isNew: boolean) => {
    if (!isNew) {
      const res = await abdmApi.enrolProfile(txn);
      return finish(res.profile);
    }
    const res = await abdmApi.enrolSuggestions(txn).catch(() => ({ txnId: txn, suggestions: [] as string[] }));
    setTxnId(res.txnId);
    setSuggestions(res.suggestions);
    setAddress(res.suggestions[0]?.toLowerCase() ?? '');
    setNotice('');
    setStep('address');
  };

  const verifyAadhaarOtp = () =>
    run(async () => {
      const res = await abdmApi.enrolVerify(txnId, otp, mobile);
      setTxnId(res.txnId);
      setIsNew(res.isNew);
      if (!res.mobileVerified) {
        const sent = await abdmApi.enrolMobileOtp(res.txnId, mobile);
        setTxnId(sent.txnId);
        setOtp('');
        setNotice(`${res.isNew ? 'ABHA created. ' : 'This Aadhaar already has an ABHA. '}${sent.message}`);
        setStep('mobile-otp');
        return;
      }
      await afterMobile(res.txnId, res.isNew);
    });

  const verifyMobileOtp = () =>
    run(async () => {
      const res = await abdmApi.enrolMobileVerify(txnId, otp);
      setTxnId(res.txnId);
      await afterMobile(res.txnId, isNew);
    });

  const setAbhaAddress = () =>
    run(async () => {
      const res = await abdmApi.enrolAddress(txnId, address);
      finish(res.profile);
    });

  const resend = () =>
    run(async () => {
      const res =
        step === 'mobile-otp'
          ? await abdmApi.enrolMobileOtp(txnId, mobile)
          : mode === 'create'
            ? await abdmApi.enrolOtp(aadhaar)
            : await abdmApi.loginOtp(method, loginValue);
      setTxnId(res.txnId);
      setOtp('');
      setNotice(res.message);
    });

  /* ------------------------------- view -------------------------------- */

  const otpBox = (onSubmit: () => void, label: string) => (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <Input
          value={otp}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOtp(otpDigits(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && otp.length === 6 && onSubmit()}
          placeholder="6-digit OTP"
          className="font-mono tracking-widest"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="text-[11px] font-semibold text-blue-600 hover:underline" onClick={resend} disabled={busy}>
          Resend OTP
        </button>
        <Button type="button" size="sm" isLoading={busy} disabled={otp.length !== 6} onClick={onSubmit}>
          Verify OTP
        </Button>
      </div>
    </div>
  );

  const mobileOk = /^[6-9]\d{9}$/.test(mobile.replace(/\D/g, '').slice(-10));
  const aadhaarOk = /^\d{12}$/.test(aadhaar.replace(/\s/g, ''));
  const loginOk =
    method === 'mobile-otp'
      ? /^[6-9]\d{9}$/.test(loginValue.replace(/\D/g, '').slice(-10))
      : /^\d{14}$/.test(loginValue.replace(/\D/g, ''));
  const addressOk = /^[a-z0-9][a-z0-9._]{7,17}$/.test(address.replace(/@.*$/, ''));

  let body: React.ReactNode = null;
  if (mode === 'verify') {
    if (step === 'start') {
      body = (
        <div className="space-y-3">
          <div>
            <Label>Verify using</Label>
            <select
              className={selectClass}
              value={method}
              onChange={(e) => {
                const next = e.target.value as AbhaLoginMethod;
                setMethod(next);
                setLoginValue(next === 'mobile-otp' ? (initial?.mobile ?? '') : typeAbhaNumber(initial?.abhaNumber ?? ''));
              }}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {METHODS.find((m) => m.value === method)?.hint}
            </span>
          </div>
          <div>
            <Label>{method === 'mobile-otp' ? 'Mobile Number' : 'ABHA Number'}</Label>
            <Input
              value={loginValue}
              inputMode="numeric"
              autoFocus
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLoginValue(method === 'mobile-otp' ? e.target.value.replace(/[^\d+]/g, '').slice(0, 13) : typeAbhaNumber(e.target.value))
              }
              onKeyDown={(e) => e.key === 'Enter' && loginOk && sendLoginOtp()}
              placeholder={method === 'mobile-otp' ? '10-digit mobile' : '12-3456-7890-1234'}
              className="font-mono"
            />
          </div>
          <div className="flex justify-end">
            <Button type="button" size="sm" isLoading={busy} disabled={!loginOk} onClick={sendLoginOtp}>
              Send OTP
            </Button>
          </div>
        </div>
      );
    } else if (step === 'otp') {
      body = otpBox(verifyLoginOtp, 'OTP');
    } else if (step === 'accounts') {
      body = (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground">More than one ABHA is on this mobile - pick the patient's.</p>
          {accounts.map((a) => (
            <button
              key={a.abhaNumber}
              type="button"
              disabled={busy}
              onClick={() => pickAccount(a.abhaNumber)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-xs hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
            >
              <span>
                <span className="block font-semibold">{a.name || 'Unnamed'}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {[a.gender, a.dateOfBirth, a.abhaAddress].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="font-mono text-[11px]">{a.abhaNumber}</span>
            </button>
          ))}
        </div>
      );
    }
  } else if (step === 'start') {
    body = (
      <div className="space-y-3">
        <div>
          <Label>Aadhaar Number</Label>
          <Input
            value={aadhaar}
            inputMode="numeric"
            autoFocus
            autoComplete="off"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAadhaar(typeIdProofNumber('Aadhaar', e.target.value))}
            placeholder="1234 5678 9012"
            className="font-mono"
          />
        </div>
        <div>
          <Label>Mobile for ABHA</Label>
          <Input
            value={mobile}
            inputMode="numeric"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMobile(e.target.value.replace(/[^\d+]/g, '').slice(0, 13))}
            placeholder="10-digit mobile"
            className="font-mono"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            If it is not the Aadhaar-linked mobile, it gets its own OTP.
          </span>
        </div>
        <label className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-[11px] leading-relaxed">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            The patient agrees to share their Aadhaar number and demographic details with ABDM (NHA) to create an
            Ayushman Bharat Health Account, and has been told the Aadhaar OTP is used only for this.
          </span>
        </label>
        <div className="flex justify-end">
          <Button type="button" size="sm" isLoading={busy} disabled={!aadhaarOk || !mobileOk || !consent} onClick={sendAadhaarOtp}>
            Send Aadhaar OTP
          </Button>
        </div>
      </div>
    );
  } else if (step === 'otp') {
    body = otpBox(verifyAadhaarOtp, 'OTP sent to the Aadhaar-linked mobile');
  } else if (step === 'mobile-otp') {
    body = otpBox(verifyMobileOtp, `OTP sent to ${mobile}`);
  } else if (step === 'address') {
    body = (
      <div className="space-y-3">
        <div>
          <Label>ABHA Address</Label>
          <Input
            value={address}
            autoFocus
            autoCapitalize="none"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAddress(e.target.value.replace(/\s/g, '').toLowerCase())}
            placeholder="name.surname"
          />
          <span className="mt-1 block text-[11px] text-muted-foreground">8 to 18 letters, digits, dots or underscores.</span>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setAddress(s.toLowerCase())}
                className={`rounded-full border px-2.5 py-1 text-[11px] ${
                  address === s.toLowerCase() ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950' : 'hover:bg-muted'
                }`}
              >
                {s.toLowerCase()}
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button type="button" size="sm" isLoading={busy} disabled={!addressOk} onClick={setAbhaAddress}>
            Create ABHA Address
          </Button>
        </div>
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl border bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="flex items-center gap-2">
            {mode === 'verify' ? (
              <BadgeCheck className="h-5 w-5 text-blue-600" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-blue-600" />
            )}
            <div>
              <h2 className="text-sm font-bold">{mode === 'verify' ? 'Verify ABHA with ABDM' : 'Create ABHA with Aadhaar'}</h2>
              <p className="text-[11px] text-muted-foreground">The verified details fill the patient form.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 px-5 py-4 text-xs">
          {status?.mode === 'demo' && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <b>Demo mode</b> - ABDM is not called and no SMS goes out. Every OTP is{' '}
                <b className="font-mono">{status.demoOtp}</b>. Demo ABHA numbers start 91-0000 and are not real.
              </span>
            </div>
          )}
          {status?.mode === 'off' && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600 dark:bg-red-950 dark:text-red-300">
              ABDM is not set up on this server - add the sandbox credentials, or ABDM_DEMO=true to try it.
            </p>
          )}
          {notice && !error && (
            <p className="rounded-xl bg-blue-50 px-3 py-2 text-[11px] text-blue-700 dark:bg-blue-950 dark:text-blue-300">{notice}</p>
          )}
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-[11px] font-medium text-red-600 dark:bg-red-950 dark:text-red-300">{error}</p>
          )}
          {body}
        </div>
      </div>
    </div>,
    document.body
  );
};
