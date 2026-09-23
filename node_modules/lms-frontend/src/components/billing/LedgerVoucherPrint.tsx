import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';
import { amountInWords } from '../../utils/amount-in-words';
import { formatDateTime } from '../../utils/dates';
import { methodLabel } from '../../config/payment-methods';

const money = (value: unknown) => (Number(value) || 0).toFixed(2);

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-start leading-[15px]">
    <span className="w-[96px] shrink-0 font-bold">{label}</span>
    <span className="w-[8px] shrink-0">:</span>
    <span className="min-w-0 break-words">{value || '-'}</span>
  </div>
);

export interface LedgerVoucherPrintProps {
  /** One row of the payment ledger - a collection, a refund or a centre payout. */
  transaction: any;
  centre?: CentreProfile;
}

/**
 * The counter's copy of a single ledger entry.
 *
 * The ledger bill prints a patient's whole account; this prints one line of it,
 * which is what the desk actually hands over when someone pays, is refunded or
 * a payee is settled. Money in is a receipt, money out is a voucher - the same
 * stationery with a different title and signature line, so the two are never
 * confused in a file.
 */
export const LedgerVoucherPrint: React.FC<LedgerVoucherPrintProps> = ({
  transaction,
  centre = CENTRE,
}) => {
  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));

  const isInflow = transaction?.flow === 'INFLOW';
  const isRefund = transaction?.type === 'Patient Refund';

  const title = isInflow ? 'PAYMENT RECEIPT' : isRefund ? 'REFUND VOUCHER' : 'PAYMENT VOUCHER';
  const amountLabel = isInflow ? 'Amount Received' : isRefund ? 'Amount Refunded' : 'Amount Paid';
  const partyLabel = isInflow ? 'Received From' : isRefund ? 'Refunded To' : 'Paid To';
  const signatureLabel = isInflow ? 'Received By (Cashier)' : 'Paid By (Cashier)';
  const acknowledgement = isInflow
    ? `Received with thanks from ${transaction?.partyName || 'the patient'} the sum stated above.`
    : `Paid to ${transaction?.partyName || 'the payee'} the sum stated above.`;

  const mailLine = contactLine([
    ['Mail-ID', centre.email],
    ['WebSite', centre.website],
  ]);
  const phoneLine = contactLine([
    ['Ph No.', centre.phones],
    ['Mob No.', centre.mobiles],
  ]);

  return (
    <div className="bill-sheet bg-white font-sans text-black">
      <div className="border border-black">
        {/* Centre Letterhead Header */}
        <div className="flex min-h-[86px] items-stretch border-b border-black">
          <div className="flex w-[120px] shrink-0 flex-col items-center justify-center border-r border-black px-1 py-1 text-center">
            {logoShown && (
              <img
                src={centre.logoUrl}
                alt=""
                className="max-h-[62px] max-w-full object-contain"
                onError={() => setLogoShown(false)}
              />
            )}
            {centre.tagline && <span className="mt-[2px] text-[6px] leading-[7px]">{centre.tagline}</span>}
            {centre.unitLine && <span className="text-[6px] leading-[7px]">{centre.unitLine}</span>}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1">
            <p className="text-[13px] font-bold leading-[15px]">{centre.name}</p>
            {centre.address && <p className="text-[8px] leading-[10px]">{centre.address}</p>}
            {mailLine && <p className="text-[8px] leading-[10px]">{mailLine}</p>}
            {phoneLine && <p className="text-[8px] leading-[10px]">{phoneLine}</p>}
          </div>
        </div>

        {/* Title Bar */}
        <div className="flex items-center border-b border-black bg-slate-100 px-2 py-[4px] text-[9px]">
          <span className="w-1/3 font-bold">Printed: {formatDateTime(new Date())}</span>
          <span className="w-1/3 text-center text-[13px] font-extrabold uppercase tracking-wide leading-[15px]">
            {title}
          </span>
          <span className="w-1/3 text-right font-bold">{transaction?.type || '-'}</span>
        </div>

        {/* Voucher Identity Block */}
        <div className="grid grid-cols-2 gap-x-4 border-b border-black px-2 py-2 text-[9px]">
          <div>
            <Field
              label={isInflow ? 'Receipt No.' : 'Voucher No.'}
              value={<span className="font-mono font-bold">{transaction?.receiptNumber || '-'}</span>}
            />
            <Field label="Date &amp; Time" value={formatDateTime(transaction?.date)} />
            <Field
              label="Bill Ref No."
              value={
                transaction?.invoiceNumber && transaction.invoiceNumber !== '-' ? (
                  <span className="font-mono">{transaction.invoiceNumber}</span>
                ) : (
                  '-'
                )
              }
            />
            <Field label="Entry Type" value={transaction?.type || '-'} />
          </div>
          <div>
            <Field label={partyLabel} value={<span className="font-bold">{transaction?.partyName || '-'}</span>} />
            <Field
              label="Pt. Reg. No."
              value={transaction?.partyUhid ? <span className="font-mono">{transaction.partyUhid}</span> : '-'}
            />
            <Field label="Mobile No." value={transaction?.partyMobile || '-'} />
            <Field label="Centre" value={centre.processingCentre} />
          </div>
        </div>

        {/* Payment Particulars */}
        <div className="border-b border-black px-2 py-1 bg-slate-100 text-[10px] font-bold">
          PAYMENT PARTICULARS
        </div>
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-b border-black font-bold bg-slate-50">
              <th className="w-[110px] px-1 py-[4px] text-left">Payment Method</th>
              <th className="w-[120px] px-1 py-[4px] text-left">Txn / Cheque Ref</th>
              <th className="px-1 py-[4px] text-left">Particulars / Remarks</th>
              <th className="w-[90px] px-1 py-[4px] text-left">{isInflow ? 'Received By' : 'Handled By'}</th>
              <th className="w-[75px] px-1 py-[4px] text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="px-1 py-[6px] align-top font-semibold">
                {methodLabel(transaction?.paymentMethod)}
                {transaction?.isSplit && transaction?.splitSummary && (
                  <span className="block text-[8px] font-normal text-slate-600">{transaction.splitSummary}</span>
                )}
              </td>
              <td className="px-1 py-[6px] align-top font-mono">{transaction?.transactionRef || '-'}</td>
              <td className="px-1 py-[6px] align-top">{transaction?.notes || transaction?.type || '-'}</td>
              <td className="px-1 py-[6px] align-top">{transaction?.handledBy || '-'}</td>
              <td
                className={`px-1 py-[6px] align-top text-right font-mono font-bold ${
                  isInflow ? 'text-emerald-800' : 'text-rose-800'
                }`}
              >
                {money(transaction?.amount)}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="border-y border-black font-bold bg-slate-50">
              <td colSpan={4} className="px-1 py-[5px] text-right uppercase">
                {amountLabel}:
              </td>
              <td className="px-1 py-[5px] text-right font-mono text-[12px] font-extrabold">
                ₹{money(transaction?.amount)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Amount in Words */}
        <div className="border-b border-black px-2 py-[5px] text-[9px]">
          <span className="font-bold">Amount in Words</span> : {amountInWords(Number(transaction?.amount) || 0)}
        </div>

        {/* Footer & Signature Section */}
        <div className="flex items-start justify-between gap-4 p-2 text-[9px] bg-white">
          <div className="min-w-0 max-w-sm">
            <p className="font-semibold text-[9px] text-slate-900">{acknowledgement}</p>
            <p className="text-[7.5px] leading-[10px] text-slate-500 mt-1">
              * Computer generated {isInflow ? 'receipt' : 'voucher'} issued by {centre.name}, valid against the
              ledger entry referenced above.
            </p>
          </div>
          <div className="flex gap-8 shrink-0 pt-6 text-center">
            <div className="w-[110px]">
              <p className="border-t border-black pt-[2px] text-[8px] font-semibold">{signatureLabel}</p>
            </div>
            <div className="w-[120px]">
              <p className="border-t border-black pt-[2px] text-[8px] font-bold">Authorised Signatory</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LedgerVoucherPrint;
