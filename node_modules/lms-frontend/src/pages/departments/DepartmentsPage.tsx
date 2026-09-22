import React, { useState, useEffect } from 'react';
import { departmentApi } from '../../api/department.api';
import { Department } from '../../types';
import { DepartmentModal } from '../../components/masters/DepartmentModal';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { useToast } from '../../context/ToastContext';
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Power,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const DepartmentsPage: React.FC = () => {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalDepts, setTotalDepts] = useState<number>(0);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    dept: Department | null;
  }>({
    isOpen: false,
    dept: null,
  });

  const fetchDepartments = async () => {
    try {
      setIsLoading(true);
      const data = await departmentApi.getAll({
        search: searchTerm,
        status: statusFilter || undefined,
        page,
        limit: 10,
      });
      setDepartments(data?.departments || (Array.isArray(data) ? data : []));
      setTotalPages(data?.pagination?.totalPages || data?.meta?.totalPages || 1);
      setTotalDepts(data?.pagination?.total || data?.meta?.total || 0);
    } catch {
      showToast('Failed to load departments', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, [searchTerm, statusFilter, page]);

  const handleCreateNew = () => {
    setSelectedDept(null);
    setIsModalOpen(true);
  };

  const handleEdit = (dept: Department) => {
    setSelectedDept(dept);
    setIsModalOpen(true);
  };

  const handleToggleStatusClick = (dept: Department) => {
    setConfirmDialog({
      isOpen: true,
      dept,
    });
  };

  const handleConfirmToggleStatus = async () => {
    if (!confirmDialog.dept) return;
    try {
      await departmentApi.toggleStatus(confirmDialog.dept.id);
      showToast(
        `Department ${confirmDialog.dept.departmentName} ${
          confirmDialog.dept.status === 'Active' ? 'deactivated' : 'activated'
        } successfully`,
        'success'
      );
      setConfirmDialog({ isOpen: false, dept: null });
      fetchDepartments();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleModalSubmit = async (formData: any) => {
    try {
      if (selectedDept) {
        await departmentApi.update(selectedDept.id, formData);
        showToast('Department updated successfully', 'success');
      } else {
        await departmentApi.create(formData);
        showToast('Department created successfully', 'success');
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (error: any) {
      showToast(error?.message || error?.response?.data?.message || 'Operation failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" />
            <span>Department Master</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Configure diagnostic departments, specialty labs, and operational divisions.
          </p>
        </div>
        <Button onClick={handleCreateNew} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Add Department</span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search department name or code..."
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
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">Department Name</th>
                <th className="p-3">Code</th>
                <th className="p-3">Description</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <div className="flex justify-center items-center gap-2">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                      <span>Loading departments...</span>
                    </div>
                  </td>
                </tr>
              ) : departments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No departments found.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-bold text-foreground">{dept.departmentName}</td>
                    <td className="p-3 font-mono font-semibold text-blue-600">{dept.departmentCode}</td>
                    <td className="p-3 text-muted-foreground max-w-xs truncate">
                      {dept.description || 'N/A'}
                    </td>
                    <td className="p-3">
                      <Badge variant={dept.status === 'Active' ? 'success' : 'destructive'}>
                        {dept.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleEdit(dept)}
                      >
                        <Edit2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleToggleStatusClick(dept)}
                      >
                        <Power
                          className={`h-4 w-4 ${
                            dept.status === 'Active' ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        />
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
              Page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalDepts} items)
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

      <DepartmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        department={selectedDept}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, dept: null })}
        onConfirm={handleConfirmToggleStatus}
        title={confirmDialog.dept?.status === 'Active' ? 'Deactivate Department' : 'Activate Department'}
        message={`Are you sure you want to ${
          confirmDialog.dept?.status === 'Active' ? 'deactivate' : 'activate'
        } ${confirmDialog.dept?.departmentName}?`}
        confirmText={confirmDialog.dept?.status === 'Active' ? 'Deactivate' : 'Activate'}
        variant={confirmDialog.dept?.status === 'Active' ? 'destructive' : 'default'}
      />
    </div>
  );
};
