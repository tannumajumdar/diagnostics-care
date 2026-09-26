import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { ApiError } from './api-error.util';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * A test's report printed from the lab's own Word file.
 *
 * The file is laid out in Word exactly as the patient should receive it, with
 * #PLACEHOLDERS# where their details go - `#PTNAME#`, `#AGE/SEX#`,
 * `#COLLDATE#` and the rest below. A parameter's result goes in by its short
 * name or its full name (`#HB#`, `#Haemoglobin#`). Case and spacing inside the
 * #…# do not matter.
 */

/** "#Age / Sex#" and "#AGE/SEX#" are the same placeholder. */
const keyOf = (tag: string) => String(tag || '').trim().replace(/\s+/g, '').toUpperCase();

const stamp = (value: any) =>
  value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '';

/** Everything a template can print for one test sheet, keyed by `keyOf`. */
export const reportValues = (sheet: any): Record<string, string> => {
  const patient = typeof sheet?.patient === 'object' ? sheet.patient || {} : {};
  const invoice = typeof sheet?.invoice === 'object' ? sheet.invoice || {} : {};
  const sample = typeof sheet?.sample === 'object' ? sheet.sample || {} : {};
  const test = typeof sheet?.test === 'object' ? sheet.test || {} : {};

  const values: Record<string, string> = {};

  // A parameter's result under its short name and its full name. Put in first
  // so a parameter that happens to be called "AGE" cannot hide the patient's.
  for (const p of sheet?.results || []) {
    if (p?.resultType === 'Header') continue;
    const value = String(p?.value ?? '').trim();
    if (p?.shortName) values[keyOf(p.shortName)] = value;
    if (p?.parameterName) values[keyOf(p.parameterName)] = value;
  }

  const doctor =
    (typeof invoice.referringDoctor === 'object' ? invoice.referringDoctor?.doctorName : '') ||
    invoice.referringDoctorName ||
    'Self';
  const age = patient.age !== undefined && patient.age !== null ? `${patient.age} Yrs` : '';
  const address = [patient.address, patient.city, patient.state, patient.pinCode].filter(Boolean).join(', ');

  const builtIn: Record<string, string> = {
    PTNAME: patient.patientName,
    PATIENTNAME: patient.patientName,
    'AGE/SEX': [age, patient.gender].filter(Boolean).join(' / '),
    AGE: age,
    SEX: patient.gender,
    GENDER: patient.gender,
    MOB: patient.mobile,
    MOBILE: patient.mobile,
    PID: sheet?.uhid,
    UHID: sheet?.uhid,
    BYDOC: doctor,
    DOCTOR: doctor,
    COLLDATE: stamp(sample.collectionDate),
    DATETIME: stamp(sheet?.verifiedBy?.date || sheet?.updatedAt || sheet?.createdAt),
    REPORTDATE: stamp(sheet?.verifiedBy?.date || sheet?.updatedAt || sheet?.createdAt),
    TESTNO: sample.sampleId,
    SAMPLEID: sample.sampleId,
    SPECIMENNO: sample.sampleId,
    BARCODE: sample.barcode,
    REGDATE: stamp(invoice.createdAt),
    TESTNAME: test.testName,
    TESTCODE: test.testCode,
    REPORTNO: sheet?.resultId,
    ENQNO: sheet?.enquiryNo || invoice.enquiryNo,
    INVOICENO: invoice.invoiceNumber,
    ADDRESS: address,
    ORGANIZATION: typeof invoice.organization === 'object' ? invoice.organization?.organizationName : '',
    INTERPRETATION: test.interpretationTitle,
    INTERPRETATIONTITLE: test.interpretationTitle,
    COMMENTS: test.interpretation,
    REMARKS: sheet?.overallRemarks,
    VERIFIEDBY: sheet?.verifiedBy?.name,
    ENTEREDBY: sheet?.enteredBy?.name,
  };
  for (const [key, value] of Object.entries(builtIn)) values[keyOf(key)] = String(value ?? '');

  return values;
};

/**
 * The patient block every Word-format report opens with - the same on every
 * test, laid out as the lab's own report has it: the patient on the left, the
 * draw and the report on the right, ruled off underneath. The test's file only
 * carries what goes below it.
 */
const HEADER_ROWS: [string, string, string, string][] = [
  ["Patient's Name", 'PTNAME', 'Collection Date', 'COLLDATE'],
  ['Age/Sex', 'AGE/SEX', 'Reporting Date', 'DATETIME'],
  ['Consultant Doctor', 'BYDOC', 'Specimen No.', 'TESTNO'],
  ['Mobile No.', 'MOB', 'UH – ID', 'PID'],
];

const run = (text: string) =>
  '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
  `<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>`;

const cell = (text: string, pct: number) =>
  `<w:tc><w:tcPr><w:tcW w:w="${pct}" w:type="pct"/></w:tcPr>` +
  `<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>${run(text)}</w:p></w:tc>`;

const NONE = 'w:val="nil"';
const HEADER_XML =
  '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>' +
  `<w:tblBorders><w:top ${NONE}/><w:left ${NONE}/><w:right ${NONE}/>` +
  '<w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>' +
  `<w:insideH ${NONE}/><w:insideV ${NONE}/></w:tblBorders>` +
  '<w:tblLayout w:type="fixed"/><w:tblLook w:val="0000"/></w:tblPr>' +
  '<w:tblGrid><w:gridCol w:w="1800"/><w:gridCol w:w="2880"/><w:gridCol w:w="1800"/><w:gridCol w:w="2880"/></w:tblGrid>' +
  HEADER_ROWS.map(
    ([leftLabel, leftTag, rightLabel, rightTag]) =>
      '<w:tr>' +
      cell(leftLabel, 950) +
      cell(`: #${leftTag}#`, 1550) +
      cell(rightLabel, 950) +
      cell(`: #${rightTag}#`, 1550) +
      '</w:tr>'
  ).join('') +
  '</w:tbl>' +
  // The second rule a little below the first, as on the printed report, and
  // a paragraph that keeps the file's own first table from joining this one.
  '<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>' +
  '<w:spacing w:before="0" w:after="0"/></w:pPr></w:p>' +
  '<w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>';

/** A file that already lays out the patient's details itself keeps its own. */
const hasOwnHeader = (documentXml: string) =>
  /#\s*PTNAME\s*#/i.test(documentXml.replace(/<[^>]+>/g, ''));

const compile = (template: Buffer, values: Record<string, string> = {}) => {
  let zip: PizZip;
  try {
    zip = new PizZip(template);
  } catch {
    throw new ApiError(400, 'This is not a valid Word .docx file - open it in Word and "Save As" .docx');
  }
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new ApiError(400, 'This is not a Word document - save the report format as a .docx file');
  }

  const documentXml = documentFile.asText();
  if (!hasOwnHeader(documentXml)) {
    zip.file('word/document.xml', documentXml.replace(/<w:body(\s[^>]*)?>/, (open) => open + HEADER_XML));
  }

  try {
    return new Docxtemplater(zip, {
      delimiters: { start: '#', end: '#' },
      paragraphLoop: true,
      linebreaks: true,
      errorLogging: false,
      parser: (tag: string) => ({
        get: (scope: any) => (tag === '.' ? scope : values[keyOf(tag)]),
      }),
      // A placeholder nothing fills - most likely a typo in the template - is
      // left as it was typed, so it shows up on the first report checked
      // rather than silently printing blank.
      nullGetter: (part: any) => (part?.module ? '' : `#${part?.value ?? ''}#`),
    });
  } catch (error: any) {
    const errors: any[] = error?.properties?.errors || [error];
    const detail = errors
      .slice(0, 3)
      .map((e) => e?.properties?.explanation || e?.message)
      .filter(Boolean)
      .join('; ');
    throw new ApiError(
      400,
      `The report format has a placeholder problem - every #NAME# needs a # on both sides. ${detail}`
    );
  }
};

/** Refuses a file that could never produce a report, at upload rather than on a patient's. */
export const checkReportTemplate = (template: Buffer) => {
  compile(template);
};

/** The test's Word file with this sheet's patient and results filled in. */
export const fillReportTemplate = (template: Buffer, sheet: any): Buffer => {
  const doc = compile(template, reportValues(sheet));
  try {
    doc.render({});
  } catch (error: any) {
    throw new ApiError(422, `The report could not be filled in: ${error?.message || 'template error'}`);
  }
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
};
