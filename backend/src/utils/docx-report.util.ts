import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { ApiError } from './api-error.util';
import { ageLabel } from './age.util';

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
  const age = ageLabel(patient) === '-' ? '' : ageLabel(patient);
  const address = [patient.address, patient.city, patient.state, patient.pinCode].filter(Boolean).join(', ');

  const builtIn: Record<string, string> = {
    PTNAME: patient.patientName,
    ABHA: patient.abhaNumber || '',
    ABHAADDRESS: patient.abhaAddress || '',
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

const textOf = (xml: string) => xml.replace(/<[^>]+>/g, '');

/** A file that already lays out the patient's details itself keeps its own. */
const hasOwnHeader = (documentXml: string) => /#\s*PTNAME\s*#/i.test(textOf(documentXml));

/** The patient-block placeholders - where a file's own header is recognised. */
const HEADER_TAGS = new Set(HEADER_ROWS.flatMap(([, left, , right]) => [keyOf(left), keyOf(right)]));

/**
 * Whether a Word file is meant to be a report format rather than a plain
 * reference document: it carries at least one #PLACEHOLDER# the report fills.
 */
export const isReportFormat = (template: Buffer): boolean => {
  try {
    const xml = new PizZip(template).file('word/document.xml')?.asText() || '';
    const tags: string[] = textOf(xml).match(/#[^#\r\n]{1,40}#/g) || [];
    return tags.map((t) => keyOf(t.slice(1, -1))).some((k) => HEADER_TAGS.has(k) || k === 'RESULTS');
  } catch {
    return false;
  }
};

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const RESULT_COLUMNS: [string, number][] = [
  ['Test Parameter', 1900],
  ['Result', 1000],
  ['Unit', 900],
  ['Biological Ref. Range', 1200],
];

const tableCell = (text: string, pct: number, opts: { bold?: boolean; span?: number } = {}) =>
  `<w:tc><w:tcPr><w:tcW w:w="${pct}" w:type="pct"/>${opts.span ? `<w:gridSpan w:val="${opts.span}"/>` : ''}</w:tcPr>` +
  '<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/></w:pPr>' +
  '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
  `${opts.bold ? '<w:b/><w:bCs/>' : ''}<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr>` +
  `<w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:tc>`;

/**
 * The sheet's parameters as a Word table - what #RESULTS# stands for. Every
 * value goes in as a placeholder of its own, so the patient's text is escaped
 * by the template engine and a "#" typed in a result cannot break the file.
 */
const resultsTable = (rows: any[], values: Record<string, string>) => {
  let n = 0;
  const slot = (value: any) => {
    const key = `__R${n++}`;
    values[key] = String(value ?? '');
    return `#${key}#`;
  };
  const body = rows
    .map((p) =>
      p?.resultType === 'Header'
        ? `<w:tr>${tableCell(slot(String(p.parameterName || '').toUpperCase()), 5000, { bold: true, span: 4 })}</w:tr>`
        : '<w:tr>' +
          tableCell(slot(p.parameterName), RESULT_COLUMNS[0][1]) +
          tableCell(slot(p.value), RESULT_COLUMNS[1][1], {
            bold: Boolean(p.flag && p.flag !== 'Normal'),
          }) +
          tableCell(slot(p.unit), RESULT_COLUMNS[2][1]) +
          tableCell(slot(p.referenceRange), RESULT_COLUMNS[3][1]) +
          '</w:tr>'
    )
    .join('');
  return (
    '<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>' +
    `<w:tblBorders><w:top ${NONE}/><w:left ${NONE}/><w:bottom ${NONE}/><w:right ${NONE}/>` +
    `<w:insideH ${NONE}/><w:insideV ${NONE}/></w:tblBorders><w:tblLayout w:type="fixed"/><w:tblLook w:val="0000"/></w:tblPr>` +
    '<w:tblGrid><w:gridCol w:w="3800"/><w:gridCol w:w="2000"/><w:gridCol w:w="1800"/><w:gridCol w:w="2400"/></w:tblGrid>' +
    '<w:tr><w:trPr><w:tblHeader/></w:trPr>' +
    RESULT_COLUMNS.map(([label, pct]) => tableCell(escapeXml(label), pct, { bold: true })).join('') +
    '</w:tr>' +
    body +
    '</w:tbl><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr></w:p>'
  );
};

/**
 * The body's top-level blocks (paragraphs, tables, content controls), so a
 * table can be put between two of them and never inside a cell.
 */
const topLevelBlocks = (bodyXml: string) => {
  const blocks: string[] = [];
  const re = /<(\/?)w:(tbl|sdt|p)(?=[\s>/])[^>]*?(\/?)>/g;
  let depth = 0;
  let start = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bodyXml))) {
    const [, closing, , selfClosing] = m;
    if (selfClosing) {
      if (depth === 0) {
        blocks.push(bodyXml.slice(start, re.lastIndex));
        start = re.lastIndex;
      }
      continue;
    }
    if (!closing) {
      if (depth === 0 && m.index > start) {
        blocks.push(bodyXml.slice(start, m.index));
        start = m.index;
      }
      depth += 1;
    } else {
      depth -= 1;
      if (depth === 0) {
        blocks.push(bodyXml.slice(start, re.lastIndex));
        start = re.lastIndex;
      }
    }
  }
  blocks.push(bodyXml.slice(start));
  return blocks;
};

/**
 * Puts the patient's results into the file: where #RESULTS# is typed, or -
 * when the file names none of the test's parameters itself - right under the
 * patient block, so an uploaded report never comes out without its values.
 */
const placeResults = (documentXml: string, rows: any[], values: Record<string, string>) => {
  const text = textOf(documentXml);
  const placed = /#\s*RESULTS\s*#/i.test(text);
  const parameterKeys = rows
    .filter((p) => p?.resultType !== 'Header')
    .flatMap((p) => [p?.shortName, p?.parameterName])
    .filter(Boolean)
    .map(keyOf);
  const tags = (text.match(/#[^#\r\n]{1,60}#/g) || []).map((t) => keyOf(t.slice(1, -1)));
  const namesParameters = tags.some((t) => parameterKeys.includes(t));
  if (!placed && namesParameters) return documentXml;

  const open = documentXml.match(/<w:body(\s[^>]*)?>/);
  const closeAt = documentXml.lastIndexOf('<w:sectPr');
  const bodyEnd = closeAt > 0 ? closeAt : documentXml.lastIndexOf('</w:body>');
  if (!open || bodyEnd < 0) return documentXml;
  const bodyStart = (open.index || 0) + open[0].length;
  const blocks = topLevelBlocks(documentXml.slice(bodyStart, bodyEnd));
  const table = resultsTable(rows, values);

  if (placed) {
    // The paragraph holding #RESULTS# becomes the table.
    const at = blocks.findIndex((b) => /#\s*RESULTS\s*#/i.test(textOf(b)));
    if (at >= 0 && /^<w:p[\s>]/.test(blocks[at])) blocks[at] = table;
    else if (at >= 0) blocks.splice(at + 1, 0, table);
  } else {
    // Below the last block that carries a patient-block placeholder.
    let after = -1;
    blocks.forEach((b, i) => {
      const inBlock = (textOf(b).match(/#[^#\r\n]{1,40}#/g) || []).map((t) => keyOf(t.slice(1, -1)));
      if (inBlock.some((t) => HEADER_TAGS.has(t))) after = i;
    });
    blocks.splice(after + 1, 0, table);
  }
  return documentXml.slice(0, bodyStart) + blocks.join('') + documentXml.slice(bodyEnd);
};

const compile = (template: Buffer, values: Record<string, string> = {}, rows?: any[]) => {
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

  let documentXml = documentFile.asText();
  if (!hasOwnHeader(documentXml)) {
    documentXml = documentXml.replace(/<w:body(\s[^>]*)?>/, (open) => open + HEADER_XML);
  }
  if (rows) documentXml = placeResults(documentXml, rows, values);
  zip.file('word/document.xml', documentXml);

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
  const rows = [...(sheet?.results || [])].sort((a: any, b: any) => (a?.displayOrder || 0) - (b?.displayOrder || 0));
  const doc = compile(template, reportValues(sheet), rows);
  try {
    doc.render({});
  } catch (error: any) {
    throw new ApiError(422, `The report could not be filled in: ${error?.message || 'template error'}`);
  }
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
};
