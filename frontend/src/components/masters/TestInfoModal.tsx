import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LabTest, TestParameter } from '../../types';
import { testApi } from '../../api/test.api';
import { asList } from '../../utils/api-list';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { X, FileText, Upload, ClipboardCheck, Download, Trash2, Eye } from 'lucide-react';

export type TestInfoTab = 'interpretation' | 'files' | 'review';

interface TestInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tab: TestInfoTab;
  /** Opens on this test; left out, the test is picked inside the modal. */
  testId?: string;
  /** After the interpretation is saved - lets the test list refresh. */
  onSaved?: () => void;
}

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedBy?: string;
  createdAt?: string;
}

const TABS: { key: TestInfoTab; label: string; icon: React.ElementType }[] = [
  { key: 'interpretation', label: 'Interpretation', icon: FileText },
  { key: 'files', label: 'File Upload', icon: Upload },
  { key: 'review', label: 'Review', icon: ClipboardCheck },
];

/** Matches the backend's list, so a file is refused here rather than after uploading. */
const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.txt,.csv';
const MAX_BYTES = 5 * 1024 * 1024;

const fmtSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const fmtDate = (v?: string) =>
  v ? new Date(v).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

/** Age window in days as the lab reads it - "1Y – 12Y", "0D – no limit". */
const fmtAgeDays = (days?: number) => {
  const d = Number(days) || 0;
  if (d >= 365 && d % 365 === 0) return `${d / 365}Y`;
  if (d >= 30 && d % 30 === 0) return `${d / 30}M`;
  return `${d}D`;
};

const rangeOf = (p: TestParameter) => {
  if (p.minValue || p.maxValue) return `${p.minValue || '—'} – ${p.maxValue || '—'}`;
  if (p.referenceText) return p.referenceText;
  return [p.maleReferenceRange && `M: ${p.maleReferenceRange}`, p.femaleReferenceRange && `F: ${p.femaleReferenceRange}`, p.childReferenceRange && `C: ${p.childReferenceRange}`]
    .filter(Boolean)
    .join(' · ') || '—';
};

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.readAsDataURL(file);
  });

/**
 * Everything that goes with a test beyond its parameter sheet: the
 * interpretation text, reference files, and a read-only review of the whole
 * setup before it is used at the bench.
 */
export const TestInfoModal: React.FC<TestInfoModalProps> = ({ isOpen, onClose, tab: initialTab, testId, onSaved }) => {
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<TestInfoTab>(initialTab);
  const [tests, setTests] = useState<LabTest[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [activeId, setActiveId] = useState('');
  const [search, setSearch] = useState('');

  const [interpretation, setInterpretation] = useState('');
  const [savedInterpretation, setSavedInterpretation] = useState('');
  const [saving, setSaving] = useState(false);

  const [files, setFiles] = useState<Attachment[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTab(initialTab);
    setActiveId(testId || '');
    setSearch('');
    setLoadingTests(true);
    testApi
      .getAll({ page: 1, limit: 2000 })
      .then((res) => setTests(asList<LabTest>(res, 'tests')))
      .catch(() => showToast('Failed to load the test list', 'error'))
      .finally(() => setLoadingTests(false));
  }, [isOpen, initialTab, testId]);

  const test = useMemo(() => tests.find((t) => t.id === activeId) || null, [tests, activeId]);

  // A different test starts from what that test has saved.
  useEffect(() => {
    const text = test?.interpretation || '';
    setInterpretation(text);
    setSavedInterpretation(text);
  }, [test?.id]);

  useEffect(() => {
    if (!isOpen || !activeId) {
      setFiles([]);
      return;
    }
    setLoadingFiles(true);
    testApi
      .listAttachments(activeId)
      .then((res) => setFiles(asList<Attachment>(res)))
      .catch(() => setFiles([]))
      .finally(() => setLoadingFiles(false));
  }, [isOpen, activeId]);

  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tests;
    return tests.filter((t) => t.testName.toLowerCase().includes(q) || t.testCode.toLowerCase().includes(q));
  }, [tests, search]);

  if (!isOpen) return null;

  const dirty = interpretation !== savedInterpretation;

  const saveInterpretation = async () => {
    if (!test) return;
    setSaving(true);
    try {
      await testApi.update(test.id, { interpretation });
      setSavedInterpretation(interpretation);
      setTests((prev) => prev.map((t) => (t.id === test.id ? { ...t, interpretation } : t)));
      showToast(`Interpretation saved for ${test.testName}`, 'success');
      onSaved?.();
    } catch (err: any) {
      showToast(err?.message || 'Could not save the interpretation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const upload = async (list: FileList | null) => {
    if (!test || !list?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(list)) {
        if (file.size > MAX_BYTES) {
          showToast(`${file.name} is over 5 MB`, 'error');
          continue;
        }
        const data = await readAsBase64(file);
        const saved: Attachment = await testApi.uploadAttachment(test.id, {
          fileName: file.name,
          mimeType: file.type,
          data,
        });
        setFiles((prev) => [saved, ...prev]);
      }
    } catch (err: any) {
      showToast(err?.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const openFile = async (file: Attachment, download: boolean) => {
    if (!test) return;
    try {
      const blob = await testApi.downloadAttachment(test.id, file.id);
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = url;
        a.download = file.fileName;
        a.click();
      } else {
        window.open(url, '_blank', 'noopener');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      showToast('Could not open the file', 'error');
    }
  };

  const removeFile = async (file: Attachment) => {
    if (!test || !window.confirm(`Remove ${file.fileName}?`)) return;
    try {
      await testApi.removeAttachment(test.id, file.id);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      showToast(`${file.fileName} removed`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not remove the file', 'error');
    }
  };

  const switchTest = (id: string) => {
    if (dirty && !window.confirm('The interpretation has unsaved changes. Discard them?')) return;
    setActiveId(id);
  };

  const parameters = [...(test?.parameters || [])].sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex gap-1">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  tab === key ? 'bg-blue-600 text-white' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              if (dirty && !window.confirm('The interpretation has unsaved changes. Discard them?')) return;
              onClose();
            }}
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 border-b px-5 py-3 text-xs">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search test name or code"
            className="h-9 rounded-xl border bg-background px-3 outline-none focus:border-blue-500"
          />
          <select
            value={activeId}
            onChange={(e) => switchTest(e.target.value)}
            className="h-9 rounded-xl border bg-background px-3"
          >
            <option value="">{loadingTests ? 'Loading tests…' : '- Select test -'}</option>
            {filteredTests.map((t) => (
              <option key={t.id} value={t.id}>
                {t.testName} ({t.testCode})
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 text-xs">
          {!test ? (
            <p className="py-10 text-center text-muted-foreground">Pick a test to continue.</p>
          ) : tab === 'interpretation' ? (
            <div className="space-y-2">
              <label className="block font-semibold">Interpretation for {test.testName}</label>
              <textarea
                value={interpretation}
                onChange={(e) => setInterpretation(e.target.value)}
                rows={14}
                maxLength={20000}
                placeholder="What the result means clinically, notes on ranges, causes of high / low values…"
                className="w-full rounded-xl border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-blue-500"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {interpretation.length.toLocaleString()} / 20,000 characters
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!dirty || saving}
                    onClick={() => setInterpretation(savedInterpretation)}
                  >
                    Reset
                  </Button>
                  <Button size="sm" disabled={!dirty || saving} onClick={saveInterpretation}>
                    {saving ? 'Saving…' : 'Save Interpretation'}
                  </Button>
                </div>
              </div>
            </div>
          ) : tab === 'files' ? (
            <div className="space-y-3">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  upload(e.dataTransfer.files);
                }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-6 text-center"
              >
                <Upload className="h-6 w-6 text-blue-600" />
                <p className="font-semibold">Drop files here or</p>
                <Button size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {uploading ? 'Uploading…' : 'Choose Files'}
                </Button>
                <p className="text-[11px] text-muted-foreground">PDF, image, Word, Excel, TXT or CSV · up to 5 MB each</p>
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => upload(e.target.files)}
                />
              </div>

              {loadingFiles ? (
                <p className="py-4 text-center text-muted-foreground">Loading files…</p>
              ) : files.length === 0 ? (
                <p className="py-4 text-center text-muted-foreground">No files attached to {test.testName} yet.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {files.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{f.fileName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtSize(f.size)} · {fmtDate(f.createdAt)}
                          {f.uploadedBy ? ` · ${f.uploadedBy}` : ''}
                        </p>
                      </div>
                      <button onClick={() => openFile(f, false)} className="rounded p-1 hover:bg-accent" title="View">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => openFile(f, true)} className="rounded p-1 hover:bg-accent" title="Download">
                        <Download className="h-4 w-4" />
                      </button>
                      <button onClick={() => removeFile(f)} className="rounded p-1 text-red-500 hover:bg-red-50" title="Remove">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <section className="grid grid-cols-2 gap-x-6 gap-y-1.5 rounded-xl border p-3 sm:grid-cols-3">
                {[
                  ['Test', `${test.testName} (${test.testCode})`],
                  ['Department', typeof test.department === 'object' ? test.department?.departmentName : '—'],
                  ['Sample', `${test.sampleType || '—'} · ${test.sampleContainer || '—'}`],
                  ['Rate', `₹${test.rate ?? 0}`],
                  ['TAT', test.turnaroundTime || '—'],
                  ['Processing', test.processingMode === 'Outsource' ? `Outsource${test.outsourceLab ? ` · ${test.outsourceLab}` : ''}` : 'In-house'],
                  ['TPA', test.tpa && typeof test.tpa === 'object' ? test.tpa.organizationName : 'Own catalogue'],
                  ['Fasting', test.fastingRequired ? 'Required' : 'Not required'],
                  ['Status', test.status],
                ].map(([k, v]) => (
                  <div key={k}>
                    <span className="text-[11px] text-muted-foreground">{k}</span>
                    <p className="font-semibold">{v}</p>
                  </div>
                ))}
              </section>

              <section>
                <h3 className="mb-1.5 font-bold">Parameters ({parameters.filter((p) => p.resultType !== 'Header').length})</h3>
                {parameters.length === 0 ? (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                    No parameters - result entry will open on an empty sheet.
                  </p>
                ) : (
                  <table className="w-full border-collapse overflow-hidden rounded-xl border text-left">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="p-2">Parameter</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Unit</th>
                        <th className="p-2">For / Age</th>
                        <th className="p-2">Normal Range</th>
                        <th className="p-2">Method</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parameters.map((p, i) =>
                        p.resultType === 'Header' ? (
                          <tr key={i} className="bg-slate-50">
                            <td colSpan={6} className="p-2 font-bold uppercase">
                              {p.parameterName}
                            </td>
                          </tr>
                        ) : (
                          <tr key={i}>
                            <td className="p-2 font-semibold">{p.parameterName}</td>
                            <td className="p-2">{p.resultType}</td>
                            <td className="p-2">{p.unit || '—'}</td>
                            <td className="p-2">
                              {p.paraFor || 'ALL'} · {fmtAgeDays(p.ageFromDays)} – {p.ageToDays ? fmtAgeDays(p.ageToDays) : 'no limit'}
                            </td>
                            <td className="p-2">{rangeOf(p)}</td>
                            <td className="p-2">{p.method || '—'}</td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                )}
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="font-bold">Interpretation</h3>
                  <button className="text-[11px] font-semibold text-blue-600 hover:underline" onClick={() => setTab('interpretation')}>
                    Edit
                  </button>
                </div>
                {savedInterpretation ? (
                  <p className="whitespace-pre-wrap rounded-xl border p-3 leading-relaxed">{savedInterpretation}</p>
                ) : (
                  <p className="text-muted-foreground">No interpretation added.</p>
                )}
              </section>

              <section>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="font-bold">Files ({files.length})</h3>
                  <button className="text-[11px] font-semibold text-blue-600 hover:underline" onClick={() => setTab('files')}>
                    Manage
                  </button>
                </div>
                {files.length === 0 ? (
                  <p className="text-muted-foreground">No files attached.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {files.map((f) => (
                      <button key={f.id} onClick={() => openFile(f, false)} title="View">
                        <Badge variant="secondary" className="gap-1">
                          <FileText className="h-3 w-3" />
                          {f.fileName}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
