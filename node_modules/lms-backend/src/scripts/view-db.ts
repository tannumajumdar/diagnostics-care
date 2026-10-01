/**
 * Looks at what is stored in the database straight from the terminal - no
 * server, no browser, no Prisma Studio on localhost.
 *
 * Reads only. Every query runs inside a READ ONLY transaction, so nothing can
 * be written back even by a typo in --sql.
 *
 *   npm run db:view                                   # every table with its row count
 *   npm run db:view -- patients                       # latest 20 rows of a table
 *   npm run db:view -- patients --limit=100           # more rows
 *   npm run db:view -- patients --search=rahul        # rows where any text column matches
 *   npm run db:view -- patients --where=gender=Male   # exact column match (repeatable)
 *   npm run db:view -- patients --cols=uhid,patientName,mobile
 *   npm run db:view -- patients --describe            # the table's columns and types
 *   npm run db:view -- patients --json                # JSON instead of a table
 *   npm run db:view -- patients --csv > patients.csv  # save it for a sheet
 *   npm run db:view -- --export=db-dump               # every table to db-dump/<table>.csv
 *   npm run db:view -- --sql="SELECT status, COUNT(*) FROM appointments GROUP BY status"
 *
 * Table names can be given loosely - "patient", "Patient" and "patients" all
 * find the same table. Passwords, tokens and stored file bytes are masked.
 */
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { prisma, describeDatabase, Tx } from '../db/prisma';

dotenv.config();

const SCHEMA = new URL(process.env.DATABASE_URL || 'postgresql://x/x').searchParams.get('schema') || 'public';
const SECRET_COLUMNS = /^(password|refreshToken|refresh_token|payerToken|payer_token)$/i;

const argValue = (name: string): string | undefined => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const argValues = (name: string): string[] =>
  process.argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.slice(name.length + 3));
const hasFlag = (name: string) => process.argv.includes(`--${name}`);
const positional = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

type Column = { name: string; type: string; nullable: boolean };

/** Runs fn inside a read-only transaction so the viewer can never write. */
const readOnly = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
  prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return fn(tx as Tx);
    },
    { timeout: 120_000 }
  );

const listTables = (tx: Tx) =>
  tx
    .$queryRawUnsafe<{ table_name: string }[]>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1 AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'
        ORDER BY table_name`,
      SCHEMA
    )
    .then((rows) => rows.map((r) => r.table_name));

const listColumns = (tx: Tx, table: string) =>
  tx
    .$queryRawUnsafe<{ column_name: string; data_type: string; udt_name: string; is_nullable: string }[]>(
      `SELECT column_name, data_type, udt_name, is_nullable FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      SCHEMA,
      table
    )
    .then((rows) =>
      rows.map<Column>((r) => ({
        name: r.column_name,
        type: r.data_type === 'USER-DEFINED' || r.data_type === 'ARRAY' ? r.udt_name : r.data_type,
        nullable: r.is_nullable === 'YES',
      }))
    );

/** Matches "patient", "Patient", "patients", "test_parameters" to a real table name. */
const resolveTable = (tables: string[], wanted: string): string | undefined => {
  const norm = (s: string) => s.toLowerCase().replace(/[_\s-]/g, '');
  const w = norm(wanted);
  return (
    tables.find((t) => t === wanted) ||
    tables.find((t) => norm(t) === w) ||
    tables.find((t) => norm(t) === `${w}s` || norm(t) === `${w}es` || `${norm(t)}s` === w)
  );
};

/** One cell as plain text: dates as ISO, JSON compact, bytes and secrets masked. */
const cellText = (column: string, value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (SECRET_COLUMNS.test(column)) return '***';
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return `<${value.length} bytes>`;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'object') {
    // Prisma.Decimal prints its own value; arrays and JSON go out as JSON.
    if (typeof (value as any).toFixed === 'function' && (value as any).constructor?.name === 'Decimal')
      return String(value);
    return JSON.stringify(value);
  }
  return String(value);
};

const csvCell = (value: string): string =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const toCsv = (columns: string[], rows: Record<string, unknown>[]) =>
  [columns.map(csvCell).join(','), ...rows.map((r) => columns.map((c) => csvCell(cellText(c, r[c]))).join(','))].join(
    '\n'
  ) + '\n';

const toJson = (rows: Record<string, unknown>[]) =>
  JSON.stringify(
    rows.map((r) =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          v === null || typeof v === 'number' || typeof v === 'boolean' ? v : cellText(k, v),
        ])
      )
    ),
    null,
    2
  );

/**
 * Prints rows as a grid when they fit the terminal, otherwise one block per
 * row (like psql's \x) so wide tables stay readable.
 */
const printRows = (columns: string[], rows: Record<string, unknown>[]) => {
  if (!rows.length) {
    console.log('(no rows)');
    return;
  }
  const MAX = 40;
  const clip = (s: string) => {
    const flat = s.replace(/\s+/g, ' ');
    return flat.length > MAX ? `${flat.slice(0, MAX - 1)}…` : flat;
  };
  const cells = rows.map((r) => columns.map((c) => clip(cellText(c, r[c]))));
  const widths = columns.map((c, i) => Math.max(c.length, ...cells.map((row) => row[i].length)));
  const total = widths.reduce((a, w) => a + w + 3, 0);
  const termWidth = process.stdout.columns || 160;

  if (total <= termWidth) {
    const line = (vals: string[]) => vals.map((v, i) => v.padEnd(widths[i])).join(' | ');
    console.log(line(columns));
    console.log(widths.map((w) => '-'.repeat(w)).join('-+-'));
    cells.forEach((row) => console.log(line(row)));
    return;
  }

  const labelWidth = Math.max(...columns.map((c) => c.length));
  rows.forEach((r, n) => {
    console.log(`-[ row ${n + 1} ]${'-'.repeat(Math.max(0, labelWidth - 6))}`);
    columns.forEach((c) => {
      const text = cellText(c, r[c]);
      console.log(`${c.padEnd(labelWidth)} | ${text.length > 300 ? `${text.slice(0, 299)}…` : text}`);
    });
  });
};

const showOverview = async (tx: Tx) => {
  const tables = await listTables(tx);
  const counts: { table: string; rows: number }[] = [];
  for (const t of tables) {
    const [{ n }] = await tx.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*) AS n FROM ${quoteIdent(t)}`);
    counts.push({ table: t, rows: Number(n) });
  }
  const w = Math.max(5, ...tables.map((t) => t.length));
  console.log(`${'TABLE'.padEnd(w)}  ROWS`);
  console.log(`${'-'.repeat(w)}  ${'-'.repeat(8)}`);
  counts.forEach((c) => console.log(`${c.table.padEnd(w)}  ${c.rows}`));
  console.log(`\n${tables.length} tables, ${counts.reduce((a, c) => a + c.rows, 0)} rows in all.`);
  console.log('Next: npm run db:view -- <table>   (see the top of src/scripts/view-db.ts for every option)');
};

const showTable = async (tx: Tx, table: string) => {
  const columns = await listColumns(tx, table);

  if (hasFlag('describe')) {
    printRows(
      ['column', 'type', 'nullable'],
      columns.map((c) => ({ column: c.name, type: c.type, nullable: c.nullable ? 'yes' : 'no' }))
    );
    return;
  }

  const known = new Set(columns.map((c) => c.name));
  const pickColumn = (name: string) => {
    const hit = columns.find((c) => c.name === name) || columns.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (!hit) throw new Error(`"${table}" has no column "${name}". Columns: ${[...known].join(', ')}`);
    return hit.name;
  };

  const shown = argValue('cols') ? argValue('cols')!.split(',').map((c) => pickColumn(c.trim())) : columns.map((c) => c.name);
  const limit = Math.max(1, Number(argValue('limit') ?? 20) || 20);

  const where: string[] = [];
  const params: unknown[] = [];
  for (const cond of argValues('where')) {
    const eq = cond.indexOf('=');
    if (eq < 1) throw new Error(`--where needs column=value, got "${cond}"`);
    const col = pickColumn(cond.slice(0, eq));
    params.push(cond.slice(eq + 1));
    where.push(`${quoteIdent(col)}::text = $${params.length}`);
  }
  const search = argValue('search');
  if (search) {
    const textCols = columns.filter((c) => /char|text|uuid/i.test(c.type) && !SECRET_COLUMNS.test(c.name));
    if (textCols.length) {
      params.push(`%${search}%`);
      where.push(`(${textCols.map((c) => `${quoteIdent(c.name)}::text ILIKE $${params.length}`).join(' OR ')})`);
    }
  }

  // Newest first when the table keeps a timestamp, so recent entries show up top.
  const orderCol = ['createdAt', 'created_at', 'updatedAt', 'updated_at'].find((c) => known.has(c));
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const [{ n }] = await tx.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT COUNT(*) AS n FROM ${quoteIdent(table)} ${whereSql}`,
    ...params
  );
  const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${shown.map(quoteIdent).join(', ')} FROM ${quoteIdent(table)} ${whereSql}
      ${orderCol ? `ORDER BY ${quoteIdent(orderCol)} DESC` : ''} LIMIT ${limit}`,
    ...params
  );

  if (hasFlag('json')) return void console.log(toJson(rows));
  if (hasFlag('csv')) return void process.stdout.write(toCsv(shown, rows));

  printRows(shown, rows);
  console.log(
    `\nShowing ${rows.length} of ${Number(n)} row(s) from "${table}"${orderCol ? `, newest ${orderCol} first` : ''}.`
  );
};

const runSql = async (tx: Tx, sql: string) => {
  const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(sql);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  if (hasFlag('json')) return void console.log(toJson(rows));
  if (hasFlag('csv')) return void process.stdout.write(toCsv(columns, rows));
  printRows(columns, rows);
  console.log(`\n${rows.length} row(s).`);
};

const exportAll = async (tx: Tx, dir: string, only?: string) => {
  const tables = only ? [only] : await listTables(tx);
  fs.mkdirSync(dir, { recursive: true });
  for (const t of tables) {
    const columns = (await listColumns(tx, t)).map((c) => c.name);
    const rows = await tx.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM ${quoteIdent(t)}`);
    const file = path.join(dir, `${t}.csv`);
    fs.writeFileSync(file, toCsv(columns, rows));
    console.log(`${String(rows.length).padStart(8)} rows -> ${file}`);
  }
  console.log(`\nExported ${tables.length} table(s) to ${path.resolve(dir)}`);
};

const run = async () => {
  const quiet = hasFlag('json') || hasFlag('csv');
  if (!quiet) console.log(`Connected to ${describeDatabase()} (schema: ${SCHEMA})\n`);

  await readOnly(async (tx) => {
    const sql = argValue('sql');
    if (sql) return runSql(tx, sql);

    let table: string | undefined;
    if (positional[0]) {
      const tables = await listTables(tx);
      table = resolveTable(tables, positional[0]);
      if (!table) throw new Error(`No table like "${positional[0]}". Tables: ${tables.join(', ')}`);
    }

    const exportDir = argValue('export');
    if (exportDir) return exportAll(tx, exportDir, table);
    if (table) return showTable(tx, table);
    return showOverview(tx);
  });

  await prisma.$disconnect();
};

run().catch(async (err) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  await prisma.$disconnect();
  process.exit(1);
});
