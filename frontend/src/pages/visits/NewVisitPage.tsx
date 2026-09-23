import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patientApi } from '../../api/patient.api';
import { testApi } from '../../api/test.api';
import { doctorApi } from '../../api/doctor.api';
import { organizationApi } from '../../api/organization.api';
import { billingApi } from '../../api/billing.api';
import { packageApi } from '../../api/package.api';
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
import { DateInput } from '../../components/ui/date-input';
import { Badge } from '../../components/ui/badge';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { catalogueQuery, MONEY_QUERY_KEYS } from '../../utils/query-options';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PatientSearchSelect } from '../../components/patients/PatientSearchSelect';
import { yearsSince, ageLabel, ageYmdLabel, ageDaysLabel } from '../../utils/age';
import { matchesTestQuery } from '../../utils/test-search';
import {
  Search,
  UserPlus,
  Stethoscope,
  FlaskConical,
  Receipt,
  Trash2,
  CheckCircle2,
  History,
  AlertTriangle,
  ClipboardList,
  Package,
  Truck,
  Building2,
  Split,
} from 'lucide-react';
import { COLLECTION_METHODS } from '../../config/payment-methods';
import {
  SplitPaymentEditor,
  splitSeed,
  tenderPayload,
  tenderTotal,
  type Tender,
} from '../../components/billing/SplitPaymentEditor';
import { PaymentGatewayModal } from '../../components/billing/PaymentGatewayModal';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, PERMISSIONS } from '../../config/roles';

/**
 * Methods that settle through a machine. The visit is registered and the bill
 * raised first; the money is only written onto it once the gateway confirms
 * capture, so a declined card cannot leave a paid invoice behind it.
 */
const GATEWAY_METHODS = ['UPI', 'Card'];

/** Picked from the method list to switch the counter into split entry. It is
    never a method in its own right, so it never reaches the server. */
const SPLIT_OPTION = '__split__';

const selectClass =
  'flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const Field: React.FC<{
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, error, hint, children }) => (
  <div>
    <label className="mb-1 block text-xs font-semibold">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && !error && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    {error && <span className="mt-1 block text-[11px] font-medium text-red-500">{error}</span>}
  </div>
);

/**
 * One line on the bill being built. The rate starts at the catalogue price but
 * belongs to the desk from that moment - a camp rate, a staff concession, a
 * repeat patient's ₹100 off - and the discount sits on the line it was given
 * on rather than being swept into a single figure at the bottom of the bill.
 */
interface BillLine {
  test: LabTest;
  rate: number;
  discount: number;
  /** Typed over by the desk, so a change of rate card must not overwrite it. */
  rateEdited?: boolean;
  /**
   * Run at the bench or sent out. Starts at whatever the test master says and
   * belongs to the desk from there - an analyser down for service sends the
   * day's work out, and the bill is where that gets recorded.
   */
  processingMode: ProcessingMode;
  outsourceLab: string;
  /**
   * What the referring doctor's own copy prints this line at. It is a
   * separate bill at a separate price and never touches what the patient
   * pays; the gap between the two is the doctor's cut.
   */
  referralRate: number;
  referralEdited?: boolean;
  /** Set when the line came onto the bill inside a package. */
  packageId?: string;
  packageName?: string;
}

/** Where a test is run, and where it goes when that is not here. */
const modeOf = (test: LabTest): ProcessingMode =>
  test?.processingMode === 'Outsource' ? 'Outsource' : 'In-house';

/**
 * The doctor's price for a test. A test saved before referral rates existed
 * falls back to its own rate, so the doctor's copy is never printed below
 * what the centre itself charges.
 */
const referralRateOf = (test: LabTest): number =>
  Number(test?.referralRate) || Number(test?.rate) || 0;

/**
 * A test's identity, whichever shape it arrives in. The API sends `_id` and
 * the client mirrors it onto `id`; falling through to the test code means a
 * row can never collapse onto `undefined === undefined` and take every other
 * test on the bill with it.
 */
const testKey = (test: LabTest | undefined | null): string =>
  String(test?.id ?? (test as any)?._id ?? test?.testCode ?? '');

const emptyPatient = {
  patientName: '',
  gender: '',
  age: '',
  mobile: '',
  dateOfBirth: '',
  address: '',
  state: '',
  pinCode: '',
};

/**
 * The front desk's landing screen. One page takes the whole visit - who the
 * patient is, which doctor sent them, what is being run and what they paid -
 * and turns it into a registered patient, a bill and a queued sample in a
 * single submit.
 */
export const NewVisitPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'existing' | 'new'>('new');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const { user } = useAuth();
  const canSeeHistory = hasPermission(user, PERMISSIONS.PATIENT_HISTORY);
  const [newPatient, setNewPatient] = useState({ ...emptyPatient });

  const [clinicalNotes, setClinicalNotes] = useState('');
  const [priority, setPriority] = useState<'Routine' | 'Urgent'>('Routine');
  const [doctorId, setDoctorId] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [organizationId, setOrganizationId] = useState('');

  const [testSearch, setTestSearch] = useState('');
  // The search result list is a keyboard-first dropdown: it opens while the
  // desk is typing, and the highlighted row is what Enter adds.
  const [testResultsOpen, setTestResultsOpen] = useState(false);
  const [highlightedTest, setHighlightedTest] = useState(0);
  const [lines, setLines] = useState<BillLine[]>([]);

  const [discountType, setDiscountType] = useState<'Percentage' | 'Fixed'>('Fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  /**
   * Whether the intake is taking one method or several. A patient settling
   * part in cash and the rest by UPI is two receipts against the new bill,
   * so the counter takes the legs rather than a single method.
   */
  const [splitting, setSplitting] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>(splitSeed());
  /** Set once a visit needing a machine collection has been registered. */
  const [gatewayInvoice, setGatewayInvoice] = useState<{
    id: string;
    number: string;
    patientName: string;
    amount: number;
  } | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // A returning patient's past bills and unpaid balance, so the desk sees the
  // history before taking money rather than after.
  const { data: patientHistory } = useQuery({
    queryKey: ['visit-patient-history', selectedPatient?.id],
    queryFn: () => patientApi.getById(selectedPatient!.id),
    enabled: !!selectedPatient?.id,
  });

  // The first page of the menu, used for the quick-pick chips and for
  // re-pricing lines when the rate card changes.
  const { data: testsData } = useQuery({
    queryKey: ['visit-tests'],
    queryFn: () => testApi.getAll({ limit: 200, status: 'Active' }),
    ...catalogueQuery,
  });

  /**
   * Searching goes to the server, not to the page.
   *
   * The desk only ever holds the first couple of hundred tests in memory; a
   * lab with a few thousand on its menu would have had the rest be
   * unsearchable - typing a test that exists returned "no test matches". The
   * server searches the whole master by name and code, so anything on the menu
   * can be found and billed no matter how long the menu gets.
   */
  const debouncedTestSearch = useDebouncedValue(testSearch.trim(), 250);

  const { data: testSearchData, isFetching: testSearchLoading } = useQuery({
    queryKey: ['visit-test-search', debouncedTestSearch],
    queryFn: () => testApi.getAll({ search: debouncedTestSearch, status: 'Active', limit: 25 }),
    enabled: debouncedTestSearch.length >= 2,
    // Keep the previous matches on screen while the next ones load, so the
    // list narrows as the desk types instead of blinking empty between keys.
    placeholderData: (prev: any) => prev,
    staleTime: 30_000,
  });

  // The panels the centre sells as one thing. Short enough a list that the
  // whole of it is held here and searched on the page - a centre has a dozen
  // packages, not the thousands of tests that forced test search to the
  // server.
  const { data: packagesData } = useQuery({
    queryKey: ['visit-packages'],
    queryFn: () => packageApi.getAll({ limit: 100, status: 'Active' }),
    ...catalogueQuery,
  });

  const { data: doctorsData } = useQuery({
    queryKey: ['visit-doctors'],
    queryFn: () => doctorApi.getAll({ limit: 200, status: 'Active' }),
    ...catalogueQuery,
  });

  const { data: orgsData } = useQuery({
    queryKey: ['visit-orgs'],
    queryFn: () => organizationApi.getAll({ limit: 100, status: 'Active' }),
    ...catalogueQuery,
  });

  const allTests = asList<LabTest>(testsData, 'tests');
  const allPackages = asList<TestPackage>(packagesData, 'packages');
  const pastInvoices = asList<any>(patientHistory?.invoices ?? [], 'invoices');
  const outstandingDue = pastInvoices.reduce((sum: number, inv: any) => sum + (inv.dueAmount || 0), 0);

  const selectedTests = useMemo(() => lines.map((line) => line.test), [lines]);

  /**
   * The rate card this patient is on. A corporate or TPA patient is billed at
   * the contract rate and a panel doctor's patient at the doctor rate - the
   * server has always priced it this way, so the desk has to see the same
   * figure before it takes the money.
   */
  const tierRate = (test: LabTest): number => {
    if (organizationId) {
      const org = asList<Organization>(orgsData, 'organizations').find((o) => o.id === organizationId);
      if (org?.contractRate === 'Corporate') return Number(test.corporateRate) || Number(test.rate) || 0;
      if (org?.contractRate === 'Discounted') return Number(test.doctorRate) || Number(test.rate) || 0;
      return Number(test.rate) || 0;
    }
    if (doctorId) return Number(test.doctorRate) || Number(test.rate) || 0;
    return Number(test.rate) || 0;
  };

  /**
   * Puts a test on the bill at this patient's rate. The desk gets a word back
   * either way - a tap that quietly does nothing reads as a broken screen.
   */
  const addTest = (test: LabTest) => {
    const key = testKey(test);
    if (!key) {
      showToast(`${test?.testName || 'That test'} has no id on it - reload the test master and try again`, 'error');
      return;
    }

    setTestSearch('');
    setTestResultsOpen(false);
    setHighlightedTest(0);

    if (lines.some((line) => testKey(line.test) === key)) {
      showToast(`${test.testName} is already on this bill`, 'info');
      return;
    }

    setLines((prev) => [
      ...prev,
      {
        test,
        rate: tierRate(test),
        discount: 0,
        processingMode: modeOf(test),
        outsourceLab: test.outsourceLab || '',
        referralRate: referralRateOf(test),
      },
    ]);
    setErrors((prev) => ({ ...prev, tests: '' }));
    showToast(`${test.testName} added`, 'success');
  };

  /**
   * Puts a whole panel on the bill.
   *
   * The package is a price, not a test: every test inside it goes on as an
   * ordinary line so the lab draws, runs and reports it exactly as usual, and
   * the package price is spread back across those lines in proportion to what
   * each is worth. The rounding remainder is settled on the last line, so the
   * lines always add up to the package price rather than to a rupee either
   * side of it.
   *
   * A test already on the bill is left where it is and its share is not
   * charged twice - the desk is told which ones were skipped.
   */
  const addPackage = (pkg: TestPackage) => {
    const onBill = new Set(lines.map((line) => testKey(line.test)));
    const tests = (pkg.tests || []).filter((t) => testKey(t));

    if (!tests.length) {
      showToast(`${pkg.packageName} has no tests in it - add them under Masters > Packages`, 'error');
      return;
    }

    const alreadyOn = tests.filter((t) => onBill.has(testKey(t)));
    const toAdd = tests.filter((t) => !onBill.has(testKey(t)));

    setTestSearch('');
    setTestResultsOpen(false);
    setHighlightedTest(0);

    if (!toAdd.length) {
      showToast(`Every test in ${pkg.packageName} is already on this bill`, 'info');
      return;
    }

    const packagePrice = Math.max(0, Number(pkg.rate) || 0);
    const listTotal = toAdd.reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
    // A doctor's copy prints the panel at its own price when one is set, and
    // otherwise at the sum of the tests' own referral rates.
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

    // When only part of the panel is being added, the package price is not
    // the price of what is left - the tests that are already on the bill are
    // charged at their own rates. Falling back to the list rate keeps the
    // arithmetic honest rather than quietly handing over a whole panel's
    // discount on half of it.
    const partial = alreadyOn.length > 0;
    const rates = partial
      ? toAdd.map((t) => Number(t.rate) || 0)
      : spread(packagePrice, (t) => Number(t.rate) || 0);
    const referrals =
      partial || packageReferral <= 0
        ? toAdd.map((t) => referralRateOf(t))
        : spread(packageReferral, (t) => referralRateOf(t));

    setLines((prev) => [
      ...prev,
      ...toAdd.map((test, index) => ({
        test,
        rate: rates[index],
        discount: 0,
        processingMode: modeOf(test),
        outsourceLab: test.outsourceLab || '',
        referralRate: referrals[index],
        // Both the rate and the doctor's rate came from the panel, not from
        // the rate card, so a later change of rate card must not wipe them.
        rateEdited: !partial,
        referralEdited: !partial && packageReferral > 0,
        packageId: pkg.id,
        packageName: pkg.packageName,
      })),
    ]);

    setErrors((prev) => ({ ...prev, tests: '' }));
    showToast(
      alreadyOn.length
        ? `${pkg.packageName}: ${toAdd.length} test(s) added at list rate - ${alreadyOn.length} already on the bill, so the panel price does not apply`
        : `${pkg.packageName} added - ${toAdd.length} tests for ${money(packagePrice)}` +
            (listTotal > packagePrice ? ` (saves ${money(listTotal - packagePrice)})` : ''),
      alreadyOn.length ? 'info' : 'success'
    );
  };

  /**
   * Picking a panel doctor or a corporate account changes the rate card. Lines
   * the desk has not typed over are re-priced onto it; a rate typed by hand is
   * a decision and stays where it was put.
   */
  useEffect(() => {
    setLines((prev) => prev.map((line) => (line.rateEdited ? line : { ...line, rate: tierRate(line.test) })));
    // tierRate reads the two ids and the org list, which are the deps below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, doctorId, orgsData]);

  /**
   * Taking a test off a panel breaks the panel price - the rest of the tests
   * were each carrying a share of it, and charging those shares for less than
   * the whole package would hand over the panel discount on part of it. The
   * remaining lines go back to their own rates and the desk is told why.
   */
  const dropPackagePricing = (prev: BillLine[], packageId: string) =>
    prev.map((line) =>
      line.packageId === packageId
        ? {
            ...line,
            rate: tierRate(line.test),
            referralRate: referralRateOf(line.test),
            rateEdited: false,
            referralEdited: false,
            packageId: undefined,
            packageName: undefined,
          }
        : line
    );

  const updateLine = (key: string, patch: Partial<Omit<BillLine, 'test'>>) =>
    setLines((prev) => prev.map((line) => (testKey(line.test) === key ? { ...line, ...patch } : line)));

  const removeLine = (key: string) => {
    setLines((prev) => {
      const going = prev.find((line) => testKey(line.test) === key);
      const left = prev.filter((line) => testKey(line.test) !== key);
      // A panel that has lost a test is no longer that panel.
      return going?.packageId ? dropPackagePricing(left, going.packageId) : left;
    });
  };

  /** Takes a whole panel back off the bill in one go. */
  const removePackage = (packageId: string) => {
    setLines((prev) => prev.filter((line) => line.packageId !== packageId));
  };

  /**
   * The panels on the bill, in the order they were added. Shown as a group so
   * the desk reads "Full Body Checkup ₹1,999" rather than a dozen loose lines
   * it has to add up itself.
   */
  const billPackages = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; lines: BillLine[] }>();
    lines.forEach((line) => {
      if (!line.packageId) return;
      const group = groups.get(line.packageId) ?? {
        id: line.packageId,
        name: line.packageName || 'Package',
        lines: [],
      };
      group.lines.push(line);
      groups.set(line.packageId, group);
    });
    return [...groups.values()];
  }, [lines]);

  /**
   * What the search offers: the tests the server found, plus anything already
   * in memory that matches. The local pass is what makes a single typed letter
   * useful - the server is only asked from two characters on - and it also
   * covers the gap while a longer query is still in flight.
   */
  const searchedTests = useMemo(() => {
    const q = testSearch.trim();
    if (!q) return null;

    const onBill = new Set(lines.map((line) => testKey(line.test)));
    const matches: LabTest[] = [];
    const seen = new Set<string>();

    const offer = (test: LabTest) => {
      const key = testKey(test);
      if (!key || seen.has(key) || onBill.has(key)) return;
      seen.add(key);
      matches.push(test);
    };

    allTests.filter((t) => matchesTestQuery(t, q)).forEach(offer);
    asList<LabTest>(testSearchData, 'tests').forEach(offer);

    return matches;
  }, [testSearch, allTests, testSearchData, lines]);

  /**
   * The panels matching what the desk is typing. Packages sit above the tests
   * in the result list, because a receptionist typing "full body" is asking
   * for the panel, not for whichever test happens to have those words in it.
   */
  const searchedPackages = useMemo(() => {
    const q = testSearch.trim().toLowerCase();
    if (!q) return null;

    const onBill = new Set(lines.map((line) => testKey(line.test)));
    return allPackages.filter((pkg) => {
      const matches =
        pkg.packageName.toLowerCase().includes(q) ||
        String(pkg.packageCode || '').toLowerCase().includes(q) ||
        (pkg.tests || []).some((t) => matchesTestQuery(t, q));
      if (!matches) return false;
      // A panel whose every test is already billed is not worth offering.
      return (pkg.tests || []).some((t) => !onBill.has(testKey(t)));
    });
  }, [testSearch, allPackages, lines]);

  /**
   * One list for the keyboard to walk. Arrow keys and Enter work the same
   * whether the highlighted row is a panel or a single test, so the desk
   * never has to think about which half of the dropdown it is in.
   */
  type SearchRow =
    | { kind: 'package'; pkg: TestPackage }
    | { kind: 'test'; test: LabTest };

  const searchRows = useMemo<SearchRow[] | null>(() => {
    if (!searchedTests && !searchedPackages) return null;
    return [
      ...(searchedPackages ?? []).map((pkg) => ({ kind: 'package' as const, pkg })),
      ...(searchedTests ?? []).map((test) => ({ kind: 'test' as const, test })),
    ];
  }, [searchedPackages, searchedTests]);

  /** Adds whichever row the desk landed on. */
  const addRow = (row: SearchRow) =>
    row.kind === 'package' ? addPackage(row.pkg) : addTest(row.test);

  // Waiting only counts when there is nothing to show yet - a list that is
  // narrowing under the cursor should not be replaced by a spinner.
  const testSearchPending =
    !!searchRows &&
    (testSearchLoading || debouncedTestSearch !== testSearch.trim()) &&
    searchRows.length === 0;

  const totalTests = Number((testsData as any)?.meta?.total ?? allTests.length) || allTests.length;

  // A fresh query starts at the top of its own list.
  useEffect(() => {
    setHighlightedTest(0);
  }, [testSearch]);

  // Clicking anywhere else puts the result list away.
  const testSearchRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!testResultsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!testSearchRef.current?.contains(event.target as Node)) setTestResultsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [testResultsOpen]);

  // The same arithmetic the server runs, in the same order: line rates make
  // the subtotal, line discounts come off first, and the bill-wide discount
  // works on what is left - so the screen and the printed bill agree.
  const subtotal = lines.reduce((sum, line) => sum + (Number(line.rate) || 0), 0);
  const lineDiscountTotal = lines.reduce(
    (sum, line) => sum + Math.min(Number(line.rate) || 0, Math.max(0, Number(line.discount) || 0)),
    0
  );
  const discountBase = Math.max(0, subtotal - lineDiscountTotal);
  const billDiscount =
    discountType === 'Percentage'
      ? (discountBase * Math.min(100, Math.max(0, discountValue))) / 100
      : Math.min(discountBase, Math.max(0, discountValue));
  const discount = lineDiscountTotal + billDiscount;
  const netAmount = Math.max(0, subtotal - discount);

  const outsourcedLines = lines.filter((line) => line.processingMode === 'Outsource');

  // Test, sample, processing, rate, discount, net, remove.
  const columnCount = 7;
  /**
   * Measured against the rate card, which is what the Admin limit is about -
   * except for a panel the bill carries in full. A package price is a
   * discount an Admin already approved when the panel was set up, usually far
   * past the staff limit because that is the point of selling one, so the
   * panel is worth the panel's price and not the sum of its tests. The server
   * measures the cap the same way; warning here on a rule it does not enforce
   * would have the desk chasing an Admin for every package bill.
   */
  const completePackagePrices = useMemo(() => {
    const prices = new Map<string, number>();
    billPackages.forEach((group) => {
      const pkg = allPackages.find((p) => p.id === group.id);
      if (!pkg) return;
      const onBill = new Set(group.lines.map((line) => testKey(line.test)));
      const complete =
        (pkg.tests || []).length > 0 && (pkg.tests || []).every((t) => onBill.has(testKey(t)));
      if (complete) prices.set(group.id, Number(pkg.rate) || 0);
    });
    return prices;
  }, [billPackages, allPackages]);

  const catalogueTotal =
    lines.reduce(
      (sum, line) =>
        sum + (line.packageId && completePackagePrices.has(line.packageId) ? 0 : tierRate(line.test)),
      0
    ) + [...completePackagePrices.values()].reduce((sum, price) => sum + price, 0);

  const concessionPercent =
    catalogueTotal > 0 ? ((catalogueTotal - netAmount) / catalogueTotal) * 100 : 0;
  const paid = splitting
    ? tenderTotal(tenders)
    : paidAmount === '' ? netAmount : Number(paidAmount);
  const balance = Math.max(0, netAmount - paid);

  const fastingTests = selectedTests.filter((t) => t.fastingRequired);

  const panelDoctors = asList<Doctor>(doctorsData, 'doctors');


  const setField = (key: string, value: string) => {
    setNewPatient((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  /**
   * A date of birth is the exact answer, so it fills the age in and keeps it
   * filled. The desk still types a bare age for the patients who only know
   * roughly how old they are - that path is untouched.
   */
  const setDateOfBirth = (value: string) => {
    const years = yearsSince(value);
    setNewPatient((prev) => ({
      ...prev,
      dateOfBirth: value,
      age: years === null ? prev.age : String(years),
    }));
    setErrors((prev) => ({ ...prev, dateOfBirth: '', ...(yearsSince(value) === null ? {} : { age: '' }) }));
  };

  const validate = () => {
    const next: Record<string, string> = {};

    if (mode === 'existing') {
      if (!selectedPatient) next.patient = 'Pick the patient from the list';
    } else {
      if (newPatient.patientName.trim().length < 2) next.patientName = 'Patient name is required';
      if (!newPatient.gender) next.gender = 'Gender is required';
      if (newPatient.age === '' || Number(newPatient.age) < 0 || Number.isNaN(Number(newPatient.age))) {
        next.age = 'Enter a valid age';
      }
      if (newPatient.mobile.trim().length < 10) next.mobile = 'Valid 10-digit mobile is required';
    }

    if (selectedTests.length === 0) next.tests = 'Add at least one test';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const visitMutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        clinicalNotes: clinicalNotes.trim() || undefined,
        priority,
        doctorId: doctorId || undefined,
        doctorName: doctorName.trim() || undefined,
        organizationId: organizationId || undefined,
        // The priced lines are what the bill is raised from; the bare ids stay
        // for anything still reading the older shape.
        items: lines.map((line) => ({
          testId: testKey(line.test),
          rate: Number(line.rate) || 0,
          discountAmount: Math.min(Number(line.rate) || 0, Math.max(0, Number(line.discount) || 0)),
          processingMode: line.processingMode,
          outsourceLab: line.processingMode === 'Outsource' ? line.outsourceLab.trim() : '',
          // The doctor's own price. The desk never sees it any more, but it
          // still rides on every line, so the doctor's copy and the referral
          // commission come off exactly the figures they always did.
          referralRate: Number(line.referralRate) || 0,
          ...(line.packageId ? { packageId: line.packageId, packageName: line.packageName } : {}),
        })),
        testIds: lines.map((line) => testKey(line.test)),
        discountType,
        discountValue: Number(discountValue) || 0,
        discountReason: discountReason.trim() || undefined,
        // Split legs are the payment when the desk is splitting; otherwise
        // the single amount and method, exactly as before. A gateway method
        // still collects nothing up front - the machine confirms it after.
        ...(splitting
          ? { paymentSplits: tenderPayload(tenders) }
          : {
              paidAmount: GATEWAY_METHODS.includes(paymentMethod) ? 0 : paid,
              paymentMethod,
            }),
      };

      if (mode === 'existing') {
        payload.patientId = selectedPatient!.id;
      } else {
        payload.patient = {
          patientName: newPatient.patientName.trim(),
          gender: newPatient.gender,
          age: Number(newPatient.age),
          mobile: newPatient.mobile.trim(),
          ...(newPatient.dateOfBirth ? { dateOfBirth: newPatient.dateOfBirth } : {}),
          ...(newPatient.address ? { address: newPatient.address.trim() } : {}),
          ...(newPatient.state ? { state: newPatient.state.trim() } : {}),
          ...(newPatient.pinCode ? { pinCode: newPatient.pinCode.trim() } : {}),
        };
      }

      return billingApi.createVisit(payload);
    },
    onSuccess: (res: any) => {
      showToast(
        `${res.patient?.patientName} · ${res.invoice.invoiceNumber} · ${res.samples.length} sample(s) queued`,
        'success'
      );
      // The bill just raised is part of today's billing and today's takings -
      // the directory and the dashboard have to say so straight away rather
      // than after the five-minute cache expires.
      MONEY_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      // A patient registered by this intake has to be findable by the next
      // one, so the picker's cached matches are dropped.
      queryClient.invalidateQueries({ queryKey: ['patient-search'] });

      if (!splitting && GATEWAY_METHODS.includes(paymentMethod) && paid > 0) {
        setGatewayInvoice({
          id: res.invoice._id,
          number: res.invoice.invoiceNumber,
          patientName: res.patient?.patientName || '',
          amount: Math.min(paid, Number(res.invoice.netAmount) || paid),
        });
        return;
      }

      navigate(`/billing/${res.invoice._id}`);
    },
    onError: (err: any) => showToast(err?.message || 'Could not register this visit', 'error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      showToast('Please fill in the highlighted fields', 'error');
      return;
    }
    visitMutation.mutate();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            <span>New Patient Visit</span>
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Take the patient's details, the referring doctor and the tests. The bill and the sample queue
            are created together.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground">Priority</span>
          <div className="flex overflow-hidden rounded-xl border">
            {(['Routine', 'Urgent'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-2 font-semibold transition ${
                  priority === p
                    ? p === 'Urgent'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-900 text-white'
                    : 'bg-background text-muted-foreground hover:bg-muted'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* 1. Who is the patient */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <UserPlus className="h-4 w-4 text-blue-600" />
                1. Patient Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="flex overflow-hidden rounded-xl border text-xs">
                <button
                  type="button"
                  onClick={() => setMode('new')}
                  className={`flex-1 px-3 py-2 font-semibold transition ${
                    mode === 'new' ? 'bg-blue-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  New patient
                </button>
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`flex-1 px-3 py-2 font-semibold transition ${
                    mode === 'existing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Returning patient
                </button>
              </div>

              {mode === 'existing' ? (
                <div className="space-y-3">
                  {/* One control, not two: the matches drop under the box
                      they were typed into, so the desk never has to go and
                      open a second list to find what it just searched for. */}
                  <Field label="Patient" required error={errors.patient}>
                    <PatientSearchSelect
                      value={selectedPatient}
                      invalid={Boolean(errors.patient)}
                      onChange={(p) => {
                        setSelectedPatient(p);
                        setErrors((prev) => ({ ...prev, patient: '' }));
                      }}
                    />
                  </Field>

                  {selectedPatient && (
                    <div className="space-y-2 rounded-xl border bg-muted/20 p-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold">{selectedPatient.patientName}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {ageLabel(selectedPatient)} · {selectedPatient.gender} · {selectedPatient.mobile} ·{' '}
                            {selectedPatient.uhid}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              canSeeHistory
                                ? `/patients/${selectedPatient.id}/history`
                                : `/patients/${selectedPatient.id}`
                            )
                          }
                          className="flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                        >
                          <History className="h-3 w-3" /> {canSeeHistory ? 'Full history' : 'Profile'}
                        </button>
                      </div>

                      {pastInvoices.length > 0 ? (
                        <p className="text-[12px] text-muted-foreground">
                          {pastInvoices.length} previous visit{pastInvoices.length === 1 ? '' : 's'}
                          {outstandingDue > 0 && (
                            <span className="ml-1 font-bold text-red-600">
                              · {money(outstandingDue)} still outstanding
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-[12px] text-muted-foreground">No previous bills on record.</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Field label="Patient Name" required>
                      <Input
                        value={newPatient.patientName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField('patientName', e.target.value)}
                        placeholder="Full name"
                        error={errors.patientName}
                      />
                    </Field>
                  </div>

                  <Field label="Mobile" required>
                    <Input
                      value={newPatient.mobile}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField('mobile', e.target.value)}
                      placeholder="10-digit mobile"
                      error={errors.mobile}
                    />
                  </Field>

                  <Field
                    label="Date of Birth"
                    hint="Fills the age in by itself, counted in days. Leave blank if the patient only knows their age."
                  >
                    <DateInput
                      max={new Date().toISOString().slice(0, 10)}
                      value={newPatient.dateOfBirth}
                      onChange={setDateOfBirth}
                    />
                  </Field>

                  <Field
                    label="Age"
                    required
                    error={errors.age}
                    hint={
                      newPatient.dateOfBirth
                        ? 'From the date of birth. Clear the date to type an age.'
                        : undefined
                    }
                  >
                    {/* With a date of birth on the form the age is a fact, not a
                        guess, so it is read out both ways: years, months and days
                        first, and the running day count beside it - the unit that
                        separates two children born months apart, and those are the
                        patients whose reference ranges differ. The whole years
                        still go to the server. */}
                    {newPatient.dateOfBirth ? (
                      <div className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-muted/40 px-3">
                        <span className="text-xs font-semibold">{ageYmdLabel(newPatient)}</span>
                        <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {ageDaysLabel(newPatient)}
                        </span>
                      </div>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        value={newPatient.age}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField('age', e.target.value)}
                        placeholder="Years"
                        error={errors.age}
                      />
                    )}
                  </Field>

                  <Field
                    label="Gender"
                    required
                    error={errors.gender}
                    hint="Male / Female Child read the paediatric reference range on the report."
                  >
                    <select
                      className={selectClass}
                      value={newPatient.gender}
                      onChange={(e) => setField('gender', e.target.value)}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Male Child">Male Child</option>
                      <option value="Female Child">Female Child</option>
                      <option value="Other">Other</option>
                    </select>
                  </Field>

                  <div className="md:col-span-3">
                    <Field label="Address">
                      <Input
                        value={newPatient.address}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField('address', e.target.value)}
                        placeholder="House / street / locality"
                      />
                    </Field>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 2. Who sent them */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Stethoscope className="h-4 w-4 text-violet-600" />
                2. Referring Doctor
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field
                  label="Doctor Name"
                  hint="Tap a panel doctor, or type the name off the prescription. Leave blank for a walk-in."
                >
                  <Input
                    value={doctorName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      // Typing by hand means this is not the paneled doctor any
                      // more, so drop the link rather than crediting the wrong
                      // doctor with the referral.
                      setDoctorName(e.target.value);
                      setDoctorId('');
                    }}
                    placeholder="e.g. Dr. Anjali Mehra"
                  />
                </Field>

                <Field label="Organization / TPA" hint="Applies the corporate rate card.">
                  <select
                    className={selectClass}
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                  >
                    <option value="">Direct / cash patient</option>
                    {asList<Organization>(orgsData, 'organizations').map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.organizationName}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] font-semibold text-muted-foreground">Panel doctors:</span>
                {panelDoctors.length === 0 ? (
                  <span className="text-[12px] text-muted-foreground">none on the panel yet</span>
                ) : (
                  panelDoctors.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => {
                        setDoctorId(d.id);
                        setDoctorName(d.doctorName);
                      }}
                      className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                        doctorId === d.id
                          ? 'border-blue-300 bg-blue-100 text-blue-700'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                      title={d.specialty || undefined}
                    >
                      {d.doctorName}
                    </button>
                  ))
                )}
                {(doctorName || doctorId) && (
                  <button
                    type="button"
                    onClick={() => {
                      setDoctorId('');
                      setDoctorName('');
                    }}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-500 hover:bg-slate-50"
                  >
                    Clear · walk-in
                  </button>
                )}
              </div>

              {doctorName && !doctorId && (
                <p className="text-[12px] text-amber-700">
                  "{doctorName}" is not on the panel - the name goes on the bill and the report, but no referral
                  commission is tracked for them.
                </p>
              )}

              <Field label="Remark" hint="Medication, known conditions, anything the lab should know.">
                <textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Optional"
                />
              </Field>
            </CardContent>
          </Card>

          {/* 3. What to run */}
          <Card>
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <FlaskConical className="h-4 w-4 text-emerald-600" />
                3. Tests to Run
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="relative" ref={testSearchRef}>
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={testSearch}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    setTestSearch(e.target.value);
                    setTestResultsOpen(true);
                  }}
                  onFocus={() => setTestResultsOpen(true)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    const results = searchRows ?? [];

                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                      if (!results.length) return;
                      e.preventDefault();
                      setTestResultsOpen(true);
                      setHighlightedTest((cur) => {
                        const next = e.key === 'ArrowDown' ? cur + 1 : cur - 1;
                        return (next + results.length) % results.length;
                      });
                      return;
                    }

                    if (e.key === 'Escape') {
                      setTestResultsOpen(false);
                      return;
                    }

                    // Enter must not submit the visit from here - it adds the
                    // test the desk has arrowed onto, or the top match.
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    const match = results[highlightedTest] ?? results[0];
                    if (match) addRow(match);
                  }}
                  placeholder={
                    totalTests
                      ? `Search all ${totalTests} tests - name, code or short form`
                      : 'Search a test - name, code or short form'
                  }
                  className="pl-9"
                  autoComplete="off"
                />

                {/* The whole master is searchable, so the matches come back as
                    a list rather than as chips - a thousand-test catalogue can
                    not be laid out flat, and the desk needs the code, the
                    department and the rate to pick the right one. */}
                {testResultsOpen && searchRows && (
                  <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-background shadow-lg">
                    {testSearchPending ? (
                      <p className="p-3 text-[12px] text-muted-foreground">Searching the test master...</p>
                    ) : searchRows.length === 0 ? (
                      <p className="p-3 text-[12px] text-muted-foreground">
                        Nothing matches "{testSearch}". Check the spelling, or add it under Masters &rsaquo; Tests
                        / Packages.
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {searchRows.map((row, index) => {
                          const highlighted = index === highlightedTest;

                          // A panel reads as one thing with a price of its own,
                          // so it is offered the way it is sold: what the whole
                          // set costs, against what the tests inside would have
                          // come to one by one.
                          if (row.kind === 'package') {
                            const pkg = row.pkg;
                            const listTotal =
                              Number(pkg.listTotal) ||
                              (pkg.tests || []).reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
                            const saving = listTotal - Number(pkg.rate || 0);

                            return (
                              <li key={`pkg-${pkg.id}`}>
                                <button
                                  type="button"
                                  onMouseEnter={() => setHighlightedTest(index)}
                                  onClick={() => addPackage(pkg)}
                                  className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition ${
                                    highlighted ? 'bg-violet-50' : 'hover:bg-muted/60'
                                  }`}
                                >
                                  <span className="min-w-0">
                                    <span className="flex items-center gap-1.5">
                                      <Package className="h-3 w-3 shrink-0 text-violet-600" />
                                      <span className="truncate text-xs font-semibold">{pkg.packageName}</span>
                                      <Badge variant="purple" className="shrink-0 px-1.5 py-0 text-[10px]">
                                        Package
                                      </Badge>
                                    </span>
                                    <span className="block truncate text-[11px] text-muted-foreground">
                                      {pkg.packageCode} · {(pkg.tests || []).length} tests
                                      {saving > 0 ? ` · saves ${money(saving)}` : ''}
                                    </span>
                                  </span>
                                  <span className="shrink-0 text-right">
                                    <span className="block text-xs font-semibold text-violet-700">
                                      {money(pkg.rate)}
                                    </span>
                                    {saving > 0 && (
                                      <span className="block text-[11px] text-muted-foreground line-through">
                                        {money(listTotal)}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              </li>
                            );
                          }

                          const t = row.test;
                          return (
                            <li key={testKey(t)}>
                              <button
                                type="button"
                                onMouseEnter={() => setHighlightedTest(index)}
                                onClick={() => addTest(t)}
                                className={`flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition ${
                                  highlighted ? 'bg-emerald-50' : 'hover:bg-muted/60'
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className="flex items-center gap-1.5">
                                    <span className="truncate text-xs font-semibold">{t.testName}</span>
                                    {modeOf(t) === 'Outsource' && (
                                      <Badge variant="amber" className="shrink-0 px-1.5 py-0 text-[10px]">
                                        Out
                                      </Badge>
                                    )}
                                  </span>
                                  <span className="block truncate text-[11px] text-muted-foreground">
                                    {t.testCode}
                                    {(t as any).department?.departmentName
                                      ? ` · ${(t as any).department.departmentName}`
                                      : ''}
                                    {t.fastingRequired ? ' · fasting' : ''}
                                  </span>
                                </span>
                                <span className="shrink-0 text-right">
                                  <span className="block text-xs font-semibold text-emerald-700">
                                    {money(tierRate(t))}
                                  </span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* No row of test names under the box. A menu of thousands cannot
                  be laid out flat, and a dozen of them laid out flat only read
                  as the whole menu. The search box is the menu. */}
              <p className="text-[12px] text-muted-foreground">
                {totalTests ? `${totalTests} tests` : 'Tests'}
                {allPackages.length
                  ? ` and ${allPackages.length} package${allPackages.length === 1 ? '' : 's'}`
                  : ''}{' '}
                on the menu. Type a name, a code or the short form - CBC, APTT, Hb - or a panel like "full body".
              </p>

              {errors.tests && <p className="text-[11px] font-medium text-red-500">{errors.tests}</p>}

              {/* The panels on this bill, read back as panels. The lines they
                  put on the table below are still ordinary lines the desk can
                  price and remove one at a time. */}
              {billPackages.length > 0 && (
                <div className="space-y-2">
                  {billPackages.map((group) => {
                    const groupTotal = group.lines.reduce((sum, l) => sum + (Number(l.rate) || 0), 0);
                    return (
                      <div
                        key={group.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <Package className="h-3.5 w-3.5 shrink-0 text-violet-600" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-bold text-violet-900">
                              {group.name}
                            </span>
                            <span className="block text-[11px] text-violet-700">
                              {group.lines.length} test{group.lines.length === 1 ? '' : 's'} on this bill
                            </span>
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="font-mono text-xs font-bold text-violet-900">
                            {money(groupTotal)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removePackage(group.id)}
                            className="text-[12px] font-semibold text-violet-700 hover:underline"
                          >
                            Remove package
                          </button>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="border-b bg-muted/50 font-semibold">
                    <tr>
                      <th className="p-3">Test</th>
                      <th className="p-3">Sample</th>
                      <th className="p-3 w-36">Processing</th>
                      <th className="p-3 w-24">Rate (₹)</th>
                      <th className="p-3 w-24">Discount (₹)</th>
                      <th className="p-3 text-right">Net</th>
                      <th className="p-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lines.length === 0 ? (
                      <tr>
                        <td colSpan={columnCount} className="p-6 text-center text-muted-foreground">
                          No tests added yet.
                        </td>
                      </tr>
                    ) : (
                      lines.map((line) => {
                        const t = line.test;
                        const key = testKey(t);
                        const lineDiscount = Math.min(line.rate || 0, Math.max(0, line.discount || 0));
                        const lineNet = Math.max(0, (line.rate || 0) - lineDiscount);
                        const noDiscount = t.discountAllowed === false;
                        const cardRate = tierRate(t);
                        const rateChanged = Number(line.rate) !== cardRate;

                        return (
                          <tr key={key}>
                            <td className="p-3">
                              <p className="font-bold">{t.testName}</p>
                              <p className="text-[11px] text-muted-foreground">{t.testCode}</p>
                              {line.packageName && (
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-violet-700">
                                  <Package className="h-2.5 w-2.5" />
                                  {line.packageName}
                                </p>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{t.sampleContainer}</td>

                            {/* Where this one is actually run. The master
                                sets it, the desk overrides it - the bench
                                analyser is down today and this goes out. */}
                            <td className="p-3">
                              <select
                                value={line.processingMode}
                                onChange={(e) =>
                                  updateLine(key, {
                                    processingMode: e.target.value as ProcessingMode,
                                    // Flipping back to the bench drops the
                                    // courier address with it; flipping out
                                    // starts from whatever the master knows.
                                    outsourceLab:
                                      e.target.value === 'Outsource' ? line.outsourceLab || t.outsourceLab || '' : '',
                                  })
                                }
                                className={`h-8 w-full rounded-lg border px-2 text-[12px] font-semibold ${
                                  line.processingMode === 'Outsource'
                                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                }`}
                              >
                                <option value="In-house">In</option>
                                <option value="Outsource">Out</option>
                              </select>

                              {line.processingMode === 'Outsource' && (
                                <Input
                                  value={line.outsourceLab}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                    updateLine(key, { outsourceLab: e.target.value })
                                  }
                                  placeholder="Sent to..."
                                  className="mt-1 h-7 text-[11px]"
                                />
                              )}
                            </td>

                            {/* What this patient is actually charged. The
                                catalogue price is only the starting point. */}
                            <td className="p-3">
                              <Input
                                type="number"
                                min={0}
                                value={line.rate}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateLine(key, {
                                    rate: Math.max(0, Number(e.target.value) || 0),
                                    rateEdited: true,
                                  })
                                }
                                className="h-8 w-20 font-mono"
                              />
                              {rateChanged && (
                                <button
                                  type="button"
                                  onClick={() => updateLine(key, { rate: tierRate(t), rateEdited: false })}
                                  className="mt-1 block text-[11px] text-blue-600 hover:underline"
                                  title="Put the catalogue rate back"
                                >
                                  list {money(cardRate)}
                                </button>
                              )}
                            </td>

                            <td className="p-3">
                              <Input
                                type="number"
                                min={0}
                                max={line.rate}
                                disabled={noDiscount}
                                value={line.discount}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                  updateLine(key, { discount: Math.max(0, Number(e.target.value) || 0) })
                                }
                                className="h-8 w-20 font-mono disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              {noDiscount && (
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  No discount allowed
                                </span>
                              )}
                            </td>

                            <td className="p-3 text-right font-mono font-bold">{money(lineNet)}</td>

                            <td className="p-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeLine(key)}
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
                      come to, what came off them, and what is left - read
                      straight off the same lines above it rather than off a
                      figure typed somewhere else. */}
                  {lines.length > 0 && (
                    <tfoot className="border-t-2 bg-muted/40 font-bold">
                      <tr>
                        <td className="p-3" colSpan={3}>
                          Total &mdash; {lines.length} test{lines.length === 1 ? '' : 's'}
                        </td>
                        <td className="p-3 font-mono">{money(subtotal)}</td>
                        <td className="p-3 font-mono text-emerald-700">
                          {lineDiscountTotal > 0 ? `- ${money(lineDiscountTotal)}` : money(0)}
                        </td>
                        <td className="p-3 text-right font-mono text-sm text-blue-700">
                          {money(subtotal - lineDiscountTotal)}
                        </td>
                        <td className="p-3" />
                      </tr>
                      {billDiscount > 0 && (
                        <tr className="text-[12px] font-semibold">
                          <td className="p-3 pt-0" colSpan={5}>
                            Less bill discount
                            {discountType === 'Percentage' ? ` (${discountValue}%)` : ''}
                          </td>
                          <td className="p-3 pt-0 text-right font-mono text-emerald-700">
                            - {money(billDiscount)}
                          </td>
                          <td className="p-3 pt-0" />
                        </tr>
                      )}
                      {billDiscount > 0 && (
                        <tr>
                          <td className="p-3 pt-0" colSpan={5}>
                            Net payable
                          </td>
                          <td className="p-3 pt-0 text-right font-mono text-sm text-blue-700">
                            {money(netAmount)}
                          </td>
                          <td className="p-3 pt-0" />
                        </tr>
                      )}
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Work leaving the building. The desk says this out loud at the
                  counter - an outsourced test usually reports a day later than
                  the centre's own turnaround promises. */}
              {outsourcedLines.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                  <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {outsourcedLines.length} test{outsourcedLines.length === 1 ? '' : 's'} on this bill{' '}
                    {outsourcedLines.length === 1 ? 'goes' : 'go'} out:{' '}
                    {outsourcedLines
                      .map((l) => `${l.test.testName}${l.outsourceLab ? ` → ${l.outsourceLab}` : ''}`)
                      .join(', ')}
                    . Tell the patient the report may take longer than the usual turnaround.
                  </span>
                </div>
              )}

              {fastingTests.length > 0 && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Tell the patient to come fasting for: {fastingTests.map((t) => t.testName).join(', ')}.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Payment summary.
            The whole column is pinned, not the payment card alone - a sticky
            card with ordinary siblings stays put while the doctor's bill and
            the sent-out list scroll underneath it, and the two overlap.
            `self-start` is what lets it move at all: a stretched grid item is
            already the height of the row and has nowhere to stick to. */}
        <div className="space-y-6 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <Card className="border-2 bg-muted/20">
            <CardHeader className="border-b pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <Receipt className="h-4 w-4 text-blue-600" />
                4. Bill &amp; Payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs">
              <div className="flex justify-between font-semibold">
                <span>Subtotal ({lines.length} tests)</span>
                <span className="font-mono">{money(subtotal)}</span>
              </div>

              {lineDiscountTotal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Test-level discounts</span>
                  <span className="font-mono">- {money(lineDiscountTotal)}</span>
                </div>
              )}

              <div className="space-y-2 border-t pt-3">
                <label className="block font-semibold">Discount on the whole bill</label>
                <div className="flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'Percentage' | 'Fixed')}
                    className="h-9 rounded-lg border bg-background px-2 text-xs"
                  >
                    <option value="Fixed">Fixed (₹)</option>
                    <option value="Percentage">Percent (%)</option>
                  </select>
                  <Input
                    type="number"
                    min={0}
                    max={discountType === 'Percentage' ? 100 : undefined}
                    value={discountValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDiscountValue(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="h-9"
                  />
                </div>

                {billDiscount > 0 && (
                  <div className="flex justify-between font-semibold text-emerald-700">
                    <span>Bill discount</span>
                    <span className="font-mono">- {money(billDiscount)}</span>
                  </div>
                )}

                {discount > 0 && (
                  <Input
                    value={discountReason}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDiscountReason(e.target.value)}
                    placeholder="Reason for discount"
                    className="h-9"
                  />
                )}

                {discountType === 'Percentage' && discountValue > 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    {discountValue}% of {money(discountBase)} left after the test-level discounts.
                  </p>
                )}

                {/* The server refuses this above the staff limit, so say it here
                    rather than after the desk has taken the patient's money. */}
                {concessionPercent > 20 && (
                  <p className="text-[11px] font-semibold text-amber-700">
                    This bill is {concessionPercent.toFixed(1)}% off the rate card - above the 20% staff limit,
                    an Admin has to raise it.
                  </p>
                )}
              </div>

              <div className="flex justify-between border-t pt-3 text-base font-bold text-blue-600">
                <span>Net Payable</span>
                <span className="font-mono">{money(netAmount)}</span>
              </div>

              {/* How the patient is settling. "Split across methods" sits in
                  this list rather than off to one side, because the method
                  dropdown is where the desk looks to answer that question -
                  a patient paying part in cash and the rest on UPI is just
                  another answer to it. */}
              <div className="border-t pt-3">
                <label className="mb-1 block font-semibold">Payment Method</label>
                <select
                  value={splitting ? SPLIT_OPTION : paymentMethod}
                  onChange={(e) => {
                    // Whatever was already typed carries across in both
                    // directions, so changing the method never silently
                    // drops an amount the receptionist entered.
                    if (e.target.value === SPLIT_OPTION) {
                      setTenders(splitSeed(paymentMethod, paidAmount === '' ? netAmount : Number(paidAmount)));
                      setSplitting(true);
                      return;
                    }
                    if (splitting) {
                      setPaidAmount(tenderTotal(tenders));
                      setSplitting(false);
                    }
                    setPaymentMethod(e.target.value);
                  }}
                  className="h-9 w-full rounded-lg border bg-background px-2 text-xs"
                >
                  {COLLECTION_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                  <option value={SPLIT_OPTION}>Split payment (Cash + UPI)</option>
                </select>
                {!splitting && GATEWAY_METHODS.includes(paymentMethod) && paid > 0 && (
                  <p className="mt-1 text-[11px] text-blue-700">
                    The visit is registered first, then {paymentMethod} is collected on the machine.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-1.5 font-semibold">
                  {splitting && <Split className="h-3.5 w-3.5 text-blue-600" />}
                  Amount Received {splitting ? '(by method)' : '(₹)'}
                </label>

                {splitting ? (
                  <SplitPaymentEditor tenders={tenders} onChange={setTenders} target={netAmount} />
                ) : (
                  <>
                    <Input
                      type="number"
                      min={0}
                      value={paidAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setPaidAmount(e.target.value === '' ? '' : Number(e.target.value))
                      }
                      placeholder={String(netAmount)}
                      className="h-9 font-bold text-emerald-600"
                    />
                    <p className="text-[11px] text-muted-foreground">Leave blank to take the full amount.</p>
                  </>
                )}
              </div>

              {balance > 0 && (
                <div className="flex justify-between rounded-lg bg-red-50 p-2 font-bold text-red-600">
                  <span>Balance due</span>
                  <span className="font-mono">{money(balance)}</span>
                </div>
              )}

              {priority === 'Urgent' && (
                <Badge variant="destructive" className="w-full justify-center py-1">
                  Marked URGENT for the lab
                </Badge>
              )}

              <Button
                type="submit"
                disabled={visitMutation.isPending}
                isLoading={visitMutation.isPending}
                className="h-11 w-full bg-blue-600 font-bold hover:bg-blue-700"
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Register Visit &amp; Generate Bill
              </Button>

              <p className="text-center text-[11px] text-muted-foreground">
                Creates the patient record, the invoice and one barcoded sample per test.
              </p>
            </CardContent>
          </Card>

          {/* What is leaving the building, and where to. */}
          {outsourcedLines.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader className="border-b border-amber-200 pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-bold text-amber-900">
                  <Building2 className="h-4 w-4 text-amber-600" />
                  Sent Out ({outsourcedLines.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 pt-4 text-xs">
                {outsourcedLines.map((line) => (
                  <div key={testKey(line.test)} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate text-amber-900">{line.test.testName}</span>
                    <span className="shrink-0 text-[12px] text-amber-700">
                      {line.outsourceLab || 'lab not named'}
                    </span>
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
            // The visit is registered and the bill raised either way - if the
            // patient did not pay, it is simply an unpaid invoice.
            const id = gatewayInvoice.id;
            setGatewayInvoice(null);
            navigate(`/billing/${id}`);
          }}
          onCaptured={() => {
            MONEY_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
          }}
        />
      )}
    </form>
  );
};
