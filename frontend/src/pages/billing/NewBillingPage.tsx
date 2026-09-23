import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { patientApi } from '../../api/patient.api';
import { testApi } from '../../api/test.api';
import { doctorApi } from '../../api/doctor.api';
import { organizationApi } from '../../api/organization.api';
import { billingApi } from '../../api/billing.api';
import { packageApi } from '../../api/package.api';
import { MONEY_QUERY_KEYS } from '../../utils/query-options';
import {
  Patient,
  LabTest,
  Doctor,
  Organization,
  TestPackage,
  ProcessingMode,
} from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { asList } from '../../utils/api-list';
import { catalogueQuery } from '../../utils/query-options';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Trash2,
  CheckCircle2,
  UserPlus,
  History,
  Package,
  Stethoscope,
  Truck,
  Split,
} from 'lucide-react';
import { ageLabel } from '../../utils/age';
import { COLLECTION_METHODS } from '../../config/payment-methods';
import { PaymentGatewayModal } from '../../components/billing/PaymentGatewayModal';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect';
import {
  SplitPaymentEditor,
  splitSeed,
  tenderPayload,
  tenderTotal,
  type Tender,
} from '../../components/billing/SplitPaymentEditor';

/**
 * Methods that settle through a machine. An advance taken by one of these is
 * not written onto the invoice at creation time - the bill is raised unpaid
 * and the gateway books the money once it confirms capture, so a declined
 * card never leaves a paid invoice behind it.
 */
const GATEWAY_METHODS = ['UPI', 'Card'];

/** Picked from the method list to switch the counter into split entry. It is
    never a method in its own right, so it never reaches the server. */
const SPLIT_OPTION = '__split__';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

/**
 * One priced line on this bill. The rate starts at the catalogue price and
 * belongs to the desk from there; where the test is run and what the
 * referring doctor's own copy prints it at travel with it.
 */
interface BillLine {
  test: LabTest;
  rate: number;
  discount: number;
  processingMode: ProcessingMode;
  outsourceLab: string;
  referralRate: number;
  packageId?: string;
  packageName?: string;
}

const modeOf = (test: LabTest): ProcessingMode =>
  test?.processingMode === 'Outsource' ? 'Outsource' : 'In-house';

/**
 * The doctor's price for a test. A test saved before referral rates existed
 * falls back to its own rate, so the doctor's copy is never printed below
 * what the centre itself charges.
 */
const referralRateOf = (test: LabTest): number =>
  Number(test?.referralRate) || Number(test?.rate) || 0;

const lineOf = (test: LabTest): BillLine => ({
  test,
  rate: Number(test.rate) || 0,
  discount: 0,
  processingMode: modeOf(test),
  outsourceLab: test.outsourceLab || '',
  referralRate: referralRateOf(test),
});

export const NewBillingPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  /**
   * Set when the desk arrived here from a patient they had already pulled up -
   * their list row, profile or history. They have identified the patient once
   * already, so the bill opens on that patient instead of making them search
   * the register a second time.
   */
  const preselectedPatientId = searchParams.get('patientId');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string>('');
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [lines, setLines] = useState<BillLine[]>([]);
  const [discountType, setDiscountType] = useState<'Percentage' | 'Fixed'>('Fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');
  // Whose concession this is - asked separately from who referred the patient,
  // because the two are often different doctors.
  const [discountDoctorId, setDiscountDoctorId] = useState<string>('');
  const [discountDoctorName, setDiscountDoctorName] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<any>('Cash');
  /**
   * Whether the advance is coming in by one method or several. A patient
   * paying part in cash and the rest by UPI is two receipts against the new
   * bill, so the counter takes the legs rather than a single method.
   */
  const [splitting, setSplitting] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>(splitSeed());
  /** Set once a bill needing a machine collection has been raised. */
  const [gatewayInvoice, setGatewayInvoice] = useState<{
    id: string;
    number: string;
    patientName: string;
    amount: number;
  } | null>(null);

  // Fetched by id rather than hoped for in the search results: the register is
  // paged, so the patient the desk came in with is usually not on the first 25.
  const { data: preselectedData } = useQuery({
    queryKey: ['patient-preselected', preselectedPatientId],
    queryFn: () => patientApi.getById(preselectedPatientId!),
    enabled: !!preselectedPatientId,
  });

  // Only on arrival. Once the desk has picked someone - including picking
  // nobody to start over - the link that brought them here stops overriding it.
  useEffect(() => {
    if (preselectedData?.patient) setSelectedPatient(preselectedData.patient);
  }, [preselectedData]);

  // What this patient has been billed before, so a repeat visit is obvious at
  // the counter and an unpaid balance is not missed.
  const { data: patientHistory } = useQuery({
    queryKey: ['patient-billing-history', selectedPatient?.id],
    queryFn: () => patientApi.getById(selectedPatient!.id),
    enabled: !!selectedPatient?.id,
  });

  const pastInvoices = asList<any>(patientHistory?.invoices ?? [], 'invoices');
  const outstandingDue = pastInvoices.reduce((sum: number, inv: any) => sum + (inv.dueAmount || 0), 0);

  const { data: testsData } = useQuery({
    queryKey: ['tests-billing'],
    // The desk cannot bill a test it is not offered - 200 keeps the whole
    // catalogue on the picker as it grows past the first hundred.
    queryFn: () => testApi.getAll({ limit: 200, status: 'Active' }),
    ...catalogueQuery,
  });

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-billing'],
    queryFn: () => doctorApi.getAll({ limit: 100, status: 'Active' }),
    ...catalogueQuery,
  });

  const { data: orgsData } = useQuery({
    queryKey: ['orgs-billing'],
    queryFn: () => organizationApi.getAll({ limit: 100, status: 'Active' }),
    ...catalogueQuery,
  });

  // The panels the centre sells as one thing.
  const { data: packagesData } = useQuery({
    queryKey: ['visit-packages'],
    queryFn: () => packageApi.getAll({ limit: 100, status: 'Active' }),
    ...catalogueQuery,
  });

  const allPackages = asList<TestPackage>(packagesData, 'packages');

  const handleAddTest = (testId: string) => {
    const target = asList<LabTest>(testsData, 'tests').find((t) => t.id === testId);
    if (!target || lines.some((line) => line.test.id === target.id)) return;
    const next = [...lines, lineOf(target)];
    setLines(next);
    recalculatePaidAmount(next, discountType, discountValue);
  };

  /**
   * Puts a whole panel on the bill.
   *
   * The package is a price, not a test: every test inside goes on as an
   * ordinary line so the lab draws and reports it as usual, and the panel
   * price is spread back across those lines in proportion to what each is
   * worth - the rounding remainder settled on the last, so the lines always
   * add up to the panel price. A test already on the bill is left alone and
   * the rest go on at their own rates, because a part of a panel is not the
   * panel and does not earn the panel's price.
   */
  const handleAddPackage = (packageId: string) => {
    const pkg = allPackages.find((p) => p.id === packageId);
    if (!pkg) return;

    const onBill = new Set(lines.map((line) => line.test.id));
    const tests = (pkg.tests || []).filter((t) => t.id);
    const toAdd = tests.filter((t) => !onBill.has(t.id));

    if (!toAdd.length) {
      showToast(
        tests.length
          ? `Every test in ${pkg.packageName} is already on this bill`
          : `${pkg.packageName} has no tests in it`,
        'info'
      );
      return;
    }

    const partial = toAdd.length !== tests.length;
    const packagePrice = Math.max(0, Number(pkg.rate) || 0);
    const packageReferral = Math.max(0, Number(pkg.referralRate) || 0);

    /** Each line's share of a panel price, remainder settled on the last. */
    const spread = (total: number, weightOf: (test: LabTest) => number) => {
      const weightTotal = toAdd.reduce((sum, t) => sum + weightOf(t), 0);
      let given = 0;
      return toAdd.map((t, index) => {
        if (index === toAdd.length - 1) return Math.max(0, Math.round((total - given) * 100) / 100);
        const share =
          weightTotal > 0
            ? Math.round(((total * weightOf(t)) / weightTotal) * 100) / 100
            : Math.round((total / toAdd.length) * 100) / 100;
        given = Math.round((given + share) * 100) / 100;
        return share;
      });
    };

    const rates = partial
      ? toAdd.map((t) => Number(t.rate) || 0)
      : spread(packagePrice, (t) => Number(t.rate) || 0);
    const referrals =
      partial || packageReferral <= 0
        ? toAdd.map((t) => referralRateOf(t))
        : spread(packageReferral, (t) => referralRateOf(t));

    const next = [
      ...lines,
      ...toAdd.map((test, index) => ({
        ...lineOf(test),
        rate: rates[index],
        referralRate: referrals[index],
        packageId: pkg.id,
        packageName: pkg.packageName,
      })),
    ];

    setLines(next);
    recalculatePaidAmount(next, discountType, discountValue);
    showToast(
      partial
        ? `${pkg.packageName}: ${toAdd.length} test(s) added at list rate - the rest were already on the bill, so the panel price does not apply`
        : `${pkg.packageName} added - ${toAdd.length} tests for ${money(packagePrice)}`,
      partial ? 'info' : 'success'
    );
  };

  const handleRemoveTest = (id: string) => {
    const going = lines.find((line) => line.test.id === id);
    let next = lines.filter((line) => line.test.id !== id);

    // A panel that has lost a test is no longer that panel - the rest of its
    // lines were each carrying a share of the panel price, and charging those
    // shares for less than the whole set would hand the panel discount over
    // on part of it.
    if (going?.packageId) {
      const droppedFrom = going.packageId;
      next = next.map((line) =>
        line.packageId === droppedFrom
          ? { ...line, ...lineOf(line.test), discount: line.discount }
          : line
      );
      showToast(`${going.packageName} is no longer complete - the rest go back to list rate`, 'info');
    }

    setLines(next);
    recalculatePaidAmount(next, discountType, discountValue);
  };

  const updateLine = (id: string, patch: Partial<Omit<BillLine, 'test'>>) =>
    setLines((prev) => prev.map((line) => (line.test.id === id ? { ...line, ...patch } : line)));

  // The same order the server prices in: line rates make the subtotal, line
  // discounts come off first, and the bill-wide discount works on what is
  // left - so the screen and the printed bill agree.
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.rate) || 0), 0);
  const lineDiscountTotal = lines.reduce(
    (sum, line) => sum + Math.min(Number(line.rate) || 0, Math.max(0, Number(line.discount) || 0)),
    0
  );
  const discountBase = Math.max(0, subtotal - lineDiscountTotal);

  let calculatedDiscount = 0;
  if (discountType === 'Percentage') {
    calculatedDiscount = (discountBase * Math.min(100, Math.max(0, discountValue))) / 100;
  } else {
    calculatedDiscount = Math.min(discountBase, Math.max(0, discountValue));
  }

  const netAmount = Math.max(0, subtotal - lineDiscountTotal - calculatedDiscount);

  /**
   * The referring doctor's own bill - a separate document at a separate
   * price. The patient's discount never comes off it, because it is not the
   * same money; the gap between the two totals is the doctor's cut.
   */
  const referralTotal = lines.reduce((sum, line) => sum + (Number(line.referralRate) || 0), 0);
  const referralMargin = referralTotal - netAmount;
  const hasReferral = Boolean(selectedDoctor);

  const outsourcedLines = lines.filter((line) => line.processingMode === 'Outsource');

  const recalculatePaidAmount = (
    billLines: BillLine[],
    discType: 'Percentage' | 'Fixed',
    discVal: number
  ) => {
    const sub = billLines.reduce((sum, line) => sum + (Number(line.rate) || 0), 0);
    const lineDisc = billLines.reduce(
      (sum, line) => sum + Math.min(Number(line.rate) || 0, Math.max(0, Number(line.discount) || 0)),
      0
    );
    const base = Math.max(0, sub - lineDisc);
    const disc =
      discType === 'Percentage'
        ? (base * Math.min(100, Math.max(0, discVal))) / 100
        : Math.min(base, Math.max(0, discVal));
    setPaidAmount(Math.max(0, sub - lineDisc - disc));
  };

  const invoiceMutation = useMutation({
    mutationFn: () =>
      billingApi.createInvoice({
        patientId: selectedPatient!.id,
        doctorId: selectedDoctor || undefined,
        organizationId: selectedOrg || undefined,
        // The priced lines are what the bill is raised from; the bare ids stay
        // for anything still reading the older shape.
        items: lines.map((line) => ({
          testId: line.test.id,
          rate: Number(line.rate) || 0,
          discountAmount: Math.min(Number(line.rate) || 0, Math.max(0, Number(line.discount) || 0)),
          processingMode: line.processingMode,
          outsourceLab: line.processingMode === 'Outsource' ? line.outsourceLab.trim() : '',
          referralRate: Number(line.referralRate) || 0,
          ...(line.packageId ? { packageId: line.packageId, packageName: line.packageName } : {}),
        })),
        testIds: lines.map((line) => line.test.id),
        discountType,
        discountValue: Number(discountValue),
        discountReason,
        discountDoctorId: discountDoctorId || undefined,
        discountDoctorName: discountDoctorId ? undefined : discountDoctorName.trim() || undefined,
        // Split legs are the payment when the desk is splitting; otherwise
        // the single amount and method, exactly as before. A gateway method
        // still collects nothing up front - the machine confirms it after.
        ...(splitting
          ? { paymentSplits: tenderPayload(tenders) }
          : {
              paidAmount: GATEWAY_METHODS.includes(paymentMethod) ? 0 : Number(paidAmount),
              paymentMethod,
            }),
      }),
    onSuccess: (res) => {
      showToast(
        `Invoice ${res.invoice.invoiceNumber} created - ${res.samples?.length ?? 0} sample(s) queued for collection`,
        'success'
      );
      // Today's billing and today's takings have both just changed.
      MONEY_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));

      const advance = Number(paidAmount) || 0;
      if (!splitting && GATEWAY_METHODS.includes(paymentMethod) && advance > 0) {
        setGatewayInvoice({
          id: res.invoice._id,
          number: res.invoice.invoiceNumber,
          patientName: selectedPatient?.patientName || '',
          amount: Math.min(advance, Number(res.invoice.netAmount) || advance),
        });
        return;
      }

      navigate(`/billing/${res.invoice._id}`);
    },
    onError: (err: any) => showToast(err?.message || 'Failed to create invoice', 'error'),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Generate New Patient Invoice & Sample Barcodes</h1>
          <p className="text-xs text-muted-foreground">
            Select patient, add tests, apply discount structure & trigger phlebotomy sample queue
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">1. Select Patient & Referral Source</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="font-semibold">Select Registered Patient *</label>
                  <Link to="/patients/new" className="flex items-center gap-1 font-semibold text-blue-600 hover:underline">
                    <UserPlus className="h-3 w-3" /> Register new patient
                  </Link>
                </div>

                {/* One control, not two: the matches drop under the box they
                    were typed into, so the desk never has to go and open a
                    second list to find what it just searched for. */}
                <PatientSearchSelect
                  value={selectedPatient}
                  onChange={setSelectedPatient}
                  placeholder="Search an old patient by name, UHID or mobile"
                />

                {selectedPatient && (
                  <div className="mt-3 space-y-2 rounded-xl border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold">{selectedPatient.patientName}</p>
                        <p className="text-[12px] text-muted-foreground">
                          {ageLabel(selectedPatient)} · {selectedPatient.gender} · {selectedPatient.mobile} · UHID{' '}
                          {selectedPatient.uhid}
                        </p>
                      </div>
                      <Link
                        to={`/patients/${selectedPatient.id}`}
                        className="flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                      >
                        <History className="h-3 w-3" /> Full history
                      </Link>
                    </div>

                    {pastInvoices.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-[12px] font-semibold text-muted-foreground">
                          {pastInvoices.length} previous bill{pastInvoices.length === 1 ? '' : 's'}
                          {outstandingDue > 0 && (
                            <span className="ml-1 font-bold text-red-600">
                              · ₹{outstandingDue.toLocaleString('en-IN')} still outstanding
                            </span>
                          )}
                        </p>
                        {pastInvoices.slice(0, 3).map((inv: any) => (
                          <Link
                            key={inv._id}
                            to={`/billing/${inv._id}`}
                            className="flex items-center justify-between rounded-lg bg-background px-2 py-1 text-[12px] hover:bg-muted"
                          >
                            <span className="font-mono font-bold text-blue-600">{inv.invoiceNumber}</span>
                            <span className="text-muted-foreground">
                              {new Date(inv.createdAt).toLocaleDateString('en-IN')}
                            </span>
                            <span className="font-mono font-bold">₹{inv.netAmount}</span>
                            <span
                              className={inv.dueAmount > 0 ? 'font-semibold text-red-600' : 'text-emerald-600'}
                            >
                              {inv.dueAmount > 0 ? `₹${inv.dueAmount} due` : 'Paid'}
                            </span>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[12px] text-muted-foreground">First visit - no previous bills on record.</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Referring Doctor</label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full h-10 rounded-xl border bg-background px-3"
                  >
                    <option value="">Self Walk-in / Direct</option>
                    {asList<Doctor>(doctorsData, 'doctors').map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.doctorName} ({d.hospital || 'Doctor'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Corporate TPA / Organization</label>
                  <select
                    value={selectedOrg}
                    onChange={(e) => setSelectedOrg(e.target.value)}
                    className="w-full h-10 rounded-xl border bg-background px-3"
                  >
                    <option value="">Direct Cash / Individual</option>
                    {asList<Organization>(orgsData, 'organizations').map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.organizationName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-bold">2. Test Selection & Rate Calculation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="font-semibold block mb-1">Add Laboratory Test</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddTest(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full h-10 rounded-xl border bg-background px-3"
                  >
                    <option value="">Select Test to Add...</option>
                    {asList<LabTest>(testsData, 'tests').map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.testName} ({t.testCode}) - ₹{t.rate}
                        {t.processingMode === 'Outsource' ? ' · outsourced' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* A panel goes on in one tap and puts all its tests on the
                    bill at the panel price. */}
                <div>
                  <label className="font-semibold block mb-1">Add Test Package</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAddPackage(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full h-10 rounded-xl border bg-background px-3"
                    disabled={allPackages.length === 0}
                  >
                    <option value="">
                      {allPackages.length === 0 ? 'No packages set up yet' : 'Select Package to Add...'}
                    </option>
                    {allPackages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.packageName} ({(p.tests || []).length} tests) - ₹{p.rate}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/50 font-semibold border-b">
                    <tr>
                      <th className="p-3">#</th>
                      <th className="p-3">Test Code &amp; Name</th>
                      <th className="p-3">Container</th>
                      <th className="p-3 w-36">Processing</th>
                      <th className="p-3 w-24">Rate (₹)</th>
                      <th className="p-3 w-24">Discount (₹)</th>
                      <th className="p-3 text-right">Net</th>
                      {/* Only worth the width when someone actually referred
                          this patient - a walk-in has no doctor's copy. */}
                      {hasReferral && <th className="p-3 w-24 text-right">Dr. Rate (₹)</th>}
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={hasReferral ? 9 : 8} className="p-6 text-center text-muted-foreground">
                          No tests selected.
                        </td>
                      </tr>
                    ) : (
                      lines.map((line, idx) => {
                        const t = line.test;
                        const lineDiscount = Math.min(line.rate || 0, Math.max(0, line.discount || 0));
                        const lineNet = Math.max(0, (line.rate || 0) - lineDiscount);
                        const noDiscount = t.discountAllowed === false;

                        return (
                          <tr key={t.id}>
                            <td className="p-3 font-mono text-muted-foreground">{idx + 1}</td>
                            <td className="p-3">
                              <div className="font-bold">{t.testName}</div>
                              <div className="font-mono text-[11px] text-muted-foreground">{t.testCode}</div>
                              {line.packageName && (
                                <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-violet-700">
                                  <Package className="h-2.5 w-2.5" />
                                  {line.packageName}
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{t.sampleContainer}</td>

                            {/* Where this one is actually run. The master sets
                                it, the desk overrides it on the day. */}
                            <td className="p-3">
                              <select
                                value={line.processingMode}
                                onChange={(e) =>
                                  updateLine(t.id, {
                                    processingMode: e.target.value as ProcessingMode,
                                    outsourceLab:
                                      e.target.value === 'Outsource'
                                        ? line.outsourceLab || t.outsourceLab || ''
                                        : '',
                                  })
                                }
                                className={`h-8 w-full rounded-lg border px-2 text-[12px] font-semibold ${
                                  line.processingMode === 'Outsource'
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                }`}
                              >
                                <option value="In-house">In-house</option>
                                <option value="Outsource">Outsource</option>
                              </select>
                              {line.processingMode === 'Outsource' && (
                                <Input
                                  value={line.outsourceLab}
                                  onChange={(e) => updateLine(t.id, { outsourceLab: e.target.value })}
                                  placeholder="Sent to..."
                                  className="mt-1 h-7 text-[11px]"
                                />
                              )}
                            </td>

                            <td className="p-3">
                              <Input
                                type="number"
                                min={0}
                                value={line.rate}
                                onChange={(e) => {
                                  const rate = Math.max(0, Number(e.target.value) || 0);
                                  const next = lines.map((l) =>
                                    l.test.id === t.id ? { ...l, rate } : l
                                  );
                                  setLines(next);
                                  recalculatePaidAmount(next, discountType, discountValue);
                                }}
                                className="h-8 w-20 font-mono"
                              />
                            </td>

                            <td className="p-3">
                              <Input
                                type="number"
                                min={0}
                                max={line.rate}
                                disabled={noDiscount}
                                value={line.discount}
                                onChange={(e) => {
                                  const discount = Math.max(0, Number(e.target.value) || 0);
                                  const next = lines.map((l) =>
                                    l.test.id === t.id ? { ...l, discount } : l
                                  );
                                  setLines(next);
                                  recalculatePaidAmount(next, discountType, discountValue);
                                }}
                                className="h-8 w-20 font-mono disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              {noDiscount && (
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  No discount allowed
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-right font-mono font-bold">{money(lineNet)}</td>

                            {/* The doctor's own copy prints this figure. It is
                                not added to what the patient pays. */}
                            {hasReferral && (
                              <td className="p-3 text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  value={line.referralRate}
                                  onChange={(e) =>
                                    updateLine(t.id, {
                                      referralRate: Math.max(0, Number(e.target.value) || 0),
                                    })
                                  }
                                  className="h-8 w-20 font-mono text-violet-700"
                                />
                              </td>
                            )}

                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveTest(t.id)}
                                className="text-red-500 hover:text-red-700"
                                aria-label={`Remove ${t.testName}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {/* The column the desk was adding up by hand: what the tests
                      come to, what came off them, and what is left. */}
                  {lines.length > 0 && (
                    <tfoot className="border-t-2 bg-muted/40 font-bold">
                      <tr>
                        <td className="p-3" colSpan={4}>
                          Total &mdash; {lines.length} test{lines.length === 1 ? '' : 's'}
                        </td>
                        <td className="p-3 font-mono">{money(subtotal)}</td>
                        <td className="p-3 font-mono text-emerald-700">
                          {lineDiscountTotal > 0 ? `- ${money(lineDiscountTotal)}` : money(0)}
                        </td>
                        <td className="p-3 text-right font-mono text-sm text-blue-700">
                          {money(subtotal - lineDiscountTotal)}
                        </td>
                        {hasReferral && (
                          <td className="p-3 text-right font-mono text-violet-700">{money(referralTotal)}</td>
                        )}
                        <td className="p-3" />
                      </tr>
                      {calculatedDiscount > 0 && (
                        <tr className="text-[12px]">
                          <td className="p-3 pt-0" colSpan={6}>
                            Less bill discount
                            {discountType === 'Percentage' ? ` (${discountValue}%)` : ''}
                          </td>
                          <td className="p-3 pt-0 text-right font-mono text-emerald-700">
                            - {money(calculatedDiscount)}
                          </td>
                          {hasReferral && <td className="p-3 pt-0" />}
                          <td className="p-3 pt-0" />
                        </tr>
                      )}
                      {calculatedDiscount > 0 && (
                        <tr>
                          <td className="p-3 pt-0" colSpan={6}>
                            Net payable
                          </td>
                          <td className="p-3 pt-0 text-right font-mono text-sm text-blue-700">
                            {money(netAmount)}
                          </td>
                          {hasReferral && <td className="p-3 pt-0" />}
                          <td className="p-3 pt-0" />
                        </tr>
                      )}
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Work leaving the building - the desk says this at the counter,
                  because an outsourced test usually reports a day later. */}
              {outsourcedLines.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                  <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {outsourcedLines.length} test{outsourcedLines.length === 1 ? '' : 's'}{' '}
                    {outsourcedLines.length === 1 ? 'goes' : 'go'} out:{' '}
                    {outsourcedLines
                      .map((l) => `${l.test.testName}${l.outsourceLab ? ` → ${l.outsourceLab}` : ''}`)
                      .join(', ')}
                    . Tell the patient the report may take longer than the usual turnaround.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="bg-muted/20 border-2">
            <CardHeader>
              <CardTitle className="text-base font-bold">Billing Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="flex justify-between font-bold text-sm">
                <span>Subtotal ({lines.length} tests):</span>
                <span className="font-mono">{money(subtotal)}</span>
              </div>

              {lineDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Test-level discounts</span>
                  <span className="font-mono">- {money(lineDiscountTotal)}</span>
                </div>
              )}

              <div className="space-y-2 border-t pt-3">
                <label className="font-semibold block">Discount Type &amp; Value</label>
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e: any) => {
                      setDiscountType(e.target.value);
                      recalculatePaidAmount(lines, e.target.value, discountValue);
                    }}
                    className="h-9 rounded-lg border bg-background px-2 text-xs"
                  >
                    <option value="Fixed">Fixed (₹)</option>
                    <option value="Percentage">Percent (%)</option>
                  </select>
                  <Input
                    type="number"
                    value={discountValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setDiscountValue(val);
                      recalculatePaidAmount(lines, discountType, val);
                    }}
                    className="h-9"
                  />
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-700">
                    <span>Bill discount</span>
                    <span className="font-mono">- {money(calculatedDiscount)}</span>
                  </div>
                )}

                {/* Whose concession it is. Asked only once something has
                    actually come off the bill. */}
                {(calculatedDiscount > 0 || lineDiscountTotal > 0) && (
                  <>
                    <label className="block font-semibold">Discount given through</label>
                    <select
                      value={discountDoctorId}
                      onChange={(e) => {
                        setDiscountDoctorId(e.target.value);
                        if (e.target.value) setDiscountDoctorName('');
                      }}
                      className="h-9 w-full rounded-lg border bg-background px-2 text-xs"
                    >
                      <option value="">Centre&rsquo;s own concession / not through a doctor</option>
                      {asList<Doctor>(doctorsData, 'doctors').map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.doctorName}
                          {doctor.specialty ? ` · ${doctor.specialty}` : ''}
                        </option>
                      ))}
                    </select>
                    {!discountDoctorId && (
                      <Input
                        value={discountDoctorName}
                        onChange={(e) => setDiscountDoctorName(e.target.value)}
                        placeholder="Or type a doctor who is not on the panel"
                        className="h-9"
                      />
                    )}
                    <Input
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      placeholder="Reason for discount"
                      className="h-9"
                    />
                  </>
                )}
              </div>

              <div className="flex justify-between font-bold text-base border-t pt-3 text-blue-600">
                <span>Net Total:</span>
                <span className="font-mono">{money(netAmount)}</span>
              </div>

              {/* How the patient is settling. "Split across methods" sits in
                  this list rather than off to one side, because the method
                  dropdown is where the desk looks to answer that question -
                  a patient paying part in cash and the rest on UPI is just
                  another answer to it. */}
              <div className="border-t pt-3">
                <label className="font-semibold block mb-1">Payment Method</label>
                <select
                  value={splitting ? SPLIT_OPTION : paymentMethod}
                  onChange={(e) => {
                    // Whatever was already typed carries across in both
                    // directions, so changing the method never silently
                    // drops an amount the receptionist entered.
                    if (e.target.value === SPLIT_OPTION) {
                      setTenders(splitSeed(paymentMethod, Number(paidAmount) || ''));
                      setSplitting(true);
                      return;
                    }
                    if (splitting) {
                      setPaidAmount(tenderTotal(tenders));
                      setSplitting(false);
                    }
                    setPaymentMethod(e.target.value);
                  }}
                  className="w-full h-9 rounded-lg border bg-background px-2 text-xs"
                >
                  {COLLECTION_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                  <option value={SPLIT_OPTION}>Split payment (Cash + UPI)</option>
                </select>
                {!splitting && GATEWAY_METHODS.includes(paymentMethod) && Number(paidAmount) > 0 && (
                  <p className="mt-1 text-[11px] text-blue-700">
                    The bill is raised first, then {paymentMethod} is collected on the machine.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="font-semibold flex items-center gap-1.5">
                  {splitting && <Split className="h-3.5 w-3.5 text-blue-600" />}
                  Payment Received {splitting ? '(by method)' : '(₹)'}
                </label>

                {splitting ? (
                  <SplitPaymentEditor tenders={tenders} onChange={setTenders} target={netAmount} />
                ) : (
                  <Input
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                    className="h-9 font-bold text-emerald-600"
                  />
                )}
              </div>

              <Button
                disabled={!selectedPatient || lines.length === 0 || invoiceMutation.isPending}
                onClick={() => invoiceMutation.mutate()}
                className="w-full h-11 bg-blue-600 hover:bg-blue-700 font-bold"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {!splitting && GATEWAY_METHODS.includes(paymentMethod) && Number(paidAmount) > 0
                  ? `Generate Invoice & Collect by ${paymentMethod}`
                  : 'Generate Invoice & Barcodes'}
              </Button>
            </CardContent>
          </Card>

          {/* The referring doctor's own bill.
              A separate document at a separate price: the patient's discount
              never comes off it, because it is not the same money. The
              printed copy comes off the saved invoice. */}
          {hasReferral && lines.length > 0 && (
            <Card className="border-violet-200 bg-violet-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-violet-900">
                  <Stethoscope className="h-4 w-4 text-violet-600" />
                  Referring Doctor&rsquo;s Bill
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-xs">
                <p className="font-bold text-violet-900">
                  {asList<Doctor>(doctorsData, 'doctors').find((d) => d.id === selectedDoctor)
                    ?.doctorName || 'Referring doctor'}
                </p>

                <div className="space-y-1 border-y border-violet-200 py-2">
                  {lines.map((line) => (
                    <div key={line.test.id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate text-violet-800">{line.test.testName}</span>
                      <span className="shrink-0 font-mono font-semibold text-violet-900">
                        {money(line.referralRate)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between text-sm font-bold text-violet-900">
                  <span>Doctor&rsquo;s total</span>
                  <span className="font-mono">{money(referralTotal)}</span>
                </div>

                <div className="flex justify-between text-[12px] text-muted-foreground">
                  <span>Patient pays the centre</span>
                  <span className="font-mono">{money(netAmount)}</span>
                </div>

                <div
                  className={`flex justify-between rounded-lg px-2 py-1.5 font-bold ${
                    referralMargin >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                  }`}
                >
                  <span>{referralMargin >= 0 ? "Doctor's margin" : 'Short of the centre'}</span>
                  <span className="font-mono">{money(Math.abs(referralMargin))}</span>
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Prints as its own sheet from the bill once this invoice is saved.
                </p>
              </CardContent>
            </Card>
          )}

          {outsourcedLines.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-amber-900">
                  <Truck className="h-4 w-4 text-amber-600" />
                  Sent Out ({outsourcedLines.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                {outsourcedLines.map((line) => (
                  <div key={line.test.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-amber-900">{line.test.testName}</span>
                    <Badge variant="amber" className="shrink-0">
                      {line.outsourceLab || 'lab not named'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {gatewayInvoice && (
        <PaymentGatewayModal
          invoiceId={gatewayInvoice.id}
          invoiceNumber={gatewayInvoice.number}
          patientName={gatewayInvoice.patientName}
          dueAmount={gatewayInvoice.amount}
          onClose={() => {
            // The bill exists either way. If the patient did not pay, it is
            // simply an unpaid invoice the desk can collect against later.
            const id = gatewayInvoice.id;
            setGatewayInvoice(null);
            navigate(`/billing/${id}`);
          }}
          onCaptured={() => {
            MONEY_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
          }}
        />
      )}
    </div>
  );
};

