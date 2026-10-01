import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { savedReportApi, openSavedReport, downloadSavedReport } from '../../api/result.api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { DATE_PRESETS, formatDay, todayKey } from '../../utils/dates';
import { FolderArchive, Search, Eye, Download, ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';

interface SavedReport {
  _id: string;
  result: string;
  patientName: string;
  uhid: string;
  mobile?: string;
  invoiceNumber?: string;
  enquiryNo?: string;
  reportNo: string;
  status?: 'Provisional' | 'Final';
  tests: string[];
  fileName: string;
  size: number;
  savedBy?: { name?: string; role?: string };
  createdAt: string;
}

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

/**
 * Every report PDF that was saved, newest first. The file here is the one
 * handed over at the time, so a patient asking for their report again gets
 * the same copy rather than a fresh one.
 */
export const SavedReportsPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchTerm.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const { data, isLoading } = useQuery({
    queryKey: ['saved-reports', search, from, to, page],
    queryFn: () =>
      savedReportApi.list({
        search: search || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 20,
      }),
    placeholderData: (prev: any) => prev,
  });

  const reports = asList<SavedReport>(data, 'reports');
  const meta = data?.meta || data?.pagination || {};
  const totalPages = meta.totalPages || 1;

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await action();
    } catch (err: any) {
      showToast(err?.message || 'Could not open the report', 'error');
    } finally {
      setBusy('');
    }
  };

  const activePreset = DATE_PRESETS.find((preset) => {
    const range = preset.range();
    return range.from === from && range.to === to;
  })?.label;

  const applyRange = (next: { from: string; to: string }) => {
    setFrom(next.from);
    setTo(next.to);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl [&>svg]:shrink-0">
          <FolderArchive className="h-6 w-6 text-blue-600" />
          <span>Saved Reports</span>
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Every report saved as PDF, with who saved it and when. View or download the same copy again.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patient, UHID, mobile, report #, invoice #, test..."
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
            <Input
              type="date"
              value={from}
              max={to || todayKey()}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => applyRange({ from: e.target.value, to })}
              className="h-9 text-xs"
              wrapperClassName="min-w-0 flex-1 sm:w-[9.5rem] sm:flex-none"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => applyRange({ from, to: e.target.value })}
              className="h-9 text-xs"
              wrapperClassName="min-w-0 flex-1 sm:w-[9.5rem] sm:flex-none"
            />
            {(from || to || searchTerm) && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1"
                onClick={() => {
                  setSearchTerm('');
                  applyRange({ from: '', to: '' });
                }}
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => applyRange(preset.range())}
              className={`rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                activePreset === preset.label
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground">{meta.total ?? 0} saved</span>
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Saved On</th>
                <th className="p-3">Patient</th>
                <th className="p-3">Report # / Invoice #</th>
                <th className="p-3">Tests</th>
                <th className="p-3">Saved By</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading saved reports...
                  </td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {search || from || to
                      ? 'No saved reports match this filter.'
                      : 'No reports saved yet. Saving results files a provisional report here; "Save PDF" on a final report files the final one.'}
                  </td>
                </tr>
              ) : (
                reports.map((r) => {
                  const saved = new Date(r.createdAt);
                  return (
                    <tr key={r._id} className="hover:bg-muted/30">
                      <td className="whitespace-nowrap p-3">
                        <div className="font-semibold text-foreground">{formatDay(saved)}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {saved.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-foreground">{r.patientName || 'N/A'}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          UHID: {r.uhid}
                          {r.mobile ? ` · ${r.mobile}` : ''}
                        </div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-blue-600">{r.reportNo}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 font-sans text-[10px] font-semibold ${
                              r.status === 'Provisional' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {r.status === 'Provisional' ? 'Provisional' : 'Final'}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {r.invoiceNumber}
                          {r.enquiryNo ? ` · ${r.enquiryNo}` : ''}
                        </div>
                      </td>
                      <td className="max-w-[18rem] p-3">
                        <div className="text-foreground">{r.tests.join(', ') || '-'}</div>
                        <div className="text-[11px] text-muted-foreground">{fileSize(r.size)}</div>
                      </td>
                      <td className="p-3">
                        <div className="text-foreground">{r.savedBy?.name || '-'}</div>
                        <div className="text-[11px] text-muted-foreground">{r.savedBy?.role}</div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!!busy}
                            isLoading={busy === `view-${r._id}`}
                            onClick={() => run(`view-${r._id}`, () => openSavedReport(r._id))}
                          >
                            <Eye className="mr-1 h-4 w-4" /> View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            title="Download PDF"
                            disabled={!!busy}
                            isLoading={busy === `dl-${r._id}`}
                            onClick={() => run(`dl-${r._id}`, () => downloadSavedReport(r._id, r.fileName))}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-4 text-xs">
            <div className="text-muted-foreground">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
