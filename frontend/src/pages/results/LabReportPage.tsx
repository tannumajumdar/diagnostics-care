import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { asList } from '../../utils/api-list';
import { resultApi } from '../../api/result.api';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { ArrowLeft, Printer, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { resultMarker } from '../../utils/result-flag';
import { CENTRE, contactLine } from '../../config/centre';

const dateTime = (value?: string | Date) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

const dateOnly = (value?: string | Date) =>
  value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '-';

/** A labelled line in one of the header blocks. Blank values print as a dash. */
const Line: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex gap-2">
    <span className="w-28 shrink-0 font-semibold text-muted-foreground">{label}</span>
    <span className="min-w-0 break-words font-medium text-foreground">{value || '-'}</span>
  </div>
);

/**
 * The patient's report.
 *
 * A patient who had three tests run on one visit is handed **one** report, not
 * three sheets stapled together: the letterhead and their details are printed
 * once, and each test follows as its own section with the parameters it was
 * billed for. Opening any one of the visit's results lands here and shows the
 * whole set.
 */
export const LabReportPage: React.FC = () => {
  // The route is /results/report/:resultId - reading `id` here left the query
  // disabled and the page rendered "Report not found" for every result.
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();

  const { data: opened, isLoading, isError, error } = useQuery({
    queryKey: ['lab-report', resultId],
    queryFn: () => resultApi.getById(resultId!),
    enabled: !!resultId,
  });

  // The sample the opened result belongs to is what ties the visit together.
  const openedSampleId =
    typeof (opened as any)?.sample === 'object' ? (opened as any).sample?._id : (opened as any)?.sample;

  const { data: visitData, isLoading: loadingVisit } = useQuery({
    queryKey: ['lab-report-visit', openedSampleId],
    queryFn: () => resultApi.getVisitBySampleId(String(openedSampleId)),
    enabled: !!openedSampleId,
  });

  if (isLoading || loadingVisit)
    return <div className="p-8 text-center text-muted-foreground">Generating diagnostic report...</div>;

  if (isError || !opened) {
    return (
      <div className="mx-auto max-w-lg p-8 text-center">
        <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-amber-600" />
        <p className="font-semibold text-foreground">This report could not be loaded.</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {(error as any)?.message || 'The result record was not found.'}
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/results')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Back to results
        </Button>
      </div>
    );
  }

  // Every test on the visit, with the opened one guaranteed to be in it even if
  // the visit lookup could not run.
  const visitSheets = asList<any>(visitData, 'results');
  const sheets = visitSheets.length ? visitSheets : [opened];

  // A test nobody has typed a value into is not part of the patient's report -
  // it is work still sitting on the bench.
  const parametersOf = (sheet: any) =>
    asList<any>(sheet?.results)
      .slice()
      .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));

  const hasValues = (sheet: any) =>
    parametersOf(sheet).some((p: any) => String(p.value ?? '').trim() !== '');

  const reportable = sheets.filter((sheet) => hasValues(sheet) || sheet._id === opened._id);
  const pending = sheets.filter((sheet) => !hasValues(sheet) && sheet._id !== opened._id);

  const primary: any = reportable[0] || opened;
  const patient: any = typeof primary.patient === 'object' ? primary.patient : {};
  const invoice: any = typeof primary.invoice === 'object' ? primary.invoice : {};

  // Who asked for the tests, not just who ran them - the panel doctor's own
  // record where the bill was linked to one, otherwise the name taken at the desk.
  const referredBy =
    (typeof invoice?.referringDoctor === 'object' ? invoice?.referringDoctor?.doctorName : '') ||
    invoice?.referringDoctorName ||
    'Self / Walk-in';

  const address = [patient.address, patient.city, patient.state, patient.pinCode].filter(Boolean).join(', ');

  // Both letterhead lines drop out when the centre has not been configured,
  // rather than printing an empty separator or a placeholder number.
  const subtitle = [CENTRE.accreditation, CENTRE.address].filter(Boolean).join(' | ');
  const reportContact = contactLine([
    ['Phone', CENTRE.reportingEnquiryNumbers || CENTRE.phones || CENTRE.mobiles],
    ['Email', CENTRE.email],
  ]);

  const allCritical = reportable.flatMap((sheet) =>
    parametersOf(sheet).filter((p: any) => p.flag === 'Critical')
  );
  const unreleased = reportable.filter((s) => s.status !== 'Approved' && s.status !== 'Final');

  // One pathologist for the whole visit is the usual case; where two signed
  // different tests, the sections carry their own line instead.
  const verifiers = Array.from(
    new Set(reportable.map((s) => s.verifiedBy?.name).filter(Boolean) as string[])
  );

  const handleDownloadPDF = () => window.open(resultApi.getPDFUrl(primary._id), '_blank');

  return (
    <div className="mx-auto max-w-4xl space-y-6 py-4 print:max-w-none print:py-0">
      <div className="flex items-center justify-between" data-print="hide">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/results')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-blue-600">Official Diagnostic Lab Report</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {reportable.length} test{reportable.length === 1 ? '' : 's'} on this visit
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print Report
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700">
            <Download className="mr-1 h-4 w-4" /> Download PDF
          </Button>
        </div>
      </div>

      {unreleased.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
          data-print="hide"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {unreleased.length} of these test{unreleased.length === 1 ? '' : 's'} (
            {unreleased.map((s) => (typeof s.test === 'object' ? s.test?.testName : 'test')).join(', ')}) has not
            been released by the pathologist yet. Do not hand this copy to the patient.
          </span>
        </div>
      )}

      {pending.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"
          data-print="hide"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Also billed on this visit, still with no values entered:{' '}
            {pending.map((s) => (typeof s.test === 'object' ? s.test?.testName : 'test')).join(', ')}. They are
            left off the report until the bench fills them in.
          </span>
        </div>
      )}

      <Card className="report-sheet space-y-5 border-2 bg-card p-6 print:border-0 print:p-0 print:shadow-none">
        {/* Letterhead. Read from the same centre profile the bill prints, so
            the report a patient carries home names the centre that ran the
            test - not a placeholder, and not a different name to their bill. */}
        <div className="space-y-1 border-b pb-4 text-center">
          <h2 className="text-xl font-bold text-blue-600">{CENTRE.name}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {reportContact && <p className="font-mono text-xs text-muted-foreground">{reportContact}</p>}
        </div>

        {/* Printed once for the whole visit: who it is for, who asked for it,
            and which bill it came off. Anything that belongs to one draw sits
            with its own test below. */}
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 rounded-xl bg-muted/20 p-4 text-xs md:grid-cols-2 print:grid-cols-2">
          <Line label="Patient Name" value={<span className="text-sm font-bold">{patient.patientName}</span>} />
          <Line label="Report No." value={<span className="font-mono">{primary.resultId}</span>} />

          {/* The two numbers a patient is asked for at the counter, side by
              side: the UHID is the person and never changes, the enquiry
              number is this one visit. A returning patient has one of the
              first and one of the second per visit. */}
          <Line label="UHID" value={<span className="font-mono">{primary.uhid}</span>} />
          <Line
            label="Enquiry No."
            value={<span className="font-mono">{primary.enquiryNo || invoice.enquiryNo || '-'}</span>}
          />

          <Line label="Age / Gender" value={`${patient.age ?? '-'} Yrs / ${patient.gender || '-'}`} />
          <Line label="Invoice No." value={<span className="font-mono">{invoice.invoiceNumber}</span>} />

          <Line label="Mobile" value={patient.mobile} />
          <Line label="Registered On" value={dateTime(invoice.createdAt || primary.createdAt)} />

          <Line label="Referred By" value={referredBy} />
          <Line label="Reported On" value={dateTime(primary.updatedAt || primary.createdAt)} />

          <Line
            label="Organization"
            value={typeof invoice.organization === 'object' ? invoice.organization?.organizationName : ''}
          />
          <Line label="Tests on report" value={String(reportable.length)} />

          <Line label="Address" value={address} />
          <Line
            label="Tests"
            value={reportable
              .map((s) => (typeof s.test === 'object' ? s.test?.testName : ''))
              .filter(Boolean)
              .join(', ')}
          />
        </div>

        {invoice.clinicalNotes && (
          <div className="rounded-xl border bg-muted/10 p-3 text-xs">
            <p className="font-semibold uppercase text-muted-foreground">Notes from the desk</p>
            <p className="mt-0.5 text-foreground">{invoice.clinicalNotes}</p>
          </div>
        )}

        {/* One section per test, in the order they were billed. */}
        {reportable.map((sheet: any) => {
          const test: any = typeof sheet.test === 'object' ? sheet.test : {};
          const sample: any = typeof sheet.sample === 'object' ? sheet.sample : {};
          const department: any = typeof sheet.department === 'object' ? sheet.department : {};
          const parameters = parametersOf(sheet);
          const abnormal = parameters.filter((p: any) => p.flag && p.flag !== 'Normal');
          const noValuesEntered = parameters.length > 0 && !hasValues(sheet);

          return (
            <div key={sheet._id} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-y bg-muted/30 px-3 py-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
                    {test?.testName || 'Diagnostic Test'}
                    {test?.testCode && (
                      <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">
                        ({test.testCode})
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-mono">{sample.sampleId}</span>
                    {sample.barcode && <span className="ml-2 font-mono">{sample.barcode}</span>}
                    {department.departmentName && <span className="ml-2">{department.departmentName}</span>}
                    {(test.sampleType || sample.sampleType) && (
                      <span className="ml-2">{test.sampleType || sample.sampleType}</span>
                    )}
                    {sample.collectionDate && (
                      <span className="ml-2">Collected {dateTime(sample.collectionDate)}</span>
                    )}
                  </p>
                  {sample.priority === 'Urgent' && (
                    <span className="text-[11px] font-semibold text-rose-600">Marked URGENT</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {parameters.length} parameter{parameters.length === 1 ? '' : 's'}
                  {abnormal.length > 0 && (
                    <span className="ml-1 font-semibold text-rose-600">· {abnormal.length} outside range</span>
                  )}
                  {sheet.status !== 'Approved' && sheet.status !== 'Final' && (
                    <span className="ml-1 font-semibold text-amber-700">· {sheet.status}</span>
                  )}
                </p>
              </div>

              {noValuesEntered && (
                <div
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                  data-print="hide"
                >
                  <span className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    No values have been entered for this test yet, so it has nothing to show.
                  </span>
                  {sample?._id && (
                    <Button variant="outline" size="sm" onClick={() => navigate(`/results/entry/${sample._id}`)}>
                      Enter results
                    </Button>
                  )}
                </div>
              )}

              {parameters.length === 0 ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    This test has no parameters configured, so there is nothing to report. Add them under Masters
                    &rsaquo; Tests &rsaquo; Parameters and re-open this report.
                  </span>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="border-b bg-muted/50 font-semibold">
                      <tr>
                        <th className="p-3">Test Parameter</th>
                        <th className="p-3">Result</th>
                        <th className="p-3">Unit</th>
                        <th className="p-3">Biological Ref. Range</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parameters.map((p: any, idx: number) => {
                        const isAbnormal = p.flag && p.flag !== 'Normal';
                        // The report marks an out-of-range value with an H or an
                        // L against the figure itself, the way a printed report
                        // always has - a column spelling out "High" is a word the
                        // eye has to travel for. The method belongs with the name
                        // of the parameter it was measured by.
                        const marker = resultMarker(p);
                        return (
                          <tr key={idx} className={isAbnormal ? 'bg-rose-50/50' : undefined}>
                            <td className="p-3">
                              <span className="font-bold">{p.parameterName}</span>
                              {p.shortName && (
                                <span className="ml-1 text-muted-foreground">({p.shortName})</span>
                              )}
                              {p.method && (
                                <span className="mt-0.5 block text-[10px] text-muted-foreground">{p.method}</span>
                              )}
                            </td>
                            <td className={`p-3 font-mono font-bold ${isAbnormal ? 'text-rose-600' : ''}`}>
                              {p.value || '-'}
                              {marker && (
                                <span
                                  title={marker.title}
                                  className={`ml-1.5 align-top text-[10px] font-bold ${
                                    marker.critical ? 'text-rose-700' : 'text-rose-600'
                                  }`}
                                >
                                  {marker.text}
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-muted-foreground">{p.unit || '-'}</td>
                            <td className="p-3 font-mono text-muted-foreground">{p.referenceRange || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* With the word out of the table the letter has to be explained,
                  and only on a report that actually carries one. */}
              {parameters.some((p: any) => p.flag && p.flag !== 'Normal') && (
                <p className="text-[10px] text-muted-foreground">
                  H = above the biological reference range · L = below it · * = critical value
                </p>
              )}

              {sheet.overallRemarks && (
                <div className="rounded-xl border bg-muted/20 p-3 text-xs">
                  <p className="font-semibold uppercase text-muted-foreground">
                    Remarks · {test?.testName || 'this test'}
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-foreground">{sheet.overallRemarks}</p>
                </div>
              )}

              {verifiers.length > 1 && sheet.verifiedBy?.name && (
                <p className="text-[11px] text-muted-foreground">
                  Verified by {sheet.verifiedBy.name} · {dateTime(sheet.verifiedBy.date)}
                </p>
              )}
            </div>
          );
        })}

        {allCritical.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>Critical value{allCritical.length === 1 ? '' : 's'}:</strong>{' '}
              {allCritical.map((p: any) => `${p.parameterName} ${p.value} ${p.unit || ''}`.trim()).join(', ')}. The
              referring doctor should be informed without waiting for the printed copy.
            </span>
          </div>
        )}

        {/* Signature block - once for the whole report */}
        <div className="flex items-end justify-between gap-4 border-t pt-6 text-xs">
          <div className="space-y-0.5">
            <p className="font-semibold text-foreground">{primary.enteredBy?.name || 'Technician'}</p>
            <p className="text-[10px] text-muted-foreground">
              {primary.enteredBy?.role || 'Lab Technician'} · Entered{' '}
              {dateOnly(primary.enteredBy?.date || primary.createdAt)}
            </p>
            <p className="pt-3 text-[10px] text-muted-foreground">End of Diagnostic Report</p>
            <p className="text-[10px] text-muted-foreground">
              Results relate only to the samples tested. Not valid for medico-legal purposes.
            </p>
          </div>

          <div className="text-right">
            {verifiers.length === 1 ? (
              <>
                <CheckCircle2 className="mb-1 ml-auto h-6 w-6 text-emerald-600" />
                <p className="font-bold text-foreground">{verifiers[0]}</p>
                <p className="text-[10px] text-muted-foreground">Consultant Pathologist</p>
                <p className="text-[10px] text-muted-foreground">
                  Verified {dateTime(reportable.find((s) => s.verifiedBy?.name)?.verifiedBy?.date)}
                </p>
              </>
            ) : verifiers.length > 1 ? (
              <>
                <CheckCircle2 className="mb-1 ml-auto h-6 w-6 text-emerald-600" />
                <p className="font-bold text-foreground">{verifiers.join(', ')}</p>
                <p className="text-[10px] text-muted-foreground">
                  Consultant Pathologists · signed per test above
                </p>
              </>
            ) : (
              <p className="font-semibold text-amber-700">Pending pathologist verification</p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};
