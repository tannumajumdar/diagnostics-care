import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { organizationApi } from '../../api/organization.api';
import { Organization } from '../../types';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { OrganizationModal } from '../../components/masters/OrganizationModal';
import { useToast } from '../../context/ToastContext';
import { Building, Search, Plus, Pencil, Power } from 'lucide-react';

export const OrganizationsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', searchTerm, page],
    queryFn: () => organizationApi.getAll({ search: searchTerm, page, limit: 10 }),
  });

  const orgsList: Organization[] = data?.organizations || (Array.isArray(data) ? data : []);

  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);

  // Every screen that lists TPAs (patient form, test modal, intake) reads 'organizations'.
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['organizations'] });

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const save = async (payload: any) => {
    try {
      if (editing) {
        await organizationApi.update(editing.id, payload);
        showToast(`${payload.organizationName} updated`, 'success');
      } else {
        await organizationApi.create(payload);
        showToast(`${payload.organizationName} added`, 'success');
      }
      setModalOpen(false);
      refresh();
    } catch (err: any) {
      showToast(err?.message || 'Could not save the TPA', 'error');
    }
  };

  const toggle = async (org: Organization) => {
    try {
      await organizationApi.toggleStatus(org.id);
      showToast(`${org.organizationName} ${org.status === 'Active' ? 'deactivated' : 'activated'}`, 'success');
      refresh();
    } catch (err: any) {
      showToast(err?.message || 'Could not change the status', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl [&>svg]:shrink-0">
          <Building className="h-6 w-6 text-blue-600" />
          <span>Organization & TPA Master</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Corporate clients, insurance TPAs, contracted tariffs & credit billing limits.
        </p>
      </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4" />
          Add TPA / Organization
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organization, contact person..."
            className="pl-9 text-xs"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">Organization Name</th>
                <th className="p-3">Contact Person</th>
                <th className="p-3">Contract Rate</th>
                <th className="p-3">Credit Limit</th>
                <th className="p-3">Payment Terms</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading organizations...
                  </td>
                </tr>
              ) : orgsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No TPA or organization yet - add one with the button above.
                  </td>
                </tr>
              ) : (
                orgsList.map((org: Organization) => (
                  <tr key={org.id} className="hover:bg-muted/30">
                    <td className="p-3 font-bold text-foreground">{org.organizationName}</td>
                    <td className="p-3">
                      <div>{org.contactPerson}</div>
                      <div className="text-[11px] text-muted-foreground">{org.mobile}</div>
                    </td>
                    <td className="p-3 font-semibold text-blue-600">{org.contractRate}</td>
                    <td className="p-3 font-mono font-bold text-emerald-600">₹{org.creditLimit}</td>
                    <td className="p-3 text-muted-foreground">{org.paymentTerms}</td>
                    <td className="p-3">
                      <Badge variant={org.status === 'Active' ? 'success' : 'destructive'}>{org.status}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                          onClick={() => {
                            setEditing(org);
                            setModalOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`gap-1 ${org.status === 'Active' ? 'text-red-600' : 'text-emerald-600'}`}
                          onClick={() => toggle(org)}
                        >
                          <Power className="h-3.5 w-3.5" />
                          {org.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <OrganizationModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={save}
        organization={editing}
      />
    </div>
  );
};
