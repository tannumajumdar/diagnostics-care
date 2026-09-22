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
import {
  CreditCard,
  Plus,
  Search,
  Eye,
  Barcode,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  X,
} from 'lucide-react';

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

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
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // The date window the desk is looking at. Empty means every bill ever
  // raised, which is the right default for a search by invoice number.
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const applyRange = (next: { from: string; to: string }) => {
    setFrom(next.from);
    setTo(next.to);
    setPage(1);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', searchTerm, from, to, page],
    queryFn: () =>
      billingApi.getAllInvoices({
        search: searchTerm || undefined,
        from: from || undefined,
        to: to || undefined,
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
        <Button onClick={() => navigate('/billing/new')} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>New Patient Bill</span>
        </Button>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-80">
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
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
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
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              !from && !to
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
            }`}
          >
            All time
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-muted/30 p-3 sm:grid-cols-4">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Bills · {rangeLabel}</p>
            <p className="text-sm font-bold text-foreground">{summary.invoices}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Billed</p>
            <p className="text-sm font-bold text-foreground">{money(summary.billed)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Collected</p>
            <p className="text-sm font-bold text-emerald-600">{money(summary.collected)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding due</p>
            <p className="text-sm font-bold text-amber-600">{money(summary.due)}</p>
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
                <th className="p-3">Net Amount</th>
                <th className="p-3">Paid Amount</th>
                <th className="p-3">Due Amount</th>
                <th className="p-3">Payment Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading billing invoices...
                  </td>
                </tr>
              ) : invoiceList.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    {from || to || searchTerm
                      ? 'No invoices match this filter.'
                      : 'No invoices generated yet.'}
                  </td>
                </tr>
              ) : (
                invoiceList.map((inv: Invoice) => {
                  const patient = typeof inv.patient === 'object' ? inv.patient : {};
                  const raised = billedOn((inv as any).createdAt);
                  return (
                    <tr key={inv._id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-semibold text-foreground">{raised.day}</div>
                        <div className="text-[10px] text-muted-foreground">{raised.time}</div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="font-bold text-blue-600">{inv.invoiceNumber}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Barcode className="h-3 w-3" /> {inv.barcode}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground">{(patient as any).patientName || 'N/A'}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">UHID: {inv.uhid}</div>
                      </td>
                      <td className="p-3 font-mono font-bold text-foreground">₹{inv.netAmount}</td>
                      <td className="p-3 font-mono font-semibold text-emerald-600">₹{inv.paidAmount}</td>
                      <td className="p-3 font-mono font-semibold text-amber-600">₹{inv.dueAmount}</td>
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
