import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { landingPathFor, ALL_ROLES, Role } from '../config/roles';
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

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, logout } = useAuth();
  const [role, setRole] = useState<Role | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!role) {
      setError('Select the role you are signing in as.');
      return;
    }
    setIsLoading(true);
    try {
      const signedIn = await login(email, password);
      // The role picked has to be the account's own, so a receptionist's
      // login cannot be used from the Admin entry and the other way round.
      if (signedIn.role !== role) {
        logout();
        setError(`This account is not registered as ${role}. Select your own role and try again.`);
        return;
      }
      navigate(landingPathFor(signedIn));
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Invalid login credentials');
    } finally {
      setIsLoading(false);
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
                Login As
              </label>
              <div className="group relative">
                <UserCheck className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-600" />
                <select
                  id="role-select"
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value as Role | '');
                    setError('');
                  }}
                  className={`${fieldClass} cursor-pointer font-medium text-slate-800 pr-10 appearance-none`}
                  required
                >
                  <option value="">-- Select your role --</option>
                  {ALL_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
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
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
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
            Select your role, then sign in with your own email and password.
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
