import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { rolePermissionApi, RolePermissionMatrix } from '../../api/rolePermission.api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../context/ToastContext';
import { ShieldCheck, Lock, RotateCcw, Save } from 'lucide-react';

type Draft = Record<string, string[]>;

const sameSet = (a: string[] = [], b: string[] = []) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * Which role may do what. Every guard on the server reads this matrix, so a
 * box ticked here is the action that role can take - and a box cleared is a
 * screen and a button that role no longer gets. The Admin column is fixed so
 * the centre can never lock itself out.
 */
export const RolePermissionsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery<RolePermissionMatrix>({
    queryKey: ['role-permissions'],
    queryFn: () => rolePermissionApi.getMatrix(),
  });

  useEffect(() => {
    if (!data) return;
    setDraft(Object.fromEntries(data.roles.map((r) => [r.role, [...r.permissions]])));
  }, [data]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, RolePermissionMatrix['catalog']>();
    (data?.catalog || []).forEach((entry) => {
      byGroup.set(entry.group, [...(byGroup.get(entry.group) || []), entry]);
    });
    return Array.from(byGroup.entries());
  }, [data]);

  const roles = data?.roles || [];
  const changedRoles = roles.filter((r) => !r.locked && !sameSet(draft[r.role], r.permissions));

  const toggle = (role: string, key: string) =>
    setDraft((prev) => {
      const current = prev[role] || [];
      return { ...prev, [role]: current.includes(key) ? current.filter((k) => k !== key) : [...current, key] };
    });

  /** Tick or clear a whole group for one role. */
  const toggleGroup = (role: string, keys: string[]) =>
    setDraft((prev) => {
      const current = prev[role] || [];
      const allOn = keys.every((k) => current.includes(k));
      return {
        ...prev,
        [role]: allOn ? current.filter((k) => !keys.includes(k)) : Array.from(new Set([...current, ...keys])),
      };
    });

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const r of changedRoles) {
        await rolePermissionApi.updateRole(r.role, draft[r.role] || []);
      }
      showToast(
        `Saved permissions for ${changedRoles.map((r) => r.role).join(', ')}. Staff see the change on their next page load.`,
        'success'
      );
      await queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    } catch (err: any) {
      showToast(err?.message || 'Could not save permissions', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (role: string) => {
    if (!window.confirm(`Put ${role} back on the default permissions?`)) return;
    try {
      await rolePermissionApi.resetRole(role);
      showToast(`${role} is back on the default permissions`, 'success');
      await queryClient.invalidateQueries({ queryKey: ['role-permissions'] });
    } catch (err: any) {
      showToast(err?.message || 'Could not reset permissions', 'error');
    }
  };

  const discard = () => {
    if (!data) return;
    setDraft(Object.fromEntries(data.roles.map((r) => [r.role, [...r.permissions]])));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl [&>svg]:shrink-0">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <span>Role Permissions</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Tick what each role may do. Staff can only open the screens and use the buttons their role is given.
          </p>
        </div>
        <div className="flex gap-2">
          {changedRoles.length > 0 && (
            <Button variant="outline" onClick={discard} disabled={saving}>
              Discard
            </Button>
          )}
          <Button onClick={handleSave} disabled={!changedRoles.length || saving} isLoading={saving} className="gap-2">
            <Save className="h-4 w-4" />
            Save changes{changedRoles.length ? ` (${changedRoles.length})` : ''}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 border-b bg-muted/80 font-semibold text-muted-foreground backdrop-blur">
              <tr>
                <th className="min-w-[16rem] p-3">Permission</th>
                {roles.map((r) => (
                  <th key={r.role} className="min-w-[7.5rem] p-3 text-center align-top">
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1 text-foreground">
                        {r.locked && <Lock className="h-3 w-3" />}
                        {r.role}
                      </span>
                      {r.locked ? (
                        <span className="text-[10px] font-normal">Always everything</span>
                      ) : (
                        <>
                          {!sameSet(draft[r.role], r.permissions) ? (
                            <Badge variant="amber">Unsaved</Badge>
                          ) : r.customised ? (
                            <Badge variant="purple">Custom</Badge>
                          ) : (
                            <Badge variant="secondary">Default</Badge>
                          )}
                          {r.customised && (
                            <button
                              type="button"
                              onClick={() => handleReset(r.role)}
                              className="flex items-center gap-1 text-[10px] font-normal text-blue-600 hover:underline"
                            >
                              <RotateCcw className="h-3 w-3" /> Reset
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={roles.length + 1} className="p-8 text-center text-muted-foreground">
                    Loading permissions...
                  </td>
                </tr>
              ) : (
                groups.map(([group, entries]) => {
                  const keys = entries.map((e) => e.key);
                  return (
                    <React.Fragment key={group}>
                      <tr className="border-y bg-muted/40">
                        <td className="p-2 pl-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          {group}
                        </td>
                        {roles.map((r) => {
                          const on = draft[r.role] || [];
                          const count = keys.filter((k) => on.includes(k)).length;
                          return (
                            <td key={r.role} className="p-2 text-center">
                              <button
                                type="button"
                                disabled={r.locked}
                                onClick={() => toggleGroup(r.role, keys)}
                                className="text-[10px] font-semibold text-blue-600 hover:underline disabled:text-muted-foreground disabled:no-underline"
                                title={r.locked ? undefined : 'Tick or clear the whole group'}
                              >
                                {count}/{keys.length}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                      {entries.map((entry) => (
                        <tr key={entry.key} className="border-b border-border hover:bg-muted/20">
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{entry.label}</div>
                            <div className="text-[11px] text-muted-foreground">{entry.description}</div>
                          </td>
                          {roles.map((r) => {
                            const checked = r.locked || (draft[r.role] || []).includes(entry.key);
                            const changed =
                              !r.locked && checked !== r.permissions.includes(entry.key);
                            return (
                              <td key={r.role} className={`p-3 text-center ${changed ? 'bg-amber-50' : ''}`}>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                                  checked={checked}
                                  disabled={r.locked}
                                  onChange={() => toggle(r.role, entry.key)}
                                  aria-label={`${r.role}: ${entry.label}`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
