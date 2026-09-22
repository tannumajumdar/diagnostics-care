import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientApi } from '../../api/patient.api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, CreditCard, TestTube, History, Receipt } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../config/roles';
import { ageLabel } from '../../utils/age';

export const PatientDetailsPage: React.FC<{ isNew?: boolean }> = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientApi.getById(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading patient profile...</div>;
  if (!data?.patient) return <div className="p-8 text-center text-muted-foreground">Patient profile not found.</div>;

  const { patient, invoices = [], testHistory = [] } = data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{patient.patientName}</h1>
          <p className="text-xs text-muted-foreground font-mono">UHID: {patient.uhid}</p>
        </div>
        {hasPermission(user, PERMISSIONS.PATIENT_HISTORY) && (
          <Button variant="outline" size="sm" onClick={() => navigate(`/patients/${id}/history`)} className="gap-1.5">
            <History className="h-4 w-4" /> Full history
          </Button>
        )}
        {hasPermission(user, PERMISSIONS.BILL_CREATE) && (
          <Button size="sm" onClick={() => navigate(`/billing/new?patientId=${id}`)} className="gap-1.5">
            <Receipt className="h-4 w-4" /> New bill
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground font-semibold uppercase">Age / Gender</p>
            <p className="text-sm font-bold text-foreground">{ageLabel(patient)} / {patient.gender}</p>
          </div>
          <div>
            <p className="text-muted-foreground font-semibold uppercase">Mobile & Contact</p>
            <p className="text-sm font-bold text-foreground">{patient.mobile}</p>
          </div>
          <div>
            <p className="text-muted-foreground font-semibold uppercase">Status</p>
            <Badge variant="success">{patient.status}</Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Invoices History ({invoices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-xs">
              {invoices.length === 0 ? (
                <p className="p-4 text-muted-foreground">No invoices generated yet.</p>
              ) : (
                (invoices || []).map((inv: any) => (
                  <div key={inv._id} className="p-3 flex justify-between items-center hover:bg-muted/20">
                    <div>
                      <p className="font-mono font-bold text-blue-600">{inv.invoiceNumber}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold font-mono">₹{inv.netAmount}</p>
                      <Badge variant={inv.paymentStatus === 'Paid' ? 'success' : 'amber'}>{inv.paymentStatus}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TestTube className="h-5 w-5 text-purple-600" />
              Test Samples ({(testHistory || []).length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-xs">
              {(testHistory || []).length === 0 ? (
                <p className="p-4 text-muted-foreground">No test samples registered.</p>
              ) : (
                (testHistory || []).map((s: any) => (
                  <div key={s._id} className="p-3 flex justify-between items-center hover:bg-muted/20">
                    <div>
                      <p className="font-bold text-foreground">{s.testName}</p>
                      <p className="text-[10px] font-mono text-muted-foreground">Sample ID: {s.sampleId}</p>
                    </div>
                    <Badge variant="secondary">{s.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

