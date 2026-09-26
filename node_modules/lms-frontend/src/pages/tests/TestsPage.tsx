import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { testApi } from '../../api/test.api';
import { departmentApi } from '../../api/department.api';
import { organizationApi } from '../../api/organization.api';
import { LabTest, Department, Organization } from '../../types';
import { TestModal } from '../../components/masters/TestModal';
import { ParameterMasterModal } from '../../components/masters/ParameterMasterModal';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { CATALOGUE_QUERY_KEYS } from '../../utils/query-options';
import {
  FlaskConical,
  Plus,
  Search,
  Edit2,
  Power,
  ListChecks,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export const TestsPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  /**
   * The billing and visit screens hold the catalogue in their own cache. Drop
   * it whenever the master changes, or a test added here is not offered at the
   * desk in this session until that cache expires.
   */
  const refreshDeskCatalogue = () => {
    CATALOGUE_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
  };

  const [tests, setTests] = useState<LabTest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [testTypeFilter, setTestTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  // '' every test, 'own' the centre's catalogue alone, or one TPA's tests.
  const [tpaFilter, setTpaFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalTests, setTotalTests] = useState<number>(0);

  // Modal States
  const [testModalOpen, setTestModalOpen] = useState<boolean>(false);
  const [paramModalOpen, setParamModalOpen] = useState<boolean>(false);
  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    test: LabTest | null;
    action: 'status' | 'delete';
  }>({
    isOpen: false,
    test: null,
    action: 'status',
  });

  const fetchTests = async () => {
    try {
      setIsLoading(true);
      const data = await testApi.getAll({
        search: searchTerm,
        department: departmentFilter || undefined,
        testType: testTypeFilter || undefined,
        status: statusFilter || undefined,
        tpa: tpaFilter || undefined,
        page,
        limit: 10,
      });
      setTests(data?.tests || (Array.isArray(data) ? data : []));
      setTotalPages(data?.pagination?.totalPages || data?.meta?.totalPages || 1);
      setTotalTests(data?.pagination?.total || data?.meta?.total || 0);
    } catch {
      showToast('Failed to load laboratory tests', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchDepts = async () => {
      try {
        const res = await departmentApi.getAll({ limit: 100, status: 'Active' });
        setDepartments(asList<Department>(res, 'departments'));
      } catch {
        // Ignore
      }
    };
    fetchDepts();
    organizationApi
      .getAll({ limit: 500, status: 'Active' })
      .then((res) => setOrganizations(asList<Organization>(res, 'organizations')))
      .catch(() => setOrganizations([]));
  }, []);

  useEffect(() => {
    fetchTests();
  }, [searchTerm, departmentFilter, testTypeFilter, statusFilter, tpaFilter, page]);

  const handleCreateNew = () => {
    setSelectedTest(null);
    setTestModalOpen(true);
  };

  const handleEdit = (test: LabTest) => {
    setSelectedTest(test);
    setTestModalOpen(true);
  };

  const handleToggleStatusClick = (test: LabTest) => {
    setConfirmDialog({ isOpen: true, test, action: 'status' });
  };

  const handleDeleteClick = (test: LabTest) => {
    setConfirmDialog({ isOpen: true, test, action: 'delete' });
  };

  const closeConfirm = () => setConfirmDialog({ isOpen: false, test: null, action: 'status' });

  const handleConfirmDelete = async () => {
    if (!confirmDialog.test) return;
    try {
      await testApi.remove(confirmDialog.test.id);
      showToast(`${confirmDialog.test.testName} deleted`, 'success');
      closeConfirm();
      refreshDeskCatalogue();
      // The last row of a page disappears with it - step back so the table is
      // not left showing an empty page.
      if (tests.length === 1 && page > 1) setPage((p) => p - 1);
      else fetchTests();
    } catch (error: any) {
      // A test already on a bill or in the lab queue cannot go; the server
      // says why and offers deactivating instead.
      showToast(
        error?.message || error?.response?.data?.message || 'Failed to delete test',
        'error'
      );
      closeConfirm();
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!confirmDialog.test) return;
    try {
      await testApi.toggleStatus(confirmDialog.test.id);
      showToast(
        `Test ${confirmDialog.test.testName} ${
          confirmDialog.test.status === 'Active' ? 'deactivated' : 'activated'
        } successfully`,
        'success'
      );
      closeConfirm();
      refreshDeskCatalogue();
      fetchTests();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleModalSubmit = async (formData: any) => {
    try {
      if (selectedTest) {
        await testApi.update(selectedTest.id, formData);
        showToast('Lab test updated successfully', 'success');
      } else {
        await testApi.create(formData);
        showToast('Lab test created successfully', 'success');
      }
      setTestModalOpen(false);
      refreshDeskCatalogue();
      fetchTests();
    } catch (error: any) {
      showToast(error?.message || error?.response?.data?.message || 'Operation failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-blue-600" />
            <span>Laboratory Test Master</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure test catalog, sample vials, reference ranges, TAT, and parameter definitions.
          </p>
        </div>
        <div className="flex gap-2">
          {/* One window for every test's parameters - pick the test inside it. */}
          <Button variant="outline" onClick={() => setParamModalOpen(true)} className="gap-2">
            <ListChecks className="h-4 w-4 text-blue-600" />
            <span>Edit Parameter</span>
          </Button>
          <Button onClick={handleCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>Add New Test</span>
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search test name, code, sample..."
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={departmentFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setDepartmentFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Departments</option>
              {departments.map((dept: Department) => (
                <option key={dept.id} value={dept.id}>
                  {dept.departmentName}
                </option>
              ))}
            </select>

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={testTypeFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setTestTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Categories</option>
              <option value="Routine">Routine</option>
              <option value="Special">Special</option>
              <option value="Urgent">Urgent STAT</option>
              <option value="Profile">Profile Panel</option>
            </select>

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={statusFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              value={tpaFilter}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                setTpaFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Tests</option>
              <option value="own">Own Catalogue</option>
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  TPA: {o.organizationName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">Test Code & Name</th>
                <th className="p-3">Department</th>
                <th className="p-3">Sample Container</th>
                <th className="p-3">Processing</th>
                <th className="p-3">Standard Rate</th>
                <th className="p-3">Dr. Rate</th>
                <th className="p-3">TAT</th>
                <th className="p-3">Params</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    <div className="flex justify-center items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span>Loading test catalog...</span>
                    </div>
                  </td>
                </tr>
              ) : tests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    No lab tests found.
                  </td>
                </tr>
              ) : (
                tests.map((test: LabTest) => (
                  <tr key={test.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3">
                      <div className="font-bold text-foreground">{test.testName}</div>
                      <div className="font-mono text-[11px] text-blue-600 font-semibold">{test.testCode}</div>
                      {test.tpa && typeof test.tpa === 'object' && (
                        <Badge variant="amber" className="mt-0.5">
                          TPA: {test.tpa.organizationName}
                        </Badge>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {typeof test.department === 'object' ? test.department.departmentName : 'N/A'}
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-foreground">{test.sampleContainer}</div>
                      <div className="text-[11px] text-muted-foreground">{test.sampleType}</div>
                    </td>
                    <td className="p-3">
                      {test.processingMode === 'Outsource' ? (
                        <>
                          <Badge variant="amber">Outsource</Badge>
                          {test.outsourceLab && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">{test.outsourceLab}</div>
                          )}
                        </>
                      ) : (
                        <Badge variant="success">In-house</Badge>
                      )}
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-600">₹{test.rate}</td>
                    {/* The doctor's copy prints this one. A test saved before
                        referral rates existed reads back at its own rate. */}
                    <td className="p-3 font-mono font-semibold text-violet-600">
                      ₹{Number(test.referralRate) || Number(test.rate) || 0}
                    </td>
                    <td className="p-3 text-muted-foreground">{test.turnaroundTime}</td>
                    <td className="p-3 font-semibold text-blue-600">
                      {/* A parameter with a row per age / sex band counts once. */}
                      {
                        new Set(
                          (test.parameters || [])
                            .filter((p) => p.resultType !== 'Header')
                            .map((p) => String(p.parameterName || '').trim().toLowerCase())
                        ).size
                      }{' '}
                      Params
                    </td>
                    <td className="p-3">
                      <Badge variant={test.status === 'Active' ? 'success' : 'destructive'}>
                        {test.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEdit(test)}
                        title="Edit Test Details"
                      >
                        <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleToggleStatusClick(test)}
                        title="Toggle Status"
                      >
                        <Power
                          className={`h-4 w-4 ${
                            test.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleDeleteClick(test)}
                        title="Delete Test"
                      >
                        <Trash2 className="h-4 w-4 text-red-500 hover:text-red-700" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t text-xs">
            <div className="text-muted-foreground">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalTests} items)
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <TestModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        onSubmit={handleModalSubmit}
        test={selectedTest}
        departments={departments}
        organizations={organizations}
      />

      <ParameterMasterModal
        isOpen={paramModalOpen}
        onClose={() => setParamModalOpen(false)}
        onSaved={() => {
          refreshDeskCatalogue();
          fetchTests();
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirm}
        onConfirm={
          confirmDialog.action === 'delete' ? handleConfirmDelete : handleConfirmToggleStatus
        }
        title={
          confirmDialog.action === 'delete'
            ? 'Delete Lab Test'
            : confirmDialog.test?.status === 'Active'
            ? 'Deactivate Lab Test'
            : 'Activate Lab Test'
        }
        message={
          confirmDialog.action === 'delete'
            ? `Permanently delete ${confirmDialog.test?.testName}? It comes off the billing screen everywhere. A test already on a bill or in the lab queue cannot be deleted - deactivate it instead.`
            : `Are you sure you want to ${
                confirmDialog.test?.status === 'Active' ? 'deactivate' : 'activate'
              } ${confirmDialog.test?.testName}?`
        }
        confirmText={
          confirmDialog.action === 'delete'
            ? 'Delete'
            : confirmDialog.test?.status === 'Active'
            ? 'Deactivate'
            : 'Activate'
        }
        variant={
          confirmDialog.action === 'delete' || confirmDialog.test?.status === 'Active'
            ? 'destructive'
            : 'default'
        }
      />
    </div>
  );
};
