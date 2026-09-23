import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../api/billing.api';
import { testApi } from '../../api/test.api';
import { doctorApi } from '../../api/doctor.api';
import { Doctor, LabTest } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { catalogueQuery } from '../../utils/query-options';
import { X, Plus, Search, Trash2, ReceiptText, Stethoscope, AlertTriangle } from 'lucide-react';

const money = (value: unknown) => `₹${(Number(value) || 0).toLocaleString('en-IN')}`;

/** A line the desk is adding to a bill that already exists. */
interface AddedLine {
  test: LabTest;
  rate: number;
  discount: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  onSaved: () => void;
}

const testKey = (test: LabTest | undefined | null): string =>
  String(test?.id ?? (test as any)?._id ?? '');

/**
 * A bill being changed at the counter after it was raised.
 *
 * Two things happen at the desk that raising a second bill answers badly. A
 * patient billed this morning wants one more test - which belongs on the same
 * visit, under the same number, not on a bill of its own. And a patient coming
 * in to settle a due has been promised a concession since, which has to land
 * on the bill they are about to pay rather than as a credit note afterwards.
 *
 * Both are the same edit, so they are one screen: add the tests, set the
 * discount and say which doctor it came through, and the bill is re-priced.
 */
export const ReviseInvoiceModal: React.FC<Props> = ({ isOpen, onClose, invoice, onSaved }) => {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [added, setAdded] = useState<AddedLine[]>([]);
  const [discountType, setDiscountType] = useState<'Percentage' | 'Fixed'>('Fixed');
  const [discountValue, setDiscountValue] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [discountDoctorId, setDiscountDoctorId] = useState('');
  const [discountDoctorName, setDiscountDoctorName] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [saving, setSaving] = useState(false);

  // The bill as it stands. Cancelled lines are settled money and are shown
  // but never re-priced, so they are kept out of every figure below.
  const liveItems: any[] = (invoice?.items || []).filter((item: any) => !item.cancelled);

  useEffect(() => {
    if (!isOpen || !invoice) return;
    setSearch('');
    setAdded([]);
    setDiscountType((invoice.discountType as 'Percentage' | 'Fixed') || 'Fixed');
    setDiscountValue(Number(invoice.discountValue) || 0);
    setDiscountReason(invoice.discountReason || '');
    const doctor = invoice.discountDoctor;
    setDiscountDoctorId(
      doctor && typeof doctor === 'object' ? String(doctor.id || doctor._id || '') : String(doctor || '')
    );
    setDiscountDoctorName(invoice.discountDoctorName || '');
    setRevisionNote('');
  }, [isOpen, invoice]);

  const { data: doctorsData } = useQuery({
    queryKey: ['revise-doctors'],
    queryFn: () => doctorApi.getAll({ limit: 200, status: 'Active' }),
    enabled: isOpen,
    ...catalogueQuery,
  });

  // Searched on the server, like the intake screen does - a centre with a few
  // thousand tests on its menu cannot hold them all on the page.
  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ['revise-test-search', search.trim()],
    queryFn: () => testApi.getAll({ search: search.trim(), status: 'Active', limit: 25 }),
    enabled: isOpen && search.trim().length >= 2,
    placeholderData: (prev: any) => prev,
    staleTime: 30_000,
  });

  const doctors = asList<Doctor>(doctorsData, 'doctors');
  const matches = asList<LabTest>(searchData, 'tests');

  const onBill = useMemo(
    () => new Set(liveItems.map((item: any) => String(item.test?._id || item.test))),
    [liveItems]
  );
  const addedKeys = useMemo(() => new Set(added.map((line) => testKey(line.test))), [added]);

  /**
   * What the bill comes to with this revision on it, worked out the way the
   * server does: the line discounts come off first, then the bill-wide one
   * lands on what is left. The desk sees the figure before it saves.
   */
  const keptRate = liveItems.reduce((sum: number, item: any) => sum + (Number(item.rate) || 0), 0);
  const keptLineDiscount = liveItems.reduce(
    (sum: number, item: any) => sum + (Number(item.lineDiscountAmount ?? item.discountAmount) || 0),
    0
  );
  const addedRate = added.reduce((sum, line) => sum + (Number(line.rate) || 0), 0);
  const addedLineDiscount = added.reduce(
    (sum, line) => sum + Math.min(Number(line.rate) || 0, Math.max(0, Number(line.discount) || 0)),
    0
  );

  const subtotal = keptRate + addedRate;
  const lineDiscountTotal = keptLineDiscount + addedLineDiscount;
  const discountBase = Math.max(0, subtotal - lineDiscountTotal);
  const billDiscount =
    discountType === 'Percentage'
      ? (discountBase * Math.min(100, Math.max(0, discountValue))) / 100
      : Math.min(discountBase, Math.max(0, discountValue));

  // What the centre kept on lines the patient cancelled stays on the bill.
  const retainedOnCancelled = (invoice?.items || [])
    .filter((item: any) => item.cancelled)
    .reduce((sum: number, item: any) => sum + (Number(item.retainedAmount) || 0), 0);

  const netAmount = Math.max(0, subtotal - lineDiscountTotal - billDiscount) + retainedOnCancelled;
  const paid = Number(invoice?.paidAmount) || 0;
  const newDue = Math.max(0, netAmount - paid);
  // Money already in the drawer cannot be undone by an edit - it goes back
  // through the refund desk, where it is receipted.
  const belowPaid = netAmount < paid;

  if (!isOpen || !invoice) return null;

  const addTest = (test: LabTest) => {
    const key = testKey(test);
    if (!key) return;
    if (onBill.has(key)) {
      showToast(`${test.testName} is already on this bill`, 'error');
      return;
    }
    if (addedKeys.has(key)) return;
    setAdded((prev) => [...prev, { test, rate: Number(test.rate) || 0, discount: 0 }]);
    setSearch('');
  };

  const handleSave = async () => {
    if (belowPaid) {
      showToast('This revision drops the bill below what has already been paid - issue a refund instead', 'error');
      return;
    }

    const payload: any = {
      discountType,
      discountValue: Number(discountValue) || 0,
      discountReason: discountReason.trim(),
      discountDoctorId: discountDoctorId || undefined,
      discountDoctorName: discountDoctorId ? undefined : discountDoctorName.trim() || undefined,
      revisionNote: revisionNote.trim() || undefined,
    };

    if (added.length) {
      payload.addItems = added.map((line) => ({
        testId: testKey(line.test),
        rate: Number(line.rate) || 0,
        discountAmount: Math.min(Number(line.rate) || 0, Math.max(0, Number(line.discount) || 0)),
      }));
    }

    try {
      setSaving(true);
      const result = await billingApi.reviseInvoice(invoice.id || invoice._id, payload);
      showToast(
        result?.testsAdded?.length
          ? `${result.testsAdded.length} test(s) added - the bill is now ${money(result.netAfter)}`
          : `Bill revised - now ${money(result.netAfter)}`,
        'success'
      );
      onSaved();
      onClose();
    } catch (error: any) {
      showToast(error?.message || 'Could not revise this bill', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="max-h-[90vh] w-full max-w-3xl space-y-4 overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-foreground">
              <ReceiptText className="h-4 w-4 text-blue-600" />
              Edit Bill {invoice.invoiceNumber}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Add a test to this same visit, or change the discount before the patient settles.
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-accent" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Already on the bill */}
          <div>
            <p className="mb-1 font-semibold">Already on this bill ({liveItems.length})</p>
            <div className="max-h-32 overflow-y-auto rounded-xl border">
              <ul className="divide-y">
                {liveItems.map((item: any, index: number) => (
                  <li key={item._id || index} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{item.testName}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{item.testCode}</span>
                    </span>
                    <span className="shrink-0 font-mono">{money(item.netAmount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Adding tests to the same visit */}
          <div className="space-y-2 border-t pt-3">
            <p className="font-semibold">Add a test to this visit</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the catalogue by name or code"
                className="pl-9"
              />
            </div>

            {search.trim().length >= 2 && (
              <div className="max-h-44 overflow-y-auto rounded-xl border">
                {searching && matches.length === 0 ? (
                  <p className="p-3 text-muted-foreground">Searching...</p>
                ) : matches.length === 0 ? (
                  <p className="p-3 text-muted-foreground">No test matches "{search}".</p>
                ) : (
                  <ul className="divide-y">
                    {matches.map((test) => {
                      const key = testKey(test);
                      const already = onBill.has(key) || addedKeys.has(key);
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            disabled={already}
                            onClick={() => addTest(test)}
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition ${
                              already ? 'opacity-50' : 'hover:bg-muted/60'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{test.testName}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {test.testCode}
                                {already ? ' · already on the bill' : ''}
                              </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="font-mono">{money(test.rate)}</span>
                              {!already && <Plus className="h-3.5 w-3.5 text-blue-600" />}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {added.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-blue-200">
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead className="border-b bg-blue-50 font-semibold text-blue-900">
                    <tr>
                      <th className="p-2">Being added</th>
                      <th className="p-2 w-24">Rate (₹)</th>
                      <th className="p-2 w-24">Discount (₹)</th>
                      <th className="p-2 text-right">Net</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {added.map((line, index) => {
                      const lineDiscount = Math.min(line.rate || 0, Math.max(0, line.discount || 0));
                      return (
                        <tr key={testKey(line.test)}>
                          <td className="p-2">
                            <div className="font-semibold">{line.test.testName}</div>
                            <div className="text-muted-foreground">{line.test.testCode}</div>
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              className="h-8"
                              value={line.rate}
                              onChange={(e) =>
                                setAdded((prev) =>
                                  prev.map((l, i) =>
                                    i === index ? { ...l, rate: Math.max(0, Number(e.target.value) || 0) } : l
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number"
                              min={0}
                              className="h-8"
                              disabled={line.test.discountAllowed === false}
                              value={line.discount}
                              onChange={(e) =>
                                setAdded((prev) =>
                                  prev.map((l, i) =>
                                    i === index
                                      ? { ...l, discount: Math.max(0, Number(e.target.value) || 0) }
                                      : l
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="p-2 text-right font-mono font-bold">
                            {money(Math.max(0, (line.rate || 0) - lineDiscount))}
                          </td>
                          <td className="p-2 text-right">
                            <button
                              type="button"
                              onClick={() => setAdded((prev) => prev.filter((_, i) => i !== index))}
                              className="text-red-500 hover:text-red-700"
                              aria-label={`Remove ${line.test.testName}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* The discount, and whose it is */}
          <div className="space-y-2 border-t pt-3">
            <p className="font-semibold">Discount on the whole bill</p>
            <div className="flex gap-2">
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as 'Percentage' | 'Fixed')}
                className="h-9 rounded-lg border bg-background px-2"
              >
                <option value="Fixed">Fixed (₹)</option>
                <option value="Percentage">Percent (%)</option>
              </select>
              <Input
                type="number"
                min={0}
                max={discountType === 'Percentage' ? 100 : undefined}
                className="h-9"
                value={discountValue}
                onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>

            {(billDiscount > 0 || lineDiscountTotal > 0) && (
              <>
                <div>
                  <label className="mb-1 flex items-center gap-1 font-semibold">
                    <Stethoscope className="h-3 w-3 text-violet-600" />
                    Discount given through
                  </label>
                  <select
                    value={discountDoctorId}
                    onChange={(e) => {
                      setDiscountDoctorId(e.target.value);
                      if (e.target.value) setDiscountDoctorName('');
                    }}
                    className="h-9 w-full rounded-lg border bg-background px-2"
                  >
                    <option value="">Centre&rsquo;s own concession / not through a doctor</option>
                    {doctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.doctorName}
                        {doctor.specialty ? ` · ${doctor.specialty}` : ''}
                      </option>
                    ))}
                  </select>
                  {!discountDoctorId && (
                    <Input
                      className="mt-1 h-9"
                      value={discountDoctorName}
                      onChange={(e) => setDiscountDoctorName(e.target.value)}
                      placeholder="Or type a doctor who is not on the panel"
                    />
                  )}
                </div>

                <Input
                  className="h-9"
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="Reason for the discount"
                />
              </>
            )}
          </div>

          {/* What it comes to */}
          <div className="space-y-1 rounded-xl border bg-muted/30 p-3">
            <div className="flex justify-between">
              <span>Subtotal ({liveItems.length + added.length} tests)</span>
              <span className="font-mono">{money(subtotal)}</span>
            </div>
            {lineDiscountTotal > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Test-level discounts</span>
                <span className="font-mono">- {money(lineDiscountTotal)}</span>
              </div>
            )}
            {billDiscount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Bill discount{discountType === 'Percentage' ? ` (${discountValue}%)` : ''}</span>
                <span className="font-mono">- {money(billDiscount)}</span>
              </div>
            )}
            {retainedOnCancelled > 0 && (
              <div className="flex justify-between text-amber-700">
                <span>Retained on cancelled tests</span>
                <span className="font-mono">{money(retainedOnCancelled)}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 font-bold text-blue-700">
              <span>New bill total</span>
              <span className="font-mono">{money(netAmount)}</span>
            </div>
            <div className="flex justify-between text-emerald-700">
              <span>Already paid</span>
              <span className="font-mono">{money(paid)}</span>
            </div>
            <div className="flex justify-between font-bold text-amber-700">
              <span>Due after this revision</span>
              <span className="font-mono">{money(newDue)}</span>
            </div>
          </div>

          {belowPaid && (
            <p className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-red-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                This brings the bill below the {money(paid)} already collected. Money that has come in goes back
                through Accounts as a refund, so it is receipted - it cannot be undone by editing the bill.
              </span>
            </p>
          )}

          <div>
            <label className="mb-1 block font-semibold">Note for the bill&rsquo;s history</label>
            <Input
              value={revisionNote}
              onChange={(e) => setRevisionNote(e.target.value)}
              placeholder="e.g. Patient added Vitamin D while paying the due"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3">
            <span className="text-[11px] text-muted-foreground">
              {added.length > 0 ? (
                <Badge variant="purple">{added.length} test(s) will be queued for collection</Badge>
              ) : (
                'Nothing new to collect - only the bill changes.'
              )}
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSave} isLoading={saving} disabled={belowPaid}>
                Save &amp; regenerate bill
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
