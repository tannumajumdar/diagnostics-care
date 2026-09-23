import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { landingPathFor } from '../config/roles';
import { Button } from '../components/ui/button';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
  FlaskConical,
  ShieldCheck,
} from 'lucide-react';

const DEMO_ACCOUNTS = [
  {
    label: 'Admin',
    desk: 'Full access',
    email: 'admin@lms.com',
    password: 'Admin@123456',
    initials: 'AD',
    tint: 'bg-blue-50 text-blue-700 ring-blue-200',
  },
  {
    label: 'Pathologist',
    desk: 'Verify & sign',
    email: 'pathologist@lms.com',
    password: 'User@123456',
    initials: 'PA',
    tint: 'bg-violet-50 text-violet-700 ring-violet-200',
  },
  {
    label: 'Technician',
    desk: 'Result entry',
    email: 'technician@lms.com',
    password: 'User@123456',
    initials: 'TE',
    tint: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
  {
    label: 'Receptionist',
    desk: 'Front desk',
    email: 'receptionist@lms.com',
    password: 'User@123456',
    initials: 'RE',
    tint: 'bg-amber-50 text-amber-700 ring-amber-200',
  },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeDemo, setActiveDemo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const signedIn = await login(email, password);
      navigate(landingPathFor(signedIn));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid login credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const applyDemo = (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setActiveDemo(account.email);
    setError('');
  };

  const fieldClass =
    'h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10';

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-5 py-10">
      {/* Two slow blooms give the page depth; the grid drawn over them keeps it
          reading as an instrument rather than a poster. */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[38rem] w-[38rem] rounded-full bg-blue-600/25 blur-[130px] lms-drift" />
      <div
        className="pointer-events-none absolute -bottom-52 -right-32 h-[34rem] w-[34rem] rounded-full bg-sky-400/20 blur-[130px] lms-drift"
        style={{ animationDelay: '-11s' }}
      />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:52px_52px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_72%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/70 via-transparent to-slate-950/80" />

      <div className="lms-rise relative w-full max-w-[26rem]">
        {/* Brand mark sits above the card, so the card itself stays the form. */}
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-400 to-blue-700 text-white shadow-lg shadow-blue-900/50 ring-1 ring-white/20">
            <FlaskConical className="h-6 w-6" />
          </div>
          <p className="mt-3.5 text-lg font-semibold tracking-tight text-white">LMS</p>
          <p className="text-[12px] text-slate-400">Laboratory Management System</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white p-7 shadow-[0_32px_80px_-24px_rgba(2,6,23,0.75)] sm:p-9">
          <header className="mb-7">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to reach your role dashboard.</p>
          </header>

          {error && (
            <div
              role="alert"
              className="lms-rise mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-medium text-red-700"
            >
              <AlertCircle className="mt-px h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Email address
              </label>
              <div className="group relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@lms.com"
                  className={fieldClass}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Password
              </label>
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`${fieldClass} pr-12`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="group h-12 w-full gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-sm text-white shadow-lg shadow-blue-600/25 transition hover:from-blue-700 hover:to-indigo-700 hover:shadow-xl hover:shadow-blue-600/30"
            >
              <span>Sign in</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </form>

          <div className="mt-8">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Demo accounts
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {DEMO_ACCOUNTS.map((account) => {
                const isActive = activeDemo === account.email;
                return (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => applyDemo(account)}
                    aria-pressed={isActive}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                      isActive
                        ? 'border-blue-500 bg-blue-50/70 ring-2 ring-blue-500/15'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5'
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ring-1 ring-inset ${account.tint}`}
                    >
                      {account.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-slate-800">{account.label}</span>
                      <span className="block truncate text-[11px] text-slate-400">{account.desk}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <p className="mt-3.5 text-[12px] leading-relaxed text-slate-400">
              Selecting an account fills the form — press{' '}
              <span className="font-medium text-slate-500">Sign in</span> to continue.
            </p>
          </div>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Encrypted session · Access is logged against your role
        </p>
      </div>
    </div>
  );
};
