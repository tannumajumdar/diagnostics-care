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
  ChevronDown,
  UserCheck,
} from 'lucide-react';

interface QuickAccount {
  label: string;
  sublabel: string;
  email: string;
  password: string;
}

const QUICK_ACCOUNTS: { category: string; accounts: QuickAccount[] }[] = [
  {
    category: 'System Roles',
    accounts: [
      {
        label: 'Admin',
        sublabel: 'Full access',
        email: 'admin@lms.com',
        password: 'Admin@123456',
      },
      {
        label: 'Pathologist',
        sublabel: 'Verify & sign',
        email: 'pathologist@lms.com',
        password: 'User@123456',
      },
      {
        label: 'Technician',
        sublabel: 'Result entry',
        email: 'technician@lms.com',
        password: 'User@123456',
      },
    ],
  },
  {
    category: 'Front Desk / Receptionist',
    accounts: [
      {
        label: 'Receptionist - Emily Davis',
        sublabel: 'Front Desk',
        email: 'receptionist@lms.com',
        password: 'User@123456',
      },
      {
        label: 'Receptionist - Neha Sharma',
        sublabel: 'Front Desk',
        email: 'neha@lms.com',
        password: 'User@123456',
      },
      {
        label: 'Receptionist - Rohit Verma',
        sublabel: 'Front Desk',
        email: 'rohit@lms.com',
        password: 'User@123456',
      },
    ],
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
  const [selectedRoleAccount, setSelectedRoleAccount] = useState('');

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

  const handleSelectAccount = (selectedEmail: string) => {
    setSelectedRoleAccount(selectedEmail);
    if (!selectedEmail) {
      setEmail('');
      setPassword('');
      return;
    }
    for (const group of QUICK_ACCOUNTS) {
      const match = group.accounts.find((a) => a.email === selectedEmail);
      if (match) {
        setEmail(match.email);
        setPassword(match.password);
        setError('');
        break;
      }
    }
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="role-select" className="mb-1.5 block text-xs font-semibold text-slate-700">
                Select Account / Login As
              </label>
              <div className="group relative">
                <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                <select
                  id="role-select"
                  value={selectedRoleAccount}
                  onChange={(e) => handleSelectAccount(e.target.value)}
                  className={`${fieldClass} cursor-pointer font-medium text-slate-800 pr-10 appearance-none`}
                >
                  <option value="">-- Choose account to login --</option>
                  {QUICK_ACCOUNTS.map((group) => (
                    <optgroup key={group.category} label={group.category}>
                      {group.accounts.map((acc) => (
                        <option key={acc.email} value={acc.email}>
                          {acc.label} ({acc.sublabel})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

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
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setSelectedRoleAccount(e.target.value);
                  }}
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

          <p className="mt-5 text-center text-[12px] leading-relaxed text-slate-400">
            Selecting an account fills the form — press{' '}
            <span className="font-medium text-slate-500">Sign in</span> to continue.
          </p>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Encrypted session · Access is logged against your role
        </p>
      </div>
    </div>
  );
};
