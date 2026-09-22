import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { packageApi } from '../../api/package.api';
import { testApi } from '../../api/test.api';
import { LabTest, TestPackage } from '../../types';
import { PackageModal } from '../../components/masters/PackageModal';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { CATALOGUE_QUERY_KEYS } from '../../utils/query-options';
import { Package, Plus, Search, Edit2, Power, Trash2 } from 'lucide-react';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/**
 * The panel master - what the centre sells as one thing at one price.
 *
 * A package never changes how the lab works: the tests inside it are drawn,
 * run and reported exactly as they are on any other bill. It only decides
 * what the whole set costs, which is why every row here is read against the
 * sum of its parts.
 */
export const PackagesPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [packages, setPackages] = useState<TestPackage[]>([]);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<TestPackage | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    pkg: TestPackage | null;
    action: 'status' | 'delete';
  }>({ isOpen: false, pkg: null, action: 'status' });

  /** The desk holds the catalogue in its own cache - drop it when a panel changes. */
  const refreshDeskCatalogue = () => {
    CATALOGUE_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const fetchPackages = async () => {
    try {
      setIsLoading(true);
      const data = await packageApi.getAll({
        search: searchTerm || undefined,
        status: statusFilter || undefined,
        limit: 100,
      });
      setPackages(asList<TestPackage>(data, 'packages'));
    } catch {
      showToast('Failed to load test packages', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // The whole active catalogue, so the panel builder can pick from all of
    // it rather than from one page of it.
    const fetchTests = async () => {
      try {
        const res = await testApi.getAll({ limit: 500, status: 'Active' });
        setTests(asList<LabTest>(res, 'tests'));
      } catch {
        showToast('Could not load the test catalogue', 'error');
      }
    };
    fetchTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, statusFilter]);

  const closeConfirm = () => setConfirmDialog({ isOpen: false, pkg: null, action: 'status' });

  const handleSubmit = async (formData: any) => {
    try {
      if (selected) {
        await packageApi.update(selected.id, formData);
        showToast(`${formData.packageName} updated`, 'success');
      } else {
        await packageApi.create(formData);
        showToast(`${formData.packageName} created`, 'success');
      }
      setModalOpen(false);
      refreshDeskCatalogue();
      fetchPackages();
    } catch (error: any) {
      showToast(error?.message || error?.response?.data?.message || 'Operation failed', 'error');
    }
  };

  const handleConfirmToggle = async () => {
    if (!confirmDialog.pkg) return;
    try {
      await packageApi.toggleStatus(confirmDialog.pkg.id);
      showToast(
        `${confirmDialog.pkg.packageName} ${
          confirmDialog.pkg.status === 'Active' ? 'deactivated' : 'activated'
        }`,
        'success'
      );
      closeConfirm();
      refreshDeskCatalogue();
      fetchPackages();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDialog.pkg) return;
    try {
      await packageApi.remove(confirmDialog.pkg.id);
      showToast(`${confirmDialog.pkg.packageName} deleted`, 'success');
      closeConfirm();
      refreshDeskCatalogue();
      fetchPackages();
    } catch (error: any) {
      // A panel already billed cannot go; the server says so and offers
      // deactivating instead.
      showToast(error?.message || error?.response?.data?.message || 'Failed to delete package', 'error');
      closeConfirm();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <Package className="h-6 w-6 text-violet-600" />
            <span>Test Packages</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Panels the centre sells at one price - full body checkups, fever profiles, ante-natal panels. The
            desk adds a package and every test inside it goes on the bill.
          </p>
        </div>
        <Button
          onClick={() => {
            setSelected(null);
            setModalOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Package</span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search package name or code..."
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Package</th>
                <th className="p-3">Tests Included</th>
                <th className="p-3">Billed Separately</th>
                <th className="p-3">Package Price</th>
                <th className="p-3">Patient Saves</th>
                <th className="p-3">Dr. Price</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                      <span>Loading packages...</span>
                    </div>
                  </td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No packages yet. Add one and the front desk can bill a whole panel in a single tap.
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => {
                  const listTotal =
                    Number(pkg.listTotal) ||
                    (pkg.tests || []).reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
                  const saving = listTotal - Number(pkg.rate || 0);

                  return (
                    <tr key={pkg.id} className="transition-colors hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-bold text-foreground">{pkg.packageName}</div>
                        <div className="font-mono text-[10px] font-semibold text-violet-600">
                          {pkg.packageCode}
                        </div>
                        {pkg.description && (
                          <div className="mt-0.5 max-w-xs truncate text-[10px] text-muted-foreground">
                            {pkg.description}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{(pkg.tests || []).length} tests</div>
                        <div className="max-w-xs truncate text-[10px] text-muted-foreground">
                          {(pkg.tests || []).map((t) => t.testName).join(', ') || '-'}
                        </div>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground line-through">{money(listTotal)}</td>
                      <td className="p-3 font-mono font-bold text-emerald-600">{money(pkg.rate)}</td>
                      <td className="p-3">
                        {saving > 0 ? (
                          <Badge variant="success">{money(saving)}</Badge>
                        ) : saving < 0 ? (
                          <Badge variant="amber">+{money(-saving)}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-semibold text-violet-600">
                        {Number(pkg.referralRate) > 0 ? (
                          money(Number(pkg.referralRate))
                        ) : (
                          <span
                            className="text-[10px] font-normal text-muted-foreground"
                            title="Falls back to each test's own referral rate"
                          >
                            per test
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant={pkg.status === 'Active' ? 'success' : 'destructive'}>
                          {pkg.status}
                        </Badge>
                      </td>
                      <td className="space-x-1 p-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelected(pkg);
                            setModalOpen(true);
                          }}
                          title="Edit package"
                        >
                          <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setConfirmDialog({ isOpen: true, pkg, action: 'status' })}
                          title="Toggle status"
                        >
                          <Power
                            className={`h-4 w-4 ${
                              pkg.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'
                            }`}
                          />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setConfirmDialog({ isOpen: true, pkg, action: 'delete' })}
                          title="Delete package"
                        >
                          <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <PackageModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        pkg={selected}
        tests={tests}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmDialog.action === 'delete' ? handleConfirmDelete : handleConfirmToggle}
        title={
          confirmDialog.action === 'delete'
            ? 'Delete Test Package'
            : confirmDialog.pkg?.status === 'Active'
            ? 'Deactivate Package'
            : 'Activate Package'
        }
        message={
          confirmDialog.action === 'delete'
            ? `Permanently delete ${confirmDialog.pkg?.packageName}? It comes off the billing screen everywhere. A package already on a bill cannot be deleted - deactivate it instead.`
            : `Are you sure you want to ${
                confirmDialog.pkg?.status === 'Active' ? 'deactivate' : 'activate'
              } ${confirmDialog.pkg?.packageName}?`
        }
        confirmText={
          confirmDialog.action === 'delete'
            ? 'Delete'
            : confirmDialog.pkg?.status === 'Active'
            ? 'Deactivate'
            : 'Activate'
        }
        variant={
          confirmDialog.action === 'delete' || confirmDialog.pkg?.status === 'Active'
            ? 'destructive'
            : 'default'
        }
      />
    </div>
  );
};
