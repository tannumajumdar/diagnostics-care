import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { navForUser, groupFor, GROUP_ORDER, ROLE_INTRO, type NavItem, type Role } from '../../config/roles';
import { LogOut, Menu, X, Activity } from 'lucide-react';

export const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * The menu is built from the same permission matrix the API enforces, so a
   * desk is only ever offered what its token can actually open. This used to be
   * a hardcoded list, which showed a receptionist the whole masters and
   * reporting menu and then bounced them off every one of those screens.
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

  const heading = ROLE_INTRO[user?.role as Role]?.title ?? 'Diagnostic Centre';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans text-slate-900 antialiased">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        data-print="hide"
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-slate-900 text-slate-100 transition-transform duration-200 ease-in-out md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col shadow-xl`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-800 bg-slate-950 px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-md">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight tracking-tight text-white">LMS Diagnostic</h1>
              <p className="text-[10px] font-medium uppercase tracking-wide text-indigo-400">Diagnostic Centre</p>
            </div>
          </div>
          <button className="text-slate-400 hover:text-white md:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-6 w-6" />
          </button>
        </div>

        <nav className="scrollbar-thin scrollbar-thumb-slate-700 flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.group}>
              {section.group !== 'Overview' && (
                <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
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
                      onClick={() => setSidebarOpen(false)}
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
                <p className="truncate text-[10px] text-slate-400">{user?.role || 'Operator'}</p>
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
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          data-print="hide"
          className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-slate-600 hover:text-slate-900 md:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="text-sm font-bold tracking-tight text-slate-800">{heading}</h2>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live Database Connected
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
};

export const Layout = AdminLayout;
export default AdminLayout;
