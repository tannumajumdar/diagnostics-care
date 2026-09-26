import PDFDocument from 'pdfkit';
import { resultMarker } from './result-marker.util';
import { CENTRE, contactLine } from '../config/centre';

const LEFT = 40;
const RIGHT = 570;

/** The letterhead band: the logo's cell, and the height held for the whole. */
const LOGO_CELL = 110;
const HEADER_BAND = 78;

const COLUMNS = [
  { key: 'parameterName', label: 'Test Parameter', x: 40, width: 215 },
  { key: 'value', label: 'Result', x: 255, width: 90 },
  { key: 'unit', label: 'Unit', x: 345, width: 70 },
  { key: 'referenceRange', label: 'Biological Ref. Range', x: 415, width: 155 },
];

const rule = (doc: PDFKit.PDFDocument, color = '#e5e7eb') => {
  doc.strokeColor(color).lineWidth(1).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).stroke();
};

const flagColour = (flag: string) => {
  if (flag === 'Critical') return '#b91c1c';
  if (flag === 'High' || flag === 'Low') return '#c2410c';
  return '#15803d';
};

/**
 * The patient's report as one document.
 *
 * A visit is one report, however many tests were billed on it: the letterhead
 * and the patient's details are printed once and each test follows as its own
 * section. Handed a single record it prints a report of one, which is what an
 * older caller expects.
 */
export const generateDiagnosticReportPDF = async (records: any): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const buffers: Buffer[] = [];

    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    const sheets: any[] = (Array.isArray(records) ? records : [records]).filter(Boolean);
    const resultRecord = sheets[0] || {};

    const patient = typeof resultRecord.patient === 'object' ? resultRecord.patient || {} : {};
    const invoice = typeof resultRecord.invoice === 'object' ? resultRecord.invoice || {} : {};

    const stamp = (value: any) =>
      value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
    const address = [patient.address, patient.city, patient.state, patient.pinCode]
      .filter(Boolean)
      .join(', ');

    // Whoever asked for the test belongs on the report - the panel doctor's own
    // record where the bill was linked to one, otherwise the name the desk
    // typed off the prescription.
    const referredBy =
      (typeof invoice.referringDoctor === 'object' ? invoice.referringDoctor?.doctorName : '') ||
      invoice.referringDoctorName ||
      'Self / Walk-in';

    // The centre's own letterhead, the same one the bill and the on-screen
    // report print. A line with nothing configured behind it is skipped.
    //
    // The band is a fixed height with a cell held for the logo whether or not
    // artwork is configured: a centre printing on its own stationery needs the
    // room at the top, and every report then starts its patient block on the
    // same line whatever the letterhead happens to fill.
    const headerTop = doc.y;

    if (CENTRE.logoPath) {
      try {
        doc.image(CENTRE.logoPath, LEFT, headerTop, { fit: [LOGO_CELL - 10, HEADER_BAND - 8] });
      } catch {
        // Missing or unreadable artwork must never cost a patient their
        // report - the cell is simply left blank.
      }
    }

    // Kept clear of the logo on the left and balanced by the same width on the
    // right, so the centre's name sits centred on the sheet either way.
    const headerLeft = LEFT + LOGO_CELL;
    const headerWidth = RIGHT - LEFT - LOGO_CELL * 2;

    const subtitle = [CENTRE.accreditation, CENTRE.address].filter(Boolean).join(' | ');
    const contact = contactLine([
      ['Phone', CENTRE.reportingEnquiryNumbers || CENTRE.phones || CENTRE.mobiles],
      ['Email', CENTRE.email],
    ]);

    doc.fillColor('#2563eb').fontSize(18).text(CENTRE.name, headerLeft, headerTop + 8, {
      width: headerWidth,
      align: 'center',
    });
    doc.fillColor('#4b5563').fontSize(9);
    if (subtitle) doc.text(subtitle, headerLeft, doc.y, { width: headerWidth, align: 'center' });
    if (contact) doc.text(contact, headerLeft, doc.y, { width: headerWidth, align: 'center' });

    // The body starts below the whole band, not below whatever the text
    // happened to reach.
    doc.y = Math.max(doc.y, headerTop + HEADER_BAND);
    doc.x = LEFT;

    rule(doc);
    doc.moveDown(0.8);

    // Left column identifies the patient, right column identifies the draw and
    // the report - the two things a counter query is ever about.
    const infoTop = doc.y;
    doc.fillColor('#111827').fontSize(10).font('Helvetica-Bold').text(`${patient.patientName || 'N/A'}`, LEFT, infoTop, { width: 260 });
    doc.font('Helvetica').fontSize(9).fillColor('#4b5563');
    doc.text(`UHID: ${resultRecord.uhid || '-'}`, LEFT, doc.y, { width: 260 });
    doc.text(`${patient.age ?? '-'} Yrs / ${patient.gender || '-'}${patient.mobile ? ` / ${patient.mobile}` : ''}`, LEFT, doc.y, { width: 260 });
    doc.text(`Consultant Doctor: ${referredBy}`, LEFT, doc.y, { width: 260 });
    if (invoice.invoiceNumber) {
      doc.text(`Invoice: ${invoice.invoiceNumber}`, LEFT, doc.y, { width: 260 });
    }
    if (address) {
      doc.text(`Address: ${address}`, LEFT, doc.y, { width: 260 });
    }
    const leftBottom = doc.y;

    // The right column identifies the report and the visit it covers; anything
    // belonging to one draw is printed with its own test section below.
    doc.fontSize(9).fillColor('#4b5563');
    doc.text(`Report No: ${resultRecord.resultId || '-'}`, 320, infoTop, { width: 250, align: 'right' });
    // This visit's number, which is what the patient quotes when they ring.
    doc.text(
      `Enquiry No: ${resultRecord.enquiryNo || invoice.enquiryNo || '-'}`,
      320,
      doc.y,
      { width: 250, align: 'right' }
    );
    doc.text(`Reported: ${stamp(resultRecord.updatedAt || resultRecord.createdAt)}`, 320, doc.y, { width: 250, align: 'right' });
    doc.text(
      `Tests on this report: ${sheets.length}`,
      320,
      doc.y,
      { width: 250, align: 'right' }
    );
    if (invoice.createdAt) {
      doc.text(`Registered: ${stamp(invoice.createdAt)}`, 320, doc.y, { width: 250, align: 'right' });
    }
    const primarySample = typeof resultRecord.sample === 'object' ? resultRecord.sample || {} : {};
    if (primarySample.sampleId) {
      doc.text(`Specimen No: ${primarySample.sampleId}`, 320, doc.y, { width: 250, align: 'right' });
    }
    if (primarySample.collectionDate) {
      doc.text(`Collection Date: ${stamp(primarySample.collectionDate)}`, 320, doc.y, { width: 250, align: 'right' });
    }

    // Both columns are written from the same starting Y, so continue below
    // whichever ran longer rather than overlapping the rule onto the text.
    doc.y = Math.max(leftBottom, doc.y);

    doc.moveDown(1);
    rule(doc);
    doc.moveDown(0.8);

    // One section per test, arrived at already grouped by department and in
    // billing order within it. Everything the counter needs to tell two draws
    // apart - sample id, barcode - sits with its own test rather than in a
    // header that can only hold one.
    let lastDepartment: string | null = null;
    sheets.forEach((sheet: any, index: number) => {
      const test = typeof sheet.test === 'object' ? sheet.test || {} : {};
      const sample = typeof sheet.sample === 'object' ? sheet.sample || {} : {};
      const department = typeof sheet.department === 'object' ? sheet.department || {} : {};

      // A long panel followed by another test would start half off the page.
      if (index > 0 && doc.y > 620) doc.addPage();
      if (index > 0) doc.moveDown(1);

      // A banner each time the report moves into another department.
      const departmentName = department.departmentName || '';
      if (departmentName && departmentName !== lastDepartment) {
        doc
          .fillColor('#2563eb')
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(`DEPARTMENT OF ${departmentName.toUpperCase()}`, LEFT, doc.y, {
            width: RIGHT - LEFT,
            align: 'center',
          });
        doc.moveDown(0.5);
      }
      lastDepartment = departmentName;

      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(11).text(
        `${test.testName || 'Diagnostic Test'}${test.testCode ? ` (${test.testCode})` : ''}`,
        LEFT,
        doc.y
      );

      const meta = [
        sample.sampleId ? `Sample ${sample.sampleId}` : '',
        sample.barcode ? `Barcode ${sample.barcode}` : '',
        test.sampleType || sample.sampleType || '',
        sample.collectionDate ? `Collected ${stamp(sample.collectionDate)}` : '',
        sheet.status && sheet.status !== 'Approved' ? `Status ${sheet.status}` : '',
      ]
        .filter(Boolean)
        .join('  ·  ');

      if (meta) {
        doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(meta, LEFT, doc.y, { width: RIGHT - LEFT });
      }
      doc.moveDown(0.6);

      const headerY = doc.y;
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
      COLUMNS.forEach((col) => doc.text(col.label, col.x, headerY, { width: col.width }));
      doc.y = headerY + 14;
      rule(doc, '#d1d5db');
      doc.moveDown(0.4);

      const rows = (sheet.results || [])
        .slice()
        .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));

      if (rows.length === 0) {
        doc.font('Helvetica-Oblique').fontSize(9).fillColor('#6b7280').text(
          'No parameters are configured for this test. Add them on the test master and re-open the report.',
          LEFT,
          doc.y,
          { width: RIGHT - LEFT }
        );
      }

      rows.forEach((res: any) => {
        // Start a fresh page before a row can spill off the bottom, otherwise the
        // last parameters of a long panel print half off the sheet.
        if (doc.y > 700) {
          doc.addPage();
          const y = doc.y;
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
          COLUMNS.forEach((col) => doc.text(col.label, col.x, y, { width: col.width }));
          doc.y = y + 14;
          rule(doc, '#d1d5db');
          doc.moveDown(0.4);
        }

        const rowY = doc.y;

        // A section title inside the panel (RBC INDICES) - bold, across the
        // row, with nothing in the value, unit or range columns.
        if (res.resultType === 'Header') {
          doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827');
          doc.text(String(res.parameterName || '').toUpperCase(), COLUMNS[0].x, rowY + 2, {
            width: RIGHT - COLUMNS[0].x,
          });
          doc.font('Helvetica');
          doc.y = rowY + 16;
          return;
        }

        const flag = res.flag || 'Normal';
        const abnormal = flag !== 'Normal';
        const marker = resultMarker(res);

        doc.font('Helvetica').fontSize(9).fillColor('#111827');
        doc.text(res.parameterName || '-', COLUMNS[0].x, rowY, { width: COLUMNS[0].width });

        // The method sits under the parameter it belongs to rather than in a
        // column of its own, which is what makes room for a wider range.
        if (res.method) {
          doc.font('Helvetica').fontSize(7).fillColor('#6b7280');
          doc.text(res.method, COLUMNS[0].x, rowY + 10, { width: COLUMNS[0].width });
          doc.fontSize(9);
        }

        // The figure carries its own H / L rather than a word in a far column.
        doc.font(abnormal ? 'Helvetica-Bold' : 'Helvetica').fillColor(abnormal ? flagColour(flag) : '#111827');
        doc.text(`${res.value || '-'}${marker ? ` ${marker}` : ''}`, COLUMNS[1].x, rowY, {
          width: COLUMNS[1].width,
        });

        doc.font('Helvetica').fillColor('#4b5563');
        doc.text(res.unit || '-', COLUMNS[2].x, rowY, { width: COLUMNS[2].width });
        doc.text(res.referenceRange || '-', COLUMNS[3].x, rowY, { width: COLUMNS[3].width });

        doc.fillColor('#111827').font('Helvetica');
        doc.y = rowY + (res.method ? 22 : 14);
      });

      // With the word out of the table the letter has to be explained, and only
      // on a test that actually carries one.
      if (rows.some((res: any) => (res.flag || 'Normal') !== 'Normal')) {
        doc.moveDown(0.4);
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor('#6b7280')
          .text('H = above the biological reference range  ·  L = below it  ·  * = critical value', LEFT, doc.y, {
            width: RIGHT - LEFT,
          });
        doc.fontSize(9).fillColor('#111827');
      }

      // The test's interpretation from the catalogue: an underlined heading,
      // the headline with a rule under it, then the comments as bullets.
      const interpretationTitle = String(test.interpretationTitle || '').trim();
      const comments = String(test.interpretation || '')
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*[•\-*]\s*/, '').trim())
        .filter(Boolean);

      if (interpretationTitle) {
        if (doc.y > 680) doc.addPage();
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('Interpretation', LEFT, doc.y, {
          underline: true,
        });
        doc.font('Helvetica').fontSize(12).fillColor('#111827').text(interpretationTitle, LEFT, doc.y, {
          width: RIGHT - LEFT,
        });
        doc.moveDown(0.2);
        rule(doc, '#111827');
      }

      if (comments.length) {
        if (doc.y > 680) doc.addPage();
        doc.moveDown(0.8);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('Comments:-', LEFT, doc.y, {
          underline: true,
        });
        doc.moveDown(0.3);
        doc.font('Helvetica').fontSize(8.5).fillColor('#111827');
        comments.forEach((line) => {
          if (doc.y > 740) doc.addPage();
          doc.text(`• ${line}`, LEFT, doc.y, { width: RIGHT - LEFT });
          doc.moveDown(0.15);
        });
      }

      if (sheet.overallRemarks) {
        doc.moveDown(0.6);
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text('Remarks', LEFT, doc.y);
        doc.font('Helvetica').fontSize(9).fillColor('#4b5563').text(sheet.overallRemarks, LEFT, doc.y, {
          width: RIGHT - LEFT,
        });
      }
    });

    doc.moveDown(2);
    rule(doc);
    doc.moveDown(0.6);

    const signTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(
      resultRecord.enteredBy?.name || 'Technician',
      LEFT,
      signTop,
      { width: 250 }
    );
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(
      resultRecord.enteredBy?.role || 'Lab Technician',
      LEFT,
      doc.y,
      { width: 250 }
    );

    // Usually one pathologist signs the whole visit; where two signed different
    // tests, both names go on it rather than crediting the report to one.
    const verifiers = Array.from(
      new Set(sheets.map((sheet: any) => sheet.verifiedBy?.name).filter(Boolean))
    ) as string[];
    const verifiedAt = sheets.find((sheet: any) => sheet.verifiedBy?.date)?.verifiedBy?.date;

    doc.font('Helvetica-Bold').fontSize(9).fillColor('#111827').text(
      verifiers.length ? verifiers.join(', ') : 'Pending verification',
      320,
      signTop,
      { width: 250, align: 'right' }
    );
    doc.font('Helvetica').fontSize(8).fillColor('#6b7280').text(
      verifiers.length > 1 ? 'Consultant Pathologists' : 'Consultant Pathologist',
      320,
      doc.y,
      { width: 250, align: 'right' }
    );
    if (verifiedAt && verifiers.length === 1) {
      doc.text(`Verified ${stamp(verifiedAt)}`, 320, doc.y, { width: 250, align: 'right' });
    }

    doc.moveDown(2);
    doc.fontSize(8).fillColor('#6b7280').text('End of Diagnostic Report - Computer Verified Document', LEFT, doc.y, {
      width: RIGHT - LEFT,
      align: 'center',
    });
    doc.fontSize(7).text(
      'Results relate only to the samples tested. Not valid for medico-legal purposes.',
      LEFT,
      doc.y,
      { width: RIGHT - LEFT, align: 'center' }
    );

    doc.end();
  });
};

export const generateResultPDF = generateDiagnosticReportPDF;
