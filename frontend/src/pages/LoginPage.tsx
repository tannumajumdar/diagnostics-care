import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { landingPathFor } from '../config/roles';
import { Button } from '../components/ui/button';
import { Lock, Mail, Eye, EyeOff, AlertCircle, Check, ArrowRight, FlaskConical } from 'lucide-react';

const HIGHLIGHTS = [
  'Chain-of-custody tracking from accession to report',
  'Two-step result entry and pathologist verification',
  'Role-based access across every operational desk',
];

const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@lms.com', password: 'Admin@123456', dot: 'bg-blue-600' },
  { label: 'Pathologist', email: 'pathologist@lms.com', password: 'User@123456', dot: 'bg-violet-600' },
  { label: 'Technician', email: 'technician@lms.com', password: 'User@123456', dot: 'bg-emerald-600' },
  { label: 'Receptionist', email: 'receptionist@lms.com', password: 'User@123456', dot: 'bg-amber-500' },
];

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    setError('');
  };

  const fieldClass =
    'h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';

  return (
    <div className="min-h-screen w-full bg-white lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="relative hidden select-none flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:flex xl:p-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(59,130,246,0.30),transparent_55%),radial-gradient(circle_at_88%_82%,rgba(56,189,248,0.16),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] bg-[linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] bg-[size:44px_44px]" />

        <div className="relative flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-900/40">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">LMS</p>
            <p className="text-[11px] text-slate-400">Laboratory Management System</p>
          </div>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-[2.6rem] font-semibold leading-[1.1] tracking-tight">
            Diagnostics,
            <br />
            <span className="bg-gradient-to-r from-blue-300 to-sky-200 bg-clip-text text-transparent">
              end to end.
            </span>
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            Registration, billing, sample logistics, result verification and reporting — running on one auditable
            record for every patient.
          </p>

          <ul className="mt-9 space-y-4">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-blue-500/15 ring-1 ring-inset ring-blue-400/30">
                  <Check className="h-3 w-3 text-blue-300" />
                </span>
                <span className="text-sm leading-snug text-slate-300">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10">
          {[
            { value: '7', label: 'Access roles' },
            { value: 'Full', label: 'Sample audit trail' },
            { value: 'Versioned', label: 'Result history' },
          ].map((stat) => (
            <div key={stat.label} className="bg-slate-950/80 px-4 py-4">
              <p className="text-base font-semibold tracking-tight text-white">{stat.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-10 lg:min-h-0">
        <div className="w-full max-w-sm">
          {/* Compact brand mark for small screens */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg shadow-blue-500/25">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-tight text-slate-900">LMS</p>
              <p className="text-[11px] text-slate-500">Laboratory Management System</p>
            </div>
          </div>

          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to reach your role dashboard.</p>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-xs font-medium text-red-700"
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
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={`${fieldClass} pr-11`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              isLoading={isLoading}
              className="group h-11 w-full gap-2 rounded-xl bg-slate-900 text-sm shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
            >
              <span>Sign in</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </form>

          <div className="mt-9">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Demo accounts
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account, index) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => applyDemo(account)}
                  className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow ${
                    index === DEMO_ACCOUNTS.length - 1 && DEMO_ACCOUNTS.length % 2 !== 0 ? 'col-span-2' : ''
                  }`}
                >
                  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${account.dot}`} />
                  <span className="truncate">{account.label}</span>
                </button>
              ))}
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
              Selecting an account fills the form — press <span className="font-medium text-slate-500">Sign in</span> to
              continue.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
