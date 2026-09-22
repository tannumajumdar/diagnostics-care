import React, { useState } from 'react';
import { CENTRE, contactLine, type CentreProfile } from '../../config/centre';
import { amountInWords } from '../../utils/amount-in-words';
import { ageSexLabel } from '../../utils/age';

/**
 * The referring doctor's copy of a bill.
 *
 * It is a separate document at a separate price. The centre and the doctor
 * agree a rate per test that sits above what the centre itself charges; the
 * doctor's patient is billed that figure, the centre is paid its own, and the
 * difference is what the doctor keeps. Nothing the desk discounted for the
 * patient appears here, because it is not the same money.
 *
 * Printed on one sheet, not two - there is no lab copy to tear off, and
 * nothing on it travels with the sample.
 */

const money = (value: unknown) => (Number(value) || 0).toFixed(2);

const billDateTime = (value?: string | Date) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = d.getHours() % 12 || 12;
  const meridiem = d.getHours() < 12 ? 'AM' : 'PM';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} / ${pad(hours)}:${pad(
    d.getMinutes()
  )} ${meridiem}`;
};

const Field: React.FC<{ label: string; value?: React.ReactNode; labelWidth?: string }> = ({
  label,
  value,
  labelWidth = 'w-[84px]',
}) => (
  <div className="flex items-start leading-[14px]">
    <span className={`${labelWidth} shrink-0 font-bold`}>{label}</span>
    <span className="w-[8px] shrink-0">:</span>
    <span className="min-w-0 break-words">{value || '-'}</span>
  </div>
);

export interface DoctorBillPrintProps {
  invoice: any;
  centre?: CentreProfile;
}

export const DoctorBillPrint: React.FC<DoctorBillPrintProps> = ({ invoice, centre = CENTRE }) => {
  const patient = typeof invoice?.patient === 'object' && invoice?.patient ? invoice.patient : {};
  const items: any[] = Array.isArray(invoice?.items) ? invoice.items : [];

  const referredBy =
    (typeof invoice?.referringDoctor === 'object' ? invoice?.referringDoctor?.doctorName : '') ||
    invoice?.referringDoctorName ||
    '-';
  const doctorHospital =
    typeof invoice?.referringDoctor === 'object' ? invoice?.referringDoctor?.hospital : '';

  /** What each line is worth on this copy, falling back to the line's own rate. */
  const lineRate = (item: any) => Number(item?.referralRate) || Number(item?.rate) || 0;

  // The stored total is what was agreed on the day. Older bills, raised
  // before the doctor's copy existed, are added up from their lines instead
  // of printing a zero the doctor would have to query.
  const total =
    Number(invoice?.referralTotal) || items.reduce((sum, item) => sum + lineRate(item), 0);

  const [logoShown, setLogoShown] = useState(Boolean(centre.logoUrl));

  const phoneLine = contactLine([
    ['Ph No.', centre.phones],
    ['Mob No.', centre.mobiles],
  ]);

  return (
    <div className="doctor-bill-sheet bg-white font-sans text-black">
      <div className="border border-black">
        {/* The band keeps a fixed height and a logo cell of its own whether or
            not artwork is configured: the centre prints on its own letterhead,
            and a header that collapsed with no logo set would move every line
            below it the day `logo.png` is dropped into `frontend/public`. */}
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
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-center px-2 py-1">
            <p className="text-[13px] font-bold leading-[15px]">{centre.name}</p>
            {centre.address && <p className="text-[8px] leading-[10px]">{centre.address}</p>}
            {phoneLine && <p className="text-[8px] leading-[10px]">{phoneLine}</p>}
          </div>
        </div>

        <div className="flex items-center border-b border-black px-2 py-[3px] text-[9px]">
          <span className="w-1/3 font-bold">Ref. Dr. Copy</span>
          <span className="w-1/3 text-center text-[15px] font-bold leading-[17px]">DOCTOR BILL</span>
          <span className="w-1/3 text-right font-bold">{billDateTime(invoice?.createdAt)}</span>
        </div>

        {/* Who it is for, and who it is about */}
        <div className="grid grid-cols-2 gap-x-4 px-2 py-1 text-[9px]">
          <div>
            <Field label="Ref. Dr." value={<span className="font-bold">{referredBy}</span>} />
            {doctorHospital && <Field label="Hospital" value={doctorHospital} />}
            <Field label="Pt. Name" value={<span className="font-bold">{patient?.patientName}</span>} />
            <Field label="Pt. Age / Sex" value={ageSexLabel(patient)} />
          </div>
          <div>
            <Field label="Bill No." value={invoice?.invoiceNumber} labelWidth="w-[80px]" />
            <Field label="Pt. Reg. No." value={invoice?.uhid || patient?.uhid} labelWidth="w-[80px]" />
            <Field label="Mobile No." value={patient?.mobile} labelWidth="w-[80px]" />
            <Field label="Centre" value={centre.processingCentre} labelWidth="w-[80px]" />
          </div>
        </div>

        {/* The tests, at the doctor's agreed rates */}
        <table className="w-full border-collapse text-[9px]">
          <thead>
            <tr className="border-y border-black font-bold">
              <th className="w-[36px] px-1 py-[3px] text-left">Sr No.</th>
              <th className="w-[110px] px-1 py-[3px] text-left">Department</th>
              <th className="w-[70px] px-1 py-[3px] text-left">Test Code</th>
              <th className="px-1 py-[3px] text-left">Test Name</th>
              <th className="w-[64px] px-1 py-[3px] text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item._id || `${item.testCode}-${index}`}>
                <td className="px-1 py-[2px] text-center">{index + 1}</td>
                <td className="px-1 py-[2px] uppercase">{item.departmentName || '-'}</td>
                <td className="px-1 py-[2px]">{item.testCode}</td>
                <td className="px-1 py-[2px]">
                  {item.testName}
                  {item.packageName ? ` (${item.packageName})` : ''}
                </td>
                <td className="px-1 py-[2px] text-right">{money(lineRate(item))}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-1 py-2 text-center">
                  No tests billed on this invoice.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex items-stretch border-t border-black">
          <div className="min-w-0 flex-1 p-1 text-[9px]">
            <div className="flex gap-2">
              <div className="w-[140px] shrink-0">
                <p className="font-bold">In Words -</p>
                <p className="leading-[11px]">{amountInWords(total)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex justify-end">
                  <Field label="Total Amount" value={money(total)} labelWidth="w-[92px]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-black px-2 py-[3px] text-[9px] font-bold">
          <span>Ref. Dr. Copy &mdash; not the patient&rsquo;s receipt</span>
          <span className="font-normal">{centre.poweredByLine}</span>
          <span>Auth. Sign.</span>
        </div>
      </div>
    </div>
  );
};

export default DoctorBillPrint;
