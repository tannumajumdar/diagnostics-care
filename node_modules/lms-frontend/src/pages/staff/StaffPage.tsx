import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../api/user.api';
import { User, UserRole } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ALL_ROLES, ROLE_PERMISSIONS, ROLE_INTRO, type Role } from '../../config/roles';
import { asList } from '../../utils/api-list';
import { UserCog, Plus, Power, Pencil, ShieldCheck, KeyRound } from 'lucide-react';

const ROLE_TONE: Record<Role, 'default' | 'secondary' | 'success' | 'amber' | 'purple'> = {
  Admin: 'default',
  Pathologist: 'purple',
  'Lab Technician': 'secondary',
  Receptionist: 'amber',
  Accountant: 'success',
  Phlebotomist: 'secondary',
};

const emptyForm = {
  name: '',
  email: '',
  password: '',
  mobile: '',
  role: 'Receptionist' as UserRole,
  status: 'Active' as 'Active' | 'Inactive',
};

/**
 * Staff and roles. Only an Admin reaches this screen, and what each role can
 * do is rendered from the shared permission matrix rather than described in
 * prose that would drift away from what the API actually allows.
 */
export const StaffPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [resetting, setResetting] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['staff', search],
    queryFn: () => userApi.getAll({ search: search || undefined, limit: 100 }),
  });

  const staff = asList<User>(data, 'users');

  const saveMutation = useMutation({
    mutationFn: (payload: any) =>
      editing ? userApi.update(editing.id, payload) : userApi.create(payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setIsFormOpen(false);
      setEditing(null);
      setForm({ ...emptyForm });
      showToast(`${res?.name ?? 'Staff account'} saved`, 'success');
    },
    onError: (err: any) => showToast(err?.message || 'Could not save this staff account', 'error'),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => userApi.resetPassword(id, password),
    onSuccess: (_res, variables) => {
      const member = staff.find((s) => s.id === variables.id);
      closeReset();
      showToast(
        `Password reset for ${member?.name ?? 'the account'}. They will be signed out and must use the new password.`,
        'success'
      );
    },
    onError: (err: any) => showToast(err?.message || 'Could not reset this password', 'error'),
  });

  const statusMutation = useMutation({
    mutationFn: (id: string) => userApi.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      showToast('Account status updated', 'success');
    },
    onError: (err: any) => showToast(err?.message || 'Could not change this account', 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setIsFormOpen(true);
  };

  const openEdit = (member: User) => {
    setEditing(member);
    setForm({
      name: member.name,
      email: member.email,
      password: '',
      mobile: member.mobile ?? '',
      role: member.role,
      status: member.status,
    });
    setIsFormOpen(true);
  };

  const openReset = (member: User) => {
    setResetting(member);
    setNewPassword('');
    setConfirmPassword('');
  };

  const closeReset = () => {
    setResetting(null);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetting) return;
    if (newPassword !== confirmPassword) {
      showToast('The two passwords do not match', 'error');
      return;
    }
    resetMutation.mutate({ id: resetting.id, password: newPassword });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      name: form.name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim(),
      role: form.role,
      status: form.status,
    };
    // On an edit the password field is left blank unless it is being reset.
    if (form.password) payload.password = form.password;
    saveMutation.mutate(payload);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <UserCog className="h-6 w-6 text-blue-600" />
            <span>Staff &amp; Roles</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Add the people who work at the centre and decide what each of them can reach.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" /> Add Staff
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff by name or email"
            className="max-w-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Staff Accounts ({staff.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b bg-muted/50 font-semibold">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Mobile</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y border-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Loading staff...
                    </td>
                  </tr>
                ) : staff.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No staff accounts yet.
                    </td>
                  </tr>
                ) : (
                  staff.map((member) => (
                    <tr key={member.id} className="hover:bg-muted/30">
                      <td className="p-3 font-bold">
                        {member.name}
                        {member.id === currentUser?.id && (
                          <span className="ml-1 text-[11px] font-normal text-muted-foreground">(you)</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground">{member.email}</td>
                      <td className="p-3 font-mono text-muted-foreground">{member.mobile}</td>
                      <td className="p-3">
                        <Badge variant={ROLE_TONE[member.role as Role] ?? 'secondary'}>{member.role}</Badge>
                      </td>
                      <td className="p-3">
                        <Badge variant={member.status === 'Active' ? 'success' : 'destructive'}>
                          {member.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            title={`Edit ${member.name}'s details`}
                            onClick={() => openEdit(member)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title={`Reset ${member.name}'s password`}
                            onClick={() => openReset(member)}
                          >
                            <KeyRound className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={member.id === currentUser?.id || statusMutation.isPending}
                            title={
                              member.id === currentUser?.id
                                ? 'You cannot deactivate your own account'
                                : 'Toggle account status'
                            }
                            onClick={() => statusMutation.mutate(member.id)}
                          >
                            <Power className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* What each role reaches - read straight off the permission matrix */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            What Each Role Can Do
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 text-xs md:grid-cols-2 lg:grid-cols-3">
          {ALL_ROLES.map((role) => (
            <div key={role} className="space-y-2 rounded-xl border p-3">
              <div>
                <Badge variant={ROLE_TONE[role]}>{role}</Badge>
                <p className="mt-1.5 text-[12px] text-muted-foreground">{ROLE_INTRO[role].subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {ROLE_PERMISSIONS[role].map((permission) => (
                  <span
                    key={permission}
                    className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600"
                  >
                    {permission}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Setting someone else's password. Kept apart from the edit form so a
          reset is a deliberate act with its own confirmation, rather than a
          field somebody fills in while correcting a phone number. */}
      {resetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
                <KeyRound className="h-4 w-4 text-amber-600" />
                Reset Password
              </h2>
              <button onClick={closeReset} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                ✕
              </button>
            </div>

            <div className="rounded-lg bg-slate-50 p-3 text-xs">
              <p className="font-bold text-foreground">{resetting.name}</p>
              <p className="text-muted-foreground">
                {resetting.email} · <span className="font-semibold">{resetting.role}</span>
              </p>
            </div>

            <form onSubmit={handleReset} className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-semibold">New Password *</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  autoFocus
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold">Confirm New Password *</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Type it again"
                />
              </div>

              <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[12px] text-amber-800">
                {resetting.id === currentUser?.id
                  ? 'This is your own account. Your current session stays signed in.'
                  : `${resetting.name} will be signed out everywhere and must use the new password. Hand it over in person.`}
              </p>

              <div className="flex justify-end gap-2 border-t pt-2">
                <Button type="button" variant="outline" onClick={closeReset}>
                  Cancel
                </Button>
                <Button type="submit" disabled={resetMutation.isPending}>
                  {resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-base font-bold text-foreground">
                {editing ? `Edit ${editing.name}` : 'Add Staff Member'}
              </h2>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="mb-1 block font-semibold">Full Name *</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">Email *</label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Mobile *</label>
                  <Input
                    value={form.mobile}
                    onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                    className="h-10 w-full rounded-xl border bg-background px-3"
                  >
                    {ALL_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' })}
                    className="h-10 w-full rounded-xl border bg-background px-3"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold">
                  {editing ? 'New Password (leave blank to keep current)' : 'Password *'}
                </label>
                <Input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={!editing}
                  minLength={6}
                  placeholder={editing ? 'Unchanged' : 'At least 6 characters'}
                />
              </div>

              <p className="rounded-lg bg-slate-50 p-2 text-[12px] text-muted-foreground">
                {ROLE_INTRO[form.role as Role]?.subtitle}
              </p>

              <div className="flex justify-end gap-2 border-t pt-2">
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {editing ? 'Save Changes' : 'Add Staff'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
