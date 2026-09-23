import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleGuard } from './components/auth/RoleGuard';
import { PERMISSIONS } from './config/roles';

import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { DepartmentsPage } from './pages/departments/DepartmentsPage';
import { DoctorsPage } from './pages/doctors/DoctorsPage';
import { TestsPage } from './pages/tests/TestsPage';
import { PackagesPage } from './pages/packages/PackagesPage';
import { RatesPage } from './pages/rates/RatesPage';
import { OrganizationsPage } from './pages/organizations/OrganizationsPage';
import { StaffPage } from './pages/staff/StaffPage';
import { PatientsListPage } from './pages/patients/PatientsListPage';
import { PatientDetailsPage } from './pages/patients/PatientDetailsPage';
import { PatientFormPage } from './pages/patients/PatientFormPage';
import { PatientHistoryPage } from './pages/patients/PatientHistoryPage';
import { BillingListPage } from './pages/billing/BillingListPage';
import { NewBillingPage } from './pages/billing/NewBillingPage';
import { InvoiceDetailsPage } from './pages/billing/InvoiceDetailsPage';
import { SamplesListPage } from './pages/samples/SamplesListPage';
import { SampleCollectionQueuePage } from './pages/samples/SampleCollectionQueuePage';
import { PendingProcessingQueuePage } from './pages/samples/PendingProcessingQueuePage';
import { ResultsListPage } from './pages/results/ResultsListPage';
import { VerificationDashboardPage } from './pages/verification/VerificationDashboardPage';
import { ResultEntryPage } from './pages/results/ResultEntryPage';
import { LabReportPage } from './pages/results/LabReportPage';
import { LabWorkflowPage } from './pages/workflow/LabWorkflowPage';
import { NewVisitPage } from './pages/visits/NewVisitPage';
import { AppointmentsPage } from './pages/appointments/AppointmentsPage';
import { HomeCollectionPage } from './pages/appointments/HomeCollectionPage';
import { PayoutsPage } from './pages/accounts/PayoutsPage';
import { AccountsPage } from './pages/accounts/AccountsPage';
import { ReportsPage } from './pages/reports/ReportsPage';
import { RefundPolicyPage } from './pages/settings/RefundPolicyPage';

const P = PERMISSIONS;

/** Wraps a screen in the same permission the API enforces for its data. */
const guarded = (permissions: (typeof P)[keyof typeof P][], element: React.ReactNode) => (
  <RoleGuard require={permissions}>{element}</RoleGuard>
);

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/unauthorized" element={<UnauthorizedPage />} />

                    {/* Masters - Admin territory */}
                    <Route
                      path="/departments"
                      element={guarded([P.DEPARTMENT_MANAGE], <DepartmentsPage />)}
                    />
                    <Route path="/doctors" element={guarded([P.DOCTOR_MANAGE], <DoctorsPage />)} />
                    <Route path="/tests" element={guarded([P.TEST_MANAGE], <TestsPage />)} />
                    <Route path="/packages" element={guarded([P.TEST_MANAGE], <PackagesPage />)} />
                    <Route path="/rates" element={guarded([P.RATE_MANAGE], <RatesPage />)} />
                    <Route
                      path="/organizations"
                      element={guarded([P.ORGANIZATION_MANAGE], <OrganizationsPage />)}
                    />
                    <Route path="/staff" element={guarded([P.STAFF_MANAGE], <StaffPage />)} />
                    {/* What a cancelled test is worth back to the patient. */}
                    <Route
                      path="/refund-policy"
                      element={guarded([P.REFUND_POLICY_MANAGE], <RefundPolicyPage />)}
                    />

                    {/* Front desk - intake is where the receptionist starts */}
                    <Route path="/visits/new" element={guarded([P.BILL_CREATE], <NewVisitPage />)} />

                    <Route path="/patients" element={guarded([P.PATIENT_VIEW], <PatientsListPage />)} />
                    <Route path="/patients/new" element={guarded([P.PATIENT_CREATE], <PatientFormPage />)} />
                    {/* The full record by visit. Its own permission, because
                        a desk that may look a patient up is not automatically
                        a desk that may read everything they have ever owed. */}
                    <Route
                      path="/patients/:id/history"
                      element={guarded([P.PATIENT_HISTORY], <PatientHistoryPage />)}
                    />
                    <Route path="/patients/:id" element={guarded([P.PATIENT_VIEW], <PatientDetailsPage />)} />

                    <Route path="/billing" element={guarded([P.BILL_VIEW], <BillingListPage />)} />
                    <Route path="/billing/new" element={guarded([P.BILL_CREATE], <NewBillingPage />)} />
                    <Route path="/billing/:id" element={guarded([P.BILL_VIEW], <InvoiceDetailsPage />)} />

                    <Route path="/appointments" element={guarded([P.APPOINTMENT_VIEW], <AppointmentsPage />)} />
                    <Route path="/home-collection" element={guarded([P.APPOINTMENT_VIEW], <HomeCollectionPage />)} />

                    {/* Money out */}
                    <Route path="/payouts" element={guarded([P.PAYOUT_VIEW], <PayoutsPage />)} />

                    {/* Laboratory */}
                    <Route path="/workflow" element={guarded([P.SAMPLE_VIEW], <LabWorkflowPage />)} />
                    <Route path="/samples" element={guarded([P.SAMPLE_VIEW], <SamplesListPage />)} />
                    <Route
                      path="/samples/collection"
                      element={guarded([P.SAMPLE_COLLECT], <SampleCollectionQueuePage />)}
                    />
                    <Route
                      path="/samples/pending"
                      element={guarded([P.SAMPLE_PROCESS], <PendingProcessingQueuePage />)}
                    />

                    <Route path="/results" element={guarded([P.RESULT_ENTER], <ResultsListPage />)} />
                    <Route
                      path="/results/pending"
                      element={guarded([P.RESULT_VERIFY], <VerificationDashboardPage />)}
                    />
                    <Route
                      path="/results/entry/:sampleId"
                      element={guarded([P.RESULT_ENTER], <ResultEntryPage />)}
                    />
                    {/* The front desk hands over the printed report. */}
                    <Route
                      path="/results/report/:resultId"
                      element={guarded([P.RESULT_VIEW, P.BILL_VIEW], <LabReportPage />)}
                    />

                    {/* Finance */}
                    <Route path="/accounts" element={guarded([P.REFUND_VIEW], <AccountsPage />)} />
                    <Route path="/reports" element={guarded([P.REPORT_VIEW], <ReportsPage />)} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
