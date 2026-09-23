import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { billingApi } from '../../api/billing.api';
import { MONEY_QUERY_KEYS } from '../../utils/query-options';
import { useToast } from '../../context/ToastContext';
import { Input } from '../../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { BillPrint } from '../../components/billing/BillPrint';
import { DoctorBillPrint } from '../../components/billing/DoctorBillPrint';
import { PaymentGatewayModal } from '../../components/billing/PaymentGatewayModal';
import {
  SplitPaymentEditor,
  splitSeed,
  tenderPayload,
  tenderTotal,
  type Tender,
} from '../../components/billing/SplitPaymentEditor';
import {
  ArrowLeft,
  Printer,
  IndianRupee,
  X,
  Stethoscope,
  Truck,
  Package,
  Smartphone,
  Split,
  Wallet,
  ReceiptText,
} from 'lucide-react';
import { COLLECTION_METHODS, methodIcon, methodLabel } from '../../config/payment-methods';

/** The methods that go through a machine rather than across the counter. */
const GATEWAY_METHODS = ['UPI', 'Card'];

const money = (value: unknown) => `₹${(Number(value) || 0).toLocaleString('en-IN')}`;

export const InvoiceDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [payOpen, setPayOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  /**
   * Whether the desk is entering one method or several. A patient paying the
   * balance half in cash and half by UPI is two receipts against this bill,
   * so the dialog switches from one amount to a list of tenders.
   */
  const [splitting, setSplitting] = useState(false);
  const [tenders, setTenders] = useState<Tender[]>([]);
  /**
   * Which sheet is on the preview - and therefore which one Print sends to
   * the printer. Only one is ever in the DOM, so the doctor's copy can never
   * come out stapled to the patient's by accident.
   */
  const [sheet, setSheet] = useState<'patient' | 'doctor'>('patient');

  const { data, isLoading } = useQuery({
    queryKey: ['invoice-details', id],
    queryFn: () => billingApi.getInvoiceById(id!),
    enabled: !!id,
  });

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading invoice details...</div>;
  if (!data?.invoice) return <div className="p-8 text-center text-muted-foreground font-semibold">Invoice record not found.</div>;

  const { invoice, samples = [], payments = [] } = data;
  const patient = typeof invoice.patient === 'object' ? invoice.patient : {};
  const due = Number(invoice.dueAmount ?? 0);

  /**
   * What came in by each method. Added up from the receipts rather than read
   * off the bill's own summary, so bills raised before the summary existed
   * still show their split, and the figure on screen can never disagree with
   * the receipts printed underneath it.
   */
  const breakdown = (() => {
    const totals = new Map<string, number>();
    for (const payment of payments as any[]) {
      const method = payment?.paymentMethod;
      if (!method) continue;
      totals.set(method, (totals.get(method) || 0) + (Number(payment.amount) || 0));
    }
    if (!totals.size) return (invoice.paymentBreakdown as any[]) || [];
    return [...totals.entries()].map(([method, amount]) => ({ method, amount }));
  })();

  const items: any[] = Array.isArray(invoice.items) ? invoice.items : [];
  const doctorName =
    invoice.referringDoctorName ||
    (typeof invoice.referringDoctor === 'object' ? invoice.referringDoctor?.doctorName : '') ||
    '';
  const hasReferral = Boolean(doctorName);

  // Older bills were raised before the doctor's copy existed, so their total
  // is added up from the lines rather than printed as a zero.
  const referralTotal =
    Number(invoice.referralTotal) ||
    items.reduce((sum, item) => sum + (Number(item.referralRate) || Number(item.rate) || 0), 0);
  const referralMargin = referralTotal - Number(invoice.netAmount ?? 0);

  const outsourced = items.filter((item) => item.processingMode === 'Outsource');
  const packagesOnBill = [
    ...new Set(items.filter((item) => item.packageName).map((item) => item.packageName as string)),
  ];

  /** Opens the dialog on the full due, which is what is usually collected. */
  const openPayDialog = () => {
    setSplitting(false);
    setPayAmount('');
    setTenders([{ method: 'Cash', amount: due }]);
    setPayOpen(true);
  };

  const recordPayment = async () => {
    // One method or several - the amount collected is read from whichever
    // the desk is on, so a stale figure in the hidden half cannot be posted.
    const splits = splitting ? tenderPayload(tenders) : [];
    const amount = splitting ? tenderTotal(tenders) : Number(payAmount);

    if (splitting && !splits.length) return showToast('Enter at least one payment line', 'error');
    if (!amount || amount <= 0) return showToast('Enter an amount greater than 0', 'error');
    if (amount > due) return showToast(`Amount cannot exceed the due of INR ${due}`, 'error');

    setPaying(true);
    try {
      await billingApi.addPayment(
        invoice.id,
        splitting ? { paymentSplits: splits } : { amount, paymentMethod: payMethod }
      );
      showToast(
        splits.length > 1
          ? `${money(amount)} recorded across ${splits.length} methods`
          : 'Payment recorded',
        'success'
      );
      setPayOpen(false);
      setPayAmount('');
      setSplitting(false);
      // The receipt lands in today's collection, so the directory and the
      // dashboard have to be re-read rather than served from cache.
      MONEY_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
    } catch (err: any) {
      showToast(err?.message || 'Could not record payment', 'error');
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4 print:max-w-none print:py-0">
      <div className="flex items-center justify-between" data-print="hide">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/billing')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-mono text-blue-600">{invoice.invoiceNumber}</h1>
            <p className="text-xs text-muted-foreground font-mono">Barcode: {invoice.barcode}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {due > 0 && (
            <>
              <Button size="sm" onClick={() => setGatewayOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                <Smartphone className="mr-1 h-4 w-4" /> Collect by UPI / Card
              </Button>
              {/* Cash, cheque and bank transfers settle outside any machine,
                  so they are still written straight down. */}
              <Button size="sm" variant="outline" onClick={openPayDialog}>
                <IndianRupee className="mr-1 h-4 w-4" /> Record Payment
              </Button>
            </>
          )}
          {/* The doctor's copy is a different sheet at different rates, so it
              is picked before printing rather than printed alongside. */}
          {hasReferral && (
            <div className="flex overflow-hidden rounded-lg border text-xs">
              <button
                type="button"
                onClick={() => setSheet('patient')}
                className={`px-3 py-1.5 font-semibold transition ${
                  sheet === 'patient' ? 'bg-blue-600 text-white' : 'bg-background hover:bg-muted'
                }`}
              >
                Patient bill
              </button>
              <button
                type="button"
                onClick={() => setSheet('doctor')}
                className={`flex items-center gap-1 px-3 py-1.5 font-semibold transition ${
                  sheet === 'doctor' ? 'bg-violet-600 text-white' : 'bg-background hover:bg-muted'
                }`}
              >
                <Stethoscope className="h-3 w-3" />
                Doctor bill
              </button>
            </div>
          )}

          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            {sheet === 'doctor' ? "Print Doctor's Bill" : 'Print Bill'}
          </Button>
        </div>
      </div>

      <Card data-print="hide">
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground font-semibold uppercase">Patient Information</p>
            <p className="text-sm font-bold text-foreground">{patient.patientName || 'N/A'}</p>
            <p className="font-mono text-muted-foreground">UHID: {invoice.uhid}</p>
          </div>

          <div>
            <p className="text-muted-foreground font-semibold uppercase">Financial Summary</p>
            <p className="font-bold">Net Total: ₹{invoice.netAmount}</p>
            <p className="text-emerald-600 font-semibold">Paid Amount: ₹{invoice.paidAmount}</p>
            <p className="text-amber-600 font-semibold">Due Amount: ₹{invoice.dueAmount}</p>
          </div>

          <div>
            <p className="text-muted-foreground font-semibold uppercase">Status & Date</p>
            <div className="flex flex-wrap items-center gap-1">
              <Badge variant={invoice.paymentStatus === 'Paid' ? 'success' : 'amber'}>{invoice.paymentStatus}</Badge>
              {invoice.priority === 'Urgent' && <Badge variant="destructive">Urgent</Badge>}
            </div>
            <p className="text-muted-foreground mt-2">{new Date(invoice.createdAt).toLocaleString()}</p>
          </div>

          {(invoice.referringDoctorName || invoice.referringDoctor) && (
            <div>
              <p className="text-muted-foreground font-semibold uppercase">Referred By</p>
              <p className="text-sm font-bold text-foreground">
                {invoice.referringDoctorName ||
                  (typeof invoice.referringDoctor === 'object'
                    ? (invoice.referringDoctor as any)?.doctorName
                    : '') ||
                  'Walk-in'}
              </p>
            </div>
          )}

          {invoice.clinicalNotes && (
            <div className="md:col-span-3 border-t pt-3">
              <p className="text-muted-foreground font-semibold uppercase">Notes for the Lab</p>
              <p className="text-sm text-foreground">{invoice.clinicalNotes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* What was charged, line by line, with the total the desk reads out.
          The doctor's column is only shown when there is a doctor to bill. */}
      <Card data-print="hide">
        <CardHeader>
          <CardTitle className="text-base font-bold">Billed Tests ({items.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b bg-muted/50 font-semibold">
                <tr>
                  <th className="p-3">Test</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Processing</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Discount</th>
                  <th className="p-3 text-right">Net</th>
                  {hasReferral && <th className="p-3 text-right">Dr. Rate</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item: any, index: number) => (
                  <tr key={item._id || `${item.testCode}-${index}`}>
                    <td className="p-3">
                      <div className="font-bold">{item.testName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{item.testCode}</div>
                      {item.packageName && (
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-violet-700">
                          <Package className="h-2.5 w-2.5" />
                          {item.packageName}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">{item.departmentName || '-'}</td>
                    <td className="p-3">
                      {item.processingMode === 'Outsource' ? (
                        <>
                          <Badge variant="amber">Outsource</Badge>
                          {item.outsourceLab && (
                            <div className="mt-0.5 text-[11px] text-muted-foreground">
                              {item.outsourceLab}
                            </div>
                          )}
                        </>
                      ) : (
                        <Badge variant="success">In-house</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right font-mono">{money(item.rate)}</td>
                    <td className="p-3 text-right font-mono text-emerald-700">
                      {Number(item.discountAmount) > 0 ? `- ${money(item.discountAmount)}` : money(0)}
                    </td>
                    <td className="p-3 text-right font-mono font-bold">{money(item.netAmount)}</td>
                    {hasReferral && (
                      <td className="p-3 text-right font-mono text-violet-700">
                        {money(Number(item.referralRate) || Number(item.rate) || 0)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>

              <tfoot className="border-t-2 bg-muted/40 font-bold">
                <tr>
                  <td className="p-3" colSpan={3}>
                    Total &mdash; {items.length} test{items.length === 1 ? '' : 's'}
                  </td>
                  <td className="p-3 text-right font-mono">{money(invoice.subtotal)}</td>
                  <td className="p-3 text-right font-mono text-emerald-700">
                    - {money(Number(invoice.subtotal ?? 0) - Number(invoice.netAmount ?? 0))}
                  </td>
                  <td className="p-3 text-right font-mono text-sm text-blue-700">
                    {money(invoice.netAmount)}
                  </td>
                  {hasReferral && (
                    <td className="p-3 text-right font-mono text-violet-700">{money(referralTotal)}</td>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* The referring doctor's side of this bill, read at a glance before
          the copy is printed. */}
      {hasReferral && (
        <Card data-print="hide" className="border-violet-200 bg-violet-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-violet-900">
              <Stethoscope className="h-4 w-4 text-violet-600" />
              Referring Doctor&rsquo;s Bill
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-4">
            <div>
              <p className="font-semibold uppercase text-muted-foreground">Doctor</p>
              <p className="text-sm font-bold text-violet-900">{doctorName}</p>
            </div>
            <div>
              <p className="font-semibold uppercase text-muted-foreground">Doctor&rsquo;s total</p>
              <p className="font-mono text-sm font-bold text-violet-900">{money(referralTotal)}</p>
            </div>
            <div>
              <p className="font-semibold uppercase text-muted-foreground">Patient paid the centre</p>
              <p className="font-mono text-sm font-bold">{money(invoice.netAmount)}</p>
            </div>
            <div>
              <p className="font-semibold uppercase text-muted-foreground">
                {referralMargin >= 0 ? "Doctor's margin" : 'Short of the centre'}
              </p>
              <p
                className={`font-mono text-sm font-bold ${
                  referralMargin >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {money(Math.abs(referralMargin))}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Work that left the building, and the panels this bill was sold as. */}
      {(outsourced.length > 0 || packagesOnBill.length > 0) && (
        <Card data-print="hide">
          <CardContent className="space-y-2 pt-6 text-xs">
            {packagesOnBill.length > 0 && (
              <p className="flex items-start gap-2 text-violet-800">
                <Package className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Billed as {packagesOnBill.length === 1 ? 'package' : 'packages'}:{' '}
                  <strong>{packagesOnBill.join(', ')}</strong>
                </span>
              </p>
            )}
            {outsourced.length > 0 && (
              <p className="flex items-start gap-2 text-amber-800">
                <Truck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  {outsourced.length} test{outsourced.length === 1 ? '' : 's'} sent out:{' '}
                  {outsourced
                    .map((i: any) => `${i.testName}${i.outsourceLab ? ` → ${i.outsourceLab}` : ''}`)
                    .join(', ')}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* How the money actually came in. A bill settled half in cash and half
          by UPI is two receipts against one bill, and the desk has to be able
          to see which - a single "Paid ₹1,200" line cannot be reconciled
          against either the drawer or the statement. */}
      <Card data-print="hide">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold">
              <Wallet className="h-4 w-4 text-emerald-600" />
              Payments Received ({payments.length})
            </CardTitle>
            {breakdown.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {breakdown.map((entry: any) => {
                  const Icon = methodIcon(entry.method);
                  return (
                    <span
                      key={entry.method}
                      className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-800"
                    >
                      {Icon && <Icon className="h-3 w-3" />}
                      {methodLabel(entry.method)}
                      <span className="font-mono">{money(entry.amount)}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <p className="px-6 pb-6 text-xs text-muted-foreground">
              Nothing collected against this bill yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="border-b bg-muted/50 font-semibold">
                  <tr>
                    <th className="p-3">Receipt</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Reference</th>
                    <th className="p-3">Received by</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payments.map((payment: any) => {
                    const Icon = methodIcon(payment.paymentMethod);
                    return (
                      <tr key={payment._id || payment.id || payment.receiptNumber}>
                        <td className="p-3 font-mono font-bold text-blue-600">
                          <span className="flex items-center gap-1.5">
                            <ReceiptText className="h-3 w-3 shrink-0 text-muted-foreground" />
                            {payment.receiptNumber}
                          </span>
                        </td>
                        <td className="p-3 whitespace-nowrap text-muted-foreground">
                          {new Date(payment.createdAt).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-semibold">
                            {Icon && <Icon className="h-3 w-3" />}
                            {methodLabel(payment.paymentMethod)}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-muted-foreground">{payment.transactionRef || '-'}</td>
                        <td className="p-3 text-muted-foreground">{payment.receivedBy?.name || '-'}</td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {money(payment.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t-2 bg-muted/40 font-bold">
                  <tr>
                    <td className="p-3" colSpan={5}>
                      Collected
                    </td>
                    <td className="p-3 text-right font-mono text-emerald-700">{money(invoice.paidAmount)}</td>
                  </tr>
                  {due > 0 && (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={5}>
                        Still due
                      </td>
                      <td className="p-3 text-right font-mono text-amber-600">{money(due)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-print="hide">
        <CardHeader>
          <CardTitle className="text-base font-bold">Test Samples ({samples.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 font-semibold border-b">
              <tr>
                <th className="p-3">Sample ID</th>
                <th className="p-3">Test Name</th>
                <th className="p-3">Barcode</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {samples.map((s: any) => (
                <tr key={s._id}>
                  <td className="p-3 font-mono font-bold text-blue-600">{s.sampleId}</td>
                  <td className="p-3 font-bold">
                    {s.testName}
                    {s.processingMode === 'Outsource' && (
                      <Badge variant="amber" className="ml-2">
                        Outsource
                      </Badge>
                    )}
                  </td>
                  <td className="p-3 font-mono text-muted-foreground">{s.barcode}</td>
                  <td className="p-3">
                    <Badge variant="secondary">{s.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* What actually goes on paper. Shown here so the desk can check the
          bill before it prints - Print Bill sends this alone to the printer. */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground" data-print="hide">
          {sheet === 'doctor'
            ? "Doctor's bill preview - referring doctor's copy"
            : 'Bill preview - patient copy and lab copy'}
        </p>
        <div className="overflow-x-auto rounded-2xl border bg-white p-4 shadow-sm print:overflow-visible print:rounded-none print:border-0 print:p-0 print:shadow-none">
          {sheet === 'doctor' ? (
            <DoctorBillPrint invoice={invoice} />
          ) : (
            <BillPrint invoice={invoice} payments={payments} />
          )}
        </div>
      </div>

      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Record Payment</h3>
              <button onClick={() => setPayOpen(false)} className="rounded-md p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4 text-xs">
              <div className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-slate-500">Outstanding due</span>
                <span className="font-semibold text-slate-900">₹{due}</span>
              </div>

              {/* A patient covering the balance part in cash and the rest on
                  the machine is two receipts, not one - so the dialog changes
                  shape rather than asking the desk to record it twice. */}
              <div className="flex overflow-hidden rounded-lg border">
                <button
                  type="button"
                  onClick={() => setSplitting(false)}
                  className={`flex-1 px-3 py-1.5 font-semibold transition ${
                    !splitting ? 'bg-slate-900 text-white' : 'bg-background hover:bg-muted'
                  }`}
                >
                  One method
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Opens on the full due so the desk types only the first
                    // leg and the remainder is already sitting on the second.
                    if (!tenders.length) setTenders(splitSeed(payMethod, due));
                    setSplitting(true);
                  }}
                  className={`flex flex-1 items-center justify-center gap-1 px-3 py-1.5 font-semibold transition ${
                    splitting ? 'bg-slate-900 text-white' : 'bg-background hover:bg-muted'
                  }`}
                >
                  <Split className="h-3 w-3" /> Split payment
                </button>
              </div>

              {splitting ? (
                <SplitPaymentEditor tenders={tenders} onChange={setTenders} target={due} />
              ) : (
                <>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">Amount</label>
                    <Input
                      type="number"
                      min={1}
                      max={due}
                      value={payAmount}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayAmount(e.target.value)}
                      placeholder={String(due)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-semibold text-slate-700">Method</label>
                    <select
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-xs"
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                    >
                      {COLLECTION_METHODS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Money that moves through a machine cannot be asserted from
                      this screen - the gateway has to confirm it was captured, or
                      a declined card would land in the day's takings. */}
                  {GATEWAY_METHODS.includes(payMethod) && (
                    <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
                      {payMethod} is collected through the machine, so it is confirmed by the gateway rather than typed
                      in here.
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
              {!splitting && GATEWAY_METHODS.includes(payMethod) ? (
                <Button
                  onClick={() => {
                    setPayOpen(false);
                    setGatewayOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Continue to {payMethod}
                </Button>
              ) : (
                <Button isLoading={paying} onClick={recordPayment} className="bg-emerald-600 hover:bg-emerald-700">
                  {splitting ? `Save ${money(tenderTotal(tenders))}` : 'Save payment'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {gatewayOpen && (
        <PaymentGatewayModal
          invoiceId={invoice.id}
          invoiceNumber={invoice.invoiceNumber}
          patientName={patient.patientName}
          dueAmount={due}
          onClose={() => setGatewayOpen(false)}
          onCaptured={(attempt) => {
            showToast(
              `${money(attempt.amount)} received by ${attempt.method} · receipt ${attempt.receiptNumber}`,
              'success'
            );
            // The receipt lands in today's collection, so the invoice, the
            // directory and the dashboard all have to be re-read.
            queryClient.invalidateQueries({ queryKey: ['invoice-details', id] });
            MONEY_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
          }}
        />
      )}
</div>
  );
};

