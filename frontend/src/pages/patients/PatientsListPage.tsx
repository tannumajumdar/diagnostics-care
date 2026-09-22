import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientApi } from '../../api/patient.api';
import { Patient } from '../../types';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Users, Plus, Search, Eye, History, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../config/roles';
import { ageLabel } from '../../utils/age';

export const PatientsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canSeeHistory = hasPermission(user, PERMISSIONS.PATIENT_HISTORY);
  const canBill = hasPermission(user, PERMISSIONS.BILL_CREATE);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['patients', searchTerm, page],
    queryFn: () =>
      patientApi.getAll({
        search: searchTerm,
        page,
        limit: 10,
      }),
  });

  /** True once the desk has typed something to look a patient up. */
  const isSearching = searchTerm.trim().length > 0;

  const patientsList: Patient[] = data?.patients || (Array.isArray(data) ? data : []);
  const totalPages = data?.meta?.totalPages || data?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            <span>Patient Directory</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Register new patients, view unique UHID records, medical history, invoices, and diagnostic test tracking.
          </p>
        </div>
        <Button onClick={() => navigate('/patients/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Register New Patient</span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by UHID, patient name, mobile..."
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
                <th className="p-3">UHID</th>
                <th className="p-3">Patient Name</th>
                <th className="p-3">Age / Gender</th>
                <th className="p-3">Mobile & Contact</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading patient records...
                  </td>
                </tr>
              ) : patientsList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No patients registered yet.
                  </td>
                </tr>
              ) : (
                patientsList.map((p: Patient) => (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600">{p.uhid}</td>
                    <td className="p-3 font-bold text-foreground">{p.patientName}</td>
                    <td className="p-3 text-muted-foreground">
                      {ageLabel(p)} / {p.gender}
                    </td>
                    <td className="p-3">{p.mobile}</td>
                    <td className="p-3">
                      <Badge variant={p.status === 'Active' ? 'success' : 'destructive'}>{p.status}</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-1">
                        {/* Only on rows the desk actually searched for. On a
                            plain directory listing this is a billing button
                            next to every patient in the register, which is one
                            mis-click away from a bill on the wrong person;
                            after a search the rows are the patient in front of
                            the desk, and the button is the next thing they do. */}
                        {canBill && isSearching && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/billing/new?patientId=${p.id}`)}
                            className="gap-1 text-xs"
                            title={`Raise a new bill for ${p.patientName}`}
                          >
                            <Receipt className="h-4 w-4" /> New bill
                          </Button>
                        )}
                        {canSeeHistory && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/patients/${p.id}/history`)}
                            className="gap-1 text-xs"
                            title={`Past visits, bills and reports for ${p.patientName}`}
                          >
                            <History className="h-4 w-4" /> History
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/patients/${p.id}`)}
                          className="gap-1 text-xs"
                        >
                          <Eye className="h-4 w-4" /> Profile
                        </Button>
                      </div>
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
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
