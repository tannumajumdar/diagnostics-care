import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientApi } from '../../api/patient.api';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { ArrowLeft, CreditCard, TestTube, History, Receipt, Download, Printer } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { hasPermission, PERMISSIONS } from '../../config/roles';
import { ageLabel } from '../../utils/age';
import { exportToExcel } from '../../utils/excel-export';
import { invoiceExportRows } from '../../utils/invoice-export';
import { PatientBillsStatement } from '../../components/billing/PatientBillsStatement';

export const PatientDetailsPage: React.FC<{ isNew?: boolean }> = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ['patient', id],
    queryFn: () => patientApi.getById(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading patient profile...</div>;
  if (!data?.patient) return <div className="p-8 text-center text-muted-foreground">Patient profile not found.</div>;

  const { patient, invoices = [], testHistory = [] } = data;

  /** This patient's bills as a spreadsheet - the same columns the billing
      directory exports, so the two files reconcile against each other. */
  const exportBills = async () => {
    if (!invoices.length) return showToast('This patient has no bills to export', 'error');
    const slug = String(patient.uhid || patient.patientName || 'patient').replace(/[^\w-]+/g, '-');
    try {
      await exportToExcel(`bills_${slug}`, invoiceExportRows(invoices), { sheetName: 'Bills' });
      showToast(`Exported ${invoices.length} bill${invoices.length === 1 ? '' : 's'}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not export the bills', 'error');
    }
  };

  /** The statement is already in the DOM below, shown only to the printer -
      so printing is the browser's own dialog rather than a second render. */
  const printBills = () => {
    if (!invoices.length) return showToast('This patient has no bills to print', 'error');
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3" data-print="hide">
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

      <Card data-print="hide">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-print="hide">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-blue-600" />
                Invoices History ({invoices.length})
              </CardTitle>
              {/* The whole account, not one visit - a patient asking what they
                  have paid across their visits is answered from here. */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportBills} disabled={!invoices.length} className="gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Export
                </Button>
                <Button variant="outline" size="sm" onClick={printBills} disabled={!invoices.length} className="gap-1.5">
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
              </div>
            </div>
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
                      <p className="text-[11px] text-muted-foreground">{new Date(inv.createdAt).toLocaleDateString()}</p>
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
                      <p className="text-[11px] font-mono text-muted-foreground">Sample ID: {s.sampleId}</p>
                    </div>
                    <Badge variant="secondary">{s.status}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Kept out of the screen layout and handed to the printer alone, so
          Print puts the statement on paper rather than the profile page. */}
      <div className="hidden print:block">
        <PatientBillsStatement patient={patient} invoices={invoices} />
      </div>
    </div>
  );
};

