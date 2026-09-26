import React, { useEffect, useRef, useState } from 'react';
import { renderAsync } from 'docx-preview';
import { resultApi, readBlobError } from '../../api/result.api';
import { Button } from '../ui/button';
import { AlertTriangle, Download, Printer } from 'lucide-react';

interface WordReportPreviewProps {
  resultId: string;
  testName: string;
  fileName?: string;
}

const RENDER_OPTIONS = {
  inWrapper: true,
  hideWrapperOnPrint: true,
  ignoreLastRenderedPageBreak: true,
  useBase64URL: true,
};

/**
 * A test printed from the lab's own Word format: the server fills the .docx
 * with this patient's details and results, and it is drawn here page for page
 * as Word would show it. Printing opens it alone in a window of its own, so the
 * sheet that comes off the printer is the Word layout and nothing else.
 */
export const WordReportPreview: React.FC<WordReportPreviewProps> = ({ resultId, testName, fileName }) => {
  const container = useRef<HTMLDivElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    resultApi
      .downloadDocx(resultId)
      .then(async (file) => {
        if (cancelled) return;
        setBlob(file);
        if (container.current) {
          container.current.innerHTML = '';
          await renderAsync(file, container.current, undefined, RENDER_OPTIONS);
        }
      })
      .catch(async (err) => !cancelled && setError(await readBlobError(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [resultId]);

  const download = () => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `${testName.replace(/[^\w.-]+/g, '_')}_Report.docx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const print = async () => {
    if (!blob) return;
    // Opened inside the click so a pop-up blocker lets it through.
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(
      `<!doctype html><html><head><title>${testName} Report</title>` +
        '<style>@page{margin:0}body{margin:0}@media print{section.docx{margin:0!important;box-shadow:none!important}}</style>' +
        '</head><body></body></html>'
    );
    win.document.close();
    await renderAsync(blob, win.document.body, win.document.head, RENDER_OPTIONS);
    // Fonts and images settle before the print dialog takes its snapshot.
    setTimeout(() => {
      win.focus();
      win.print();
    }, 400);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold uppercase tracking-wide text-foreground">
          {testName}
          <span className="ml-2 text-[11px] font-normal normal-case text-muted-foreground">Printed in its Word format</span>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!blob} onClick={print}>
            <Printer className="mr-1 h-4 w-4" /> Print
          </Button>
          <Button size="sm" disabled={!blob} onClick={download} className="bg-blue-600 hover:bg-blue-700">
            <Download className="mr-1 h-4 w-4" /> Download Word
          </Button>
        </div>
      </div>

      {loading && <p className="py-6 text-center text-xs text-muted-foreground">Filling in the report…</p>}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <div ref={container} className="overflow-x-auto rounded-xl border" hidden={!!error} />
    </div>
  );
};
