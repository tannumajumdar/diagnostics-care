import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { navForUser, groupFor, GROUP_ORDER, ROLE_INTRO, type NavItem, type Role } from '../../config/roles';
import { LogOut, Menu, X, Activity, ChevronDown, LayoutDashboard } from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  /**
   * The menu is built from the same permission matrix the API enforces, so a
   * desk is only ever offered what its token can actually open.
   */
  const sections = useMemo(() => {
    const items = navForUser(user);
    return GROUP_ORDER.map((group) => ({
      group,
      items: items.filter((item: NavItem) => groupFor(item, user) === group),
    })).filter((section) => section.items.length > 0);
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isCurrent = (item: NavItem) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (navContainerRef.current && !navContainerRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine active section based on current route
  const activeSection = useMemo(() => {
    for (const section of sections) {
      if (section.items.some((item) => isCurrent(item))) {
        return section;
      }
    }
    return sections[0];
  }, [sections, location.pathname]);

  const heading = ROLE_INTRO[user?.role as Role]?.title ?? 'Diagnostic Centre';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased">
      {/* ── Mobile Navigation Drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-slate-900 text-slate-100 shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-base font-bold leading-tight tracking-tight text-white">LMS Diagnostic</h1>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-indigo-400">Diagnostic Centre</p>
                </div>
              </div>
              <button
                className="text-slate-400 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <nav className="scrollbar-thin scrollbar-thumb-slate-700 flex-1 space-y-4 overflow-y-auto px-3 py-4">
              {sections.map((section) => (
                <div key={section.group}>
                  {section.group !== 'Overview' && (
                    <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                      {section.group}
                    </p>
                  )}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const active = isCurrent(item);
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                            active
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>

            <div className="border-t border-slate-800 bg-slate-950/80 p-4">
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200">
                    {user?.name?.charAt(0) || 'U'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-white">{user?.name || 'Staff User'}</p>
                    <p className="truncate text-[11px] text-slate-400">{user?.role || 'Operator'}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-rose-400"
                  title="Logout"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Primary Top Header Bar ── */}
      <header
        data-print="hide"
        className="relative z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950 px-4 sm:px-6 shadow-md"
      >
        {/* Left: Brand & Mobile Menu Trigger */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            title="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight text-white">LMS Diagnostic</h1>
              <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-400">Diagnostic Centre</p>
            </div>
          </Link>
        </div>

        {/* Center: Desktop Navigation Bar with Group Dropdowns */}
        <nav
          ref={navContainerRef}
          className="hidden lg:flex items-center gap-1.5"
          aria-label="Main Navigation"
        >
          {sections.map((section) => {
            // Single-item groups like 'Overview' (Dashboard) render as direct link
            if (section.group === 'Overview' || section.items.length === 1) {
              const item = section.items[0];
              const Icon = item.icon || LayoutDashboard;
              const active = isCurrent(item);
              return (
                <Link
                  key={section.group}
                  to={item.path}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            }

            const isGroupActive = activeSection?.group === section.group;
            const isOpen = openDropdown === section.group;

            return (
              <div key={section.group} className="relative">
                <button
                  type="button"
                  onClick={() => setOpenDropdown(isOpen ? null : section.group)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                    isGroupActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                  }`}
                >
                  <span>{section.group}</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isOpen && (
                  <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900 p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800/80 mb-1">
                      {section.group}
                    </div>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const Icon = item.icon;
                        const active = isCurrent(item);
                        return (
                          <Link
                            key={item.path}
                            to={item.path}
                            onClick={() => setOpenDropdown(null)}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                              active
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400'}`} />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right: Live DB Status, User Profile & Logout */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden xl:inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            Live Database
          </span>

          <div className="flex items-center gap-2 sm:gap-3 border-l border-slate-800 pl-3 sm:pl-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-xs font-bold text-slate-200">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="hidden sm:block text-left">
              <p className="max-w-[130px] truncate text-xs font-semibold text-white leading-tight">
                {user?.name || 'Staff User'}
              </p>
              <p className="max-w-[130px] truncate text-[10px] text-slate-400">
                {user?.role || 'Operator'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-rose-400"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Sub-Navigation Bar (Horizontal Tabs for Quick 1-Click Page Access) ── */}
      <div data-print="hide" className="shrink-0 border-b border-slate-200 bg-white px-4 sm:px-6 shadow-xs">
        <div className="flex h-11 items-center justify-between overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1">
            {activeSection && activeSection.group !== 'Overview' ? (
              <>
                <span className="hidden md:inline-block text-[11px] font-bold uppercase tracking-wider text-slate-600 mr-2 shrink-0">
                  {activeSection.group}:
                </span>
                <div className="flex items-center gap-1 overflow-x-auto py-1">
                  {activeSection.items.map((item) => {
                    const Icon = item.icon;
                    const active = isCurrent(item);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${active ? 'text-white' : 'text-slate-500'}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span className="font-bold text-slate-800">{heading}</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-500">
                  {ROLE_INTRO[user?.role as Role]?.subtitle ?? 'Overview and operational metrics.'}
                </span>
              </div>
            )}
          </div>

          {/* Current Desk / Context on the right */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 pl-4 text-xs font-medium text-slate-500">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {heading}
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Full-Screen Content Area ── */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="w-full">{children}</div>
      </main>
    </div>
  );
};

export const Layout = AdminLayout;
export default AdminLayout;
