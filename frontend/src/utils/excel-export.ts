import type { Cell, Row } from 'write-excel-file/browser';

/**
 * A real `.xlsx` workbook, not a comma-separated file with a spreadsheet name.
 *
 * CSV was what this used to write, and on a Windows desk it lands wherever
 * `.csv` happens to be associated - often the text editor - so the accountant
 * who asked for a spreadsheet gets a wall of commas. An `.xlsx` opens in Excel
 * because it *is* an Excel file, and it carries what a CSV cannot: money kept
 * as numbers that sum, a frozen header, and columns wide enough to read.
 *
 * The writer is pulled in only when somebody exports, so the cost of it stays
 * off the first page load.
 */

/** A column is money if its values read like rupees rather than a quantity. */
const MONEY_HINT = /amount|paid|due|total|discount|billed|collected|balance|rate|price|net|gross/i;

/** How wide to draw a column: the longest cell in it, within reason. */
const widthFor = (header: string, values: unknown[]) => {
  const longest = values.reduce<number>(
    (max, value) => Math.max(max, String(value ?? '').length),
    header.length
  );
  return Math.min(Math.max(longest + 2, 10), 60);
};

/**
 * `filename` is the stem - the date and the extension are added here, so every
 * export the centre produces is named the same way.
 */
export async function exportToExcel(
  filename: string,
  rows: Record<string, any>[],
  options: { sheetName?: string } = {}
): Promise<void> {
  if (!rows || !rows.length) return;

  // The union of every row's keys, in the order they are first met. Taking
  // the headers from the first row alone silently dropped whole columns
  // whenever a later row carried a field the first one did not.
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }

  // A column is written as numbers only when every value in it is one. Mixing
  // a stray "-" into a money column turns the whole column to text in Excel
  // and the total at the bottom silently reads zero.
  const numericColumns = new Set(
    headers.filter((header) =>
      rows.every((row) => {
        const value = row[header];
        if (value === null || value === undefined || value === '') return true;
        return typeof value === 'number' && Number.isFinite(value);
      })
    )
  );

  const headerRow: Row = headers.map((header) => ({
    value: header,
    fontWeight: 'bold' as const,
    backgroundColor: '#f1f5f9',
    align: 'left' as const,
    wrap: true,
  }));

  const bodyRows: Row[] = rows.map((row) =>
    headers.map((header): Cell => {
      const value = row[header];

      // A blank is written as no cell at all, rather than as 0 or "-". A
      // zero that was never collected would be added into the column's
      // total, a dash would turn the whole column to text, and an empty
      // valued cell leaves Excel offering to repair the file.
      if (value === null || value === undefined || value === '') return null;

      if (numericColumns.has(header)) {
        return {
          type: Number,
          value: Number(value),
          format: MONEY_HINT.test(header) ? '#,##0.00' : '#,##0',
        };
      }

      return { type: String, value: String(value) };
    })
  );

  const columns = headers.map((header) => ({
    width: widthFor(
      header,
      rows.map((row) => row[header])
    ),
  }));

  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  await writeXlsxFile([headerRow, ...bodyRows], {
    // The header stays put while the accountant scrolls a year of bills.
    stickyRowsCount: 1,
    sheet: options.sheetName || 'Export',
    columns,
  }).toFile(`${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
}
