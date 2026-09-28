import React from 'react';
import { CENTRE, type CentreProfile } from '../../config/centre';
import { formatDateTime } from '../../utils/dates';
import { CentreLetterhead } from './CentreLetterhead';

const money = (value: unknown) => `₹${(Number(value) || 0).toFixed(2)}`;

/** The booked-test row as the Booked Tests list holds it. */
export interface TestSlipData {
  invoiceNumber: string;
  enquiryNo?: string;
  barcode?: string;
  uhid: string;
  billedAt: string;
  paymentStatus?: string;
  dueAmount?: number;
  patient?: { patientName?: string; mobile?: string };
  doctorName?: string;
  organizationName?: string;
  testName: string;
  testCode: string;
  departmentName: string;
  packageName?: string;
  processingMode?: string;
  rate: number;
  netAmount: number;
  cancelled: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  refundedAmount: number;
  sampleId?: string;
  sampleStatus?: string;
  statusLabel: string;
}

/**
 * One booked test on half a page: who it is for, which bill it sits on, where
 * the work has got to and what it cost - what the patient asks for when they
 * want proof of a single test rather than the whole bill.
 */
export const TestSlipPrint: React.FC<{ test: TestSlipData; centre?: CentreProfile }> = ({
  test,
  centre = CENTRE,
}) => {
  const row = (label: string, value?: React.ReactNode) => (
    <tr className="border-t border-slate-300">
      <td className="w-[32%] px-2 py-[4px] font-semibold">{label}</td>
      <td className="px-2 py-[4px]">{value || '-'}</td>
    </tr>
  );

  return (
    <div className="bill-sheet bg-white font-sans text-black">
      <div className="border border-black">
        <CentreLetterhead centre={centre} />

        <div className="flex items-center border-b border-black bg-slate-100 px-2 py-[4px] text-[9px]">
          <span className="w-1/3 font-bold">Printed: {formatDateTime(new Date())}</span>
          <span className="w-1/3 text-center text-[13px] font-extrabold uppercase leading-[15px] tracking-wide">
            Test Slip
          </span>
          <span className="w-1/3 text-right font-bold">{test.invoiceNumber}</span>
        </div>

        <table className="w-full border-collapse text-[10px]">
          <tbody>
            {row('Patient', test.patient?.patientName)}
            {row('UHID', test.uhid)}
            {row('Mobile', test.patient?.mobile)}
            {row('Referred by', test.doctorName || 'Self')}
            {test.organizationName && row('Organization / TPA', test.organizationName)}
            {row('Bill No.', test.invoiceNumber)}
            {test.enquiryNo && row('Enquiry No.', test.enquiryNo)}
            {row('Billed on', formatDateTime(test.billedAt))}
            <tr className="border-t border-black bg-slate-50">
              <td className="px-2 py-[5px] font-bold">Test</td>
              <td className="px-2 py-[5px] font-bold">
                {test.testName} ({test.testCode})
              </td>
            </tr>
            {row('Department', test.departmentName)}
            {test.packageName && row('Package', test.packageName)}
            {row('Processing', test.processingMode)}
            {row('Sample ID', test.sampleId)}
            {row('Status', test.statusLabel)}
            {row('Rate', money(test.rate))}
            {row('Net amount', <span className="font-bold">{money(test.netAmount)}</span>)}
            {row('Bill payment', `${test.paymentStatus || '-'}${test.dueAmount ? ` (due ${money(test.dueAmount)})` : ''}`)}
            {test.cancelled && (
              <>
                {row('Cancelled on', test.cancelledAt ? formatDateTime(test.cancelledAt) : '-')}
                {row('Reason', test.cancellationReason)}
                {row('Refunded', money(test.refundedAmount))}
              </>
            )}
          </tbody>
        </table>

        <div className="flex justify-end border-t border-black px-2 pb-2 pt-8 text-[9px]">
          <span className="border-t border-black px-6 pt-1">Authorised Signatory</span>
        </div>
      </div>
    </div>
  );
};

export default TestSlipPrint;
