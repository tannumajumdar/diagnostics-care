import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { billingApi } from '../../api/billing.api';
import { Invoice } from '../../types';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { DATE_PRESETS, formatDay, relativeDayLabel, todayKey } from '../../utils/dates';
import { exportToExcel } from '../../utils/excel-export';
import { invoiceExportRows, paymentBreakdownOf, processingModeOf } from '../../utils/invoice-export';
import { methodIcon, methodLabel } from '../../config/payment-methods';
import { useToast } from '../../context/ToastContext';
import {
  CreditCard,
  Plus,
  Search,
  Eye,
  Barcode,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Download,
  X,
} from 'lucide-react';

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Where the work on a bill was run. One outsourced line makes the whole bill
 * an outsourced one, so the two buckets never overlap and their counts still
 * add up to the window - picking one and then the other accounts for every
 * bill exactly once.
 */
type ProcessingFilter = '' | 'In-house' | 'Outsource';

const PROCESSING_FILTERS: Array<{ label: string; value: ProcessingFilter }> = [
  { label: 'All work', value: '' },
  { label: 'In-house', value: 'In-house' },
  { label: 'Outsource', value: 'Outsource' },
];

/**
 * Whether the money is in. "Unpaid" is every bill still owing something - the
 * part-paid one and the one left on credit as much as the one nothing was
 * taken on - because that is the list the desk works from when it chases the
 * day's outstanding, and a partial bill left out of both buckets is a bill
 * nobody follows up.
 */
type PaymentFilter = '' | 'Paid' | 'Unpaid';

const PAYMENT_FILTERS: Array<{ label: string; value: PaymentFilter }> = [
  { label: 'Paid & unpaid', value: '' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Unpaid / due', value: 'Unpaid' },
];

/** The date and time a bill was raised, split over two lines in the row. */
const billedOn = (value?: string) => {
  if (!value) return { day: '—', time: '' };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { day: '—', time: '' };
  return {
    day: formatDay(date),
    time: date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
  };
};

export const BillingListPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  // The date window the desk is looking at. Empty means every bill ever
  // raised, which is the right default for a search by invoice number.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  // Bills run in house against bills that had anything sent out. Empty means
  // both, which is the whole day's billing.
  const [processingMode, setProcessingMode] = useState<ProcessingFilter>('');
  // Paid against still owing. Sits beside the search box rather than in the
  // chips below it, because "which of these is unpaid" is the same question
  // as the search itself - the desk is looking for one bill or for the ones
  // it still has to collect on.
  const [paymentStatus, setPaymentStatus] = useState<PaymentFilter>('');

  const applyRange = (next: { from: string; to: string }) => {
    setFrom(next.from);
    setTo(next.to);
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', searchTerm, from, to, processingMode, paymentStatus, page],
    queryFn: () =>
      billingApi.getAllInvoices({
        search: searchTerm || undefined,
        from: from || undefined,
        to: to || undefined,
        processingMode: processingMode || undefined,
        paymentStatus: paymentStatus || undefined,
        page,
        limit: 10,
      }),
    placeholderData: (prev: any) => prev,
  });

  const invoiceList: Invoice[] = data?.invoices || (Array.isArray(data) ? data : []);
  const meta = data?.meta || data?.pagination || {};
  const totalPages = meta.totalPages || 1;
  // Totals for the whole filtered window, counted by the server - adding up
  // the ten rows on screen would answer "how much did we bill today" with one
  // page of the answer.
  const summary = meta.summary || { invoices: 0, billed: 0, collected: 0, due: 0, discount: 0 };

  const rangeLabel = (() => {
    if (!from && !to) return 'All time';
    if (from && from === to) return relativeDayLabel(from);
    if (from && to) return `${formatDay(`${from}T00:00:00`)} - ${formatDay(`${to}T00:00:00`)}`;
    if (from) return `From ${formatDay(`${from}T00:00:00`)}`;
    return `Up to ${formatDay(`${to}T00:00:00`)}`;
  })();

  const activePreset = DATE_PRESETS.find((preset) => {
    const range = preset.range();
    return range.from === from && range.to === to;
  })?.label;

  /**
   * Every bill the filters above match, written to a spreadsheet - not the ten
   * rows on screen. The desk closes its books against a date window, so the
   * file has to hold that whole window or it cannot be reconciled, which is
   * why this walks the pages rather than exporting what is rendered.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const { invoices, truncated } = await billingApi.getInvoicesForExport({
        search: searchTerm || undefined,
        from: from || undefined,
        to: to || undefined,
        processingMode: processingMode || undefined,
        paymentStatus: paymentStatus || undefined,
      });

      if (!invoices.length) {
        showToast('No bills to export for this filter', 'error');
        return;
      }

      const windowSlug = !from && !to ? 'all-time' : `${from || 'start'}_to_${to || todayKey()}`;
      // The file is named for the filter it was taken under, so an in-house
      // sheet and an outsourced one for the same week do not overwrite each
      // other in the accountant's downloads folder.
      const modeSlug = processingMode ? `_${processingMode.toLowerCase()}` : '';
      const paidSlug = paymentStatus ? `_${paymentStatus.toLowerCase()}` : '';
      await exportToExcel(`bills_${windowSlug}${modeSlug}${paidSlug}`, invoiceExportRows(invoices), {
        sheetName: 'Bills',
      });

      showToast(
        truncated
          ? `Exported the newest ${invoices.length} bills - narrow the dates to export the rest`
          : `Exported ${invoices.length} bill${invoices.length === 1 ? '' : 's'}`,
        truncated ? 'info' : 'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not export the bills', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-blue-600" />
            <span>Billing &amp; Invoices Directory</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Generate patient bills, apply automated tariff discounts, collect payments, and issue barcode labels.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Exports the whole filtered window, so the label says which one. */}
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || !summary.invoices}
            isLoading={exporting}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            <span>Export {summary.invoices ? `(${summary.invoices})` : ''}</span>
          </Button>
          <Button onClick={() => navigate('/billing/new')} className="gap-2">
            <Plus className="h-4 w-4" />
            <span>New Patient Bill</span>
          </Button>
        </div>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* The search box and the two questions the desk asks of a search:
              was this work run here or sent out, and has the money come in.
              Both sit against the box rather than in the chip row, so one
              glance shows what the list on screen has been narrowed to. */}
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice #, UHID, barcode..."
                className="pl-9 text-xs"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={processingMode}
                onChange={(e) => {
                  setProcessingMode(e.target.value as ProcessingFilter);
                  setPage(1);
                }}
                aria-label="In-house or outsourced work"
                className={`h-9 rounded-lg border bg-background px-2 text-xs font-medium ${
                  processingMode ? 'border-blue-300 text-blue-700' : 'text-slate-600'
                }`}
              >
                {PROCESSING_FILTERS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value as PaymentFilter);
                  setPage(1);
                }}
                aria-label="Paid or unpaid bills"
                className={`h-9 rounded-lg border bg-background px-2 text-xs font-medium ${
                  paymentStatus ? 'border-blue-300 text-blue-700' : 'text-slate-600'
                }`}
              >
                {PAYMENT_FILTERS.map((option) => (
                  <option key={option.label} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* A bill belongs to a day, and the day is how the desk closes its
              books - so the window is picked here and the totals below answer
              for that window rather than for whatever is on this page. */}
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              type="date"
              value={from}
              max={to || todayKey()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[9.5rem] text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="h-9 w-[9.5rem] text-xs"
            />
            {(from || to) && (
              <Button variant="outline" size="sm" className="h-9 gap-1" onClick={() => applyRange({ from: '', to: '' })}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((preset) => {
            const isActive = activePreset === preset.label;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyRange(preset.range())}
                className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                  isActive
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => applyRange({ from: '', to: '' })}
            className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
              !from && !to
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            All time
          </button>

        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-5">
          <div>
            {/* The totals answer for the filters above, so the label carries
                them - a count under a bare "All time" while the In-house chip
                is on would be read as the whole window's billing. */}
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Bills · {rangeLabel}
              {processingMode ? ` · ${processingMode}` : ''}
              {paymentStatus ? ` · ${paymentStatus === 'Paid' ? 'Paid' : 'Unpaid'}` : ''}
            </p>
            <p className="text-sm font-bold text-foreground">{summary.invoices}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Billed</p>
            <p className="text-sm font-bold text-foreground">{money(summary.billed)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Collected</p>
            <p className="text-sm font-bold text-emerald-600">{money(summary.collected)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Outstanding due</p>
            <p className="text-sm font-bold text-amber-600">{money(summary.due)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Discount given</p>
            <p className="text-sm font-bold text-emerald-600">{money(summary.discount)}</p>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Invoice # / Barcode</th>
                <th className="p-3">Patient Profile</th>
                <th className="p-3 text-right">Discount</th>
                <th className="p-3">Net Amount</th>
                <th className="p-3">Paid Amount</th>
                <th className="p-3">Due Amount</th>
                <th className="p-3">Paid By</th>
                <th className="p-3">Payment Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    Loading billing invoices...
                  </td>
                </tr>
              ) : invoiceList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    {from || to || searchTerm || processingMode
                      ? 'No invoices match this filter.'
                      : 'No invoices generated yet.'}
                  </td>
                </tr>
              ) : (
                invoiceList.map((inv: Invoice) => {
                  const patient = typeof inv.patient === 'object' ? inv.patient : {};
                  const raised = billedOn((inv as any).createdAt);
                  const breakdown = paymentBreakdownOf(inv);
                  const mode = processingModeOf(inv);
                  // Derived rather than read off a field: a bill carries its
                  // gross and its net, and what was knocked off is the gap.
                  const gross = Number((inv as any).subtotal ?? inv.netAmount ?? 0);
                  const discount = Math.max(0, gross - Number(inv.netAmount ?? 0));
                  return (
                    <tr key={inv._id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground">{raised.day}</div>
                        <div className="text-[11px] text-muted-foreground">{raised.time}</div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-blue-600">{inv.invoiceNumber}</span>
                          {/* Whether the bench ran this bill or it went out.
                              Sits on the row rather than only behind View
                              Details, because chasing a referral lab starts
                              from this list. */}
                          {mode && (
                            <span
                              title={mode === 'Outsource' ? 'Has tests sent out' : 'Run in house'}
                              className={`rounded px-1 py-px text-[10px] font-bold uppercase tracking-wide ${
                                mode === 'Outsource'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {mode === 'Outsource' ? 'Out' : 'In'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Barcode className="h-3 w-3" /> {inv.barcode}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground">{(patient as any).patientName || 'N/A'}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">UHID: {inv.uhid}</div>
                      </td>
                      {/* What the desk gave away on this bill - the per-line
                          discounts and the bill-wide one together, which is
                          just the gap between gross and net. */}
                      <td className="p-3 text-right">
                        {discount > 0 ? (
                          <>
                            <div className="font-mono font-semibold text-emerald-600">- {money(discount)}</div>
                            <div className="text-[11px] text-muted-foreground">
                              {inv.discountType === 'Percentage' && Number(inv.discountValue) > 0
                                ? `${inv.discountValue}%`
                                : ''}
                              {inv.discountReason ? ` ${inv.discountReason}` : ''}
                            </div>
                          </>
                        ) : (
                          <span className="font-mono text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground">₹{inv.netAmount}</td>
                      <td className="p-3 font-mono font-semibold text-emerald-600">₹{inv.paidAmount}</td>
                      <td className="p-3 font-mono font-semibold text-amber-600">₹{inv.dueAmount}</td>
                      {/* How the money actually came in. A bill settled half
                          in cash and half by UPI shows both, with what each
                          brought - one chip reading "Cash" would send the
                          desk to the wrong ledger. */}
                      <td className="p-3">
                        {breakdown.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {breakdown.map((entry) => {
                              const Icon = methodIcon(entry.method);
                              return (
                                <span
                                  key={entry.method}
                                  title={`${methodLabel(entry.method)} · ${money(entry.amount)}`}
                                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
                                >
                                  {Icon && <Icon className="h-2.5 w-2.5" />}
                                  {methodLabel(entry.method)}
                                  {breakdown.length > 1 && (
                                    <span className="font-mono text-slate-500">{money(entry.amount)}</span>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant={inv.paymentStatus === 'Paid' ? 'success' : 'amber'}>
                          {inv.paymentStatus}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/billing/${inv._id}`)}>
                          <Eye className="h-4 w-4 mr-1" /> View Details
                        </Button>
                      </td>
                    </tr>
                  );
                })
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
