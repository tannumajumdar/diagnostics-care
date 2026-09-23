import React, { useEffect, useMemo, useState } from 'react';
import { Department, LabTest, TestPackage } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { X, Search, Check, Trash2, Package } from 'lucide-react';

interface PackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  pkg?: TestPackage | null;
  /** The whole active catalogue, for picking what goes in the panel. */
  tests: LabTest[];
  /** The department master, for filing the panel under one of them. */
  departments: Department[];
}

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const testKey = (test: LabTest | undefined | null): string =>
  String(test?.id ?? (test as any)?._id ?? test?.testCode ?? '');

const referralRateOf = (test: LabTest): number =>
  Number(test?.referralRate) || Number(test?.rate) || 0;

/** A department ref, which arrives either populated or as a bare id. */
const departmentId = (department: TestPackage['department']): string =>
  !department ? '' : typeof department === 'string' ? department : department.id || '';

/**
 * The panel master.
 *
 * A package is a price, not a test: the admin picks tests out of the
 * catalogue, sets what the whole set costs, and the tests inside carry on
 * being ordinary tests the lab draws, runs and reports one by one. The two
 * totals - the panel price and what those tests would have cost separately -
 * sit next to each other while it is being built, because a package that is
 * not cheaper than its parts is a package nobody will sell.
 */
export const PackageModal: React.FC<PackageModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  pkg,
  tests,
  departments,
}) => {
  const [packageName, setPackageName] = useState('');
  const [packageCode, setPackageCode] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rate, setRate] = useState(0);
  const [referralRate, setReferralRate] = useState(0);
  const [discountAllowed, setDiscountAllowed] = useState(true);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (pkg) {
      setPackageName(pkg.packageName);
      setPackageCode(pkg.packageCode);
      setDepartment(departmentId(pkg.department));
      setDescription(pkg.description || '');
      setSelectedIds((pkg.tests || []).map(testKey).filter(Boolean));
      setRate(Number(pkg.rate) || 0);
      setReferralRate(Number(pkg.referralRate) || 0);
      setDiscountAllowed(pkg.discountAllowed !== false);
    } else {
      setPackageName('');
      setPackageCode('');
      setDepartment('');
      setDescription('');
      setSelectedIds([]);
      setRate(0);
      setReferralRate(0);
      setDiscountAllowed(true);
    }
    setSearch('');
    setError('');
  }, [pkg, isOpen]);

  const byId = useMemo(() => new Map(tests.map((t) => [testKey(t), t])), [tests]);

  const selectedTests = useMemo(
    () => selectedIds.map((id) => byId.get(id)).filter(Boolean) as LabTest[],
    [selectedIds, byId]
  );

  // What the panel would have cost billed test by test. The saving is the
  // whole reason a patient says yes to it.
  const listTotal = selectedTests.reduce((sum, t) => sum + (Number(t.rate) || 0), 0);
  const referralListTotal = selectedTests.reduce((sum, t) => sum + referralRateOf(t), 0);
  const saving = listTotal - rate;

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tests.slice(0, 40);
    return tests
      .filter(
        (t) =>
          t.testName.toLowerCase().includes(q) || String(t.testCode || '').toLowerCase().includes(q)
      )
      .slice(0, 40);
  }, [search, tests]);

  if (!isOpen) return null;

  const toggle = (test: LabTest) => {
    const key = testKey(test);
    if (!key) return;
    setError('');
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((id) => id !== key) : [...prev, key]));
  };

  /** Prices the panel off what is in it, so the admin starts from a real figure. */
  const priceAtList = () => {
    setRate(listTotal);
    setReferralRate(referralListTotal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError('Add at least one test to the package');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        packageName: packageName.trim(),
        packageCode: packageCode.trim().toUpperCase(),
        department: department || null,
        description: description.trim(),
        tests: selectedIds,
        rate: Number(rate) || 0,
        referralRate: Number(referralRate) || 0,
        discountAllowed,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-4xl space-y-4 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
            <Package className="h-4 w-4 text-violet-600" />
            {pkg ? 'Edit Test Package' : 'Add New Test Package'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block font-semibold">Package Name *</label>
              <Input
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="e.g. Full Body Checkup"
                required
              />
            </div>
            <div>
              <label className="mb-1 block font-semibold">Package Code *</label>
              <Input
                value={packageCode}
                onChange={(e) => setPackageCode(e.target.value.toUpperCase())}
                placeholder="e.g. FBC"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-semibold">Department</label>
              <select
                className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">All / Multiple departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {department
                  ? 'The desk can filter the panel list by this.'
                  : 'Leave this for a panel spanning the lab - the tests inside keep their own departments.'}
              </span>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block font-semibold">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
                placeholder="What this panel is for - shown to the desk"
              />
            </div>
          </div>

          {/* Picking what goes in */}
          <div className="grid grid-cols-1 gap-4 border-t pt-3 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="block font-semibold">Tests in the catalogue</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or code"
                  className="pl-9"
                />
              </div>

              <div className="max-h-60 overflow-y-auto rounded-xl border">
                {matches.length === 0 ? (
                  <p className="p-3 text-[12px] text-muted-foreground">No test matches "{search}".</p>
                ) : (
                  <ul className="divide-y">
                    {matches.map((t) => {
                      const key = testKey(t);
                      const picked = selectedIds.includes(key);
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => toggle(t)}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition ${
                              picked ? 'bg-violet-50' : 'hover:bg-muted/60'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{t.testName}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {t.testCode}
                                {t.processingMode === 'Outsource' ? ' · outsourced' : ''}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="font-mono text-[12px]">{money(t.rate)}</span>
                              {picked && <Check className="h-3.5 w-3.5 text-violet-600" />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="block font-semibold">In this package ({selectedTests.length})</label>

              <div className="max-h-60 overflow-y-auto rounded-xl border bg-muted/20">
                {selectedTests.length === 0 ? (
                  <p className="p-3 text-[12px] text-muted-foreground">
                    Nothing picked yet. Tap a test on the left to put it in the panel.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {selectedTests.map((t) => (
                      <li key={testKey(t)} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{t.testName}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{t.testCode}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="font-mono text-[12px]">{money(t.rate)}</span>
                          <button
                            type="button"
                            onClick={() => toggle(t)}
                            className="text-red-500 hover:text-red-700"
                            aria-label={`Remove ${t.testName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedTests.length > 0 && (
                <p className="text-[12px] text-muted-foreground">
                  Billed one by one these come to <strong>{money(listTotal)}</strong>.
                  <button
                    type="button"
                    onClick={priceAtList}
                    className="ml-1 font-semibold text-violet-600 hover:underline"
                  >
                    Price the panel at that
                  </button>
                </p>
              )}
            </div>
          </div>

          {error && <p className="text-[12px] font-medium text-red-500">{error}</p>}

          {/* What it sells for */}
          <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block font-semibold">Package Price (₹) *</label>
              <Input
                type="number"
                min={0}
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                required
              />
              <span className="mt-1 block text-[11px]">
                {selectedTests.length === 0 ? (
                  <span className="text-muted-foreground">What the patient pays for the whole panel.</span>
                ) : saving > 0 ? (
                  <span className="font-semibold text-emerald-600">
                    Saves the patient {money(saving)} against {money(listTotal)}
                  </span>
                ) : saving === 0 ? (
                  <span className="text-muted-foreground">Same as billing the tests separately.</span>
                ) : (
                  <span className="font-semibold text-amber-600">
                    {money(-saving)} more than billing the tests separately
                  </span>
                )}
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold">Referring Doctor&rsquo;s Price (₹)</label>
              <Input
                type="number"
                min={0}
                value={referralRate}
                onChange={(e) => setReferralRate(Number(e.target.value))}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {Number(referralRate) > 0
                  ? `Doctor's copy prints ${money(referralRate)} for the panel.`
                  : `Leave at 0 and the doctor's copy falls back to each test's own rate (${money(
                      referralListTotal
                    )}).`}
              </span>
            </div>

            <div>
              <label className="mb-1 block font-semibold">Discount</label>
              <div className="flex h-10 items-center gap-2 rounded-xl border px-3">
                <input
                  id="pkg-discount-allowed"
                  type="checkbox"
                  checked={discountAllowed}
                  onChange={(e) => setDiscountAllowed(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <label htmlFor="pkg-discount-allowed" className="cursor-pointer">
                  Further discount allowed
                </label>
              </div>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                A panel price is usually already the discount.
              </span>
            </div>
          </div>

          {selectedTests.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3">
              <Badge variant="purple">{selectedTests.length} tests</Badge>
              <span className="text-[12px] text-violet-900">
                Patient pays <strong className="font-mono">{money(rate)}</strong> · Doctor&rsquo;s copy{' '}
                <strong className="font-mono">
                  {money(Number(referralRate) > 0 ? referralRate : referralListTotal)}
                </strong>
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={submitting}>
              {pkg ? 'Save Changes' : 'Create Package'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
