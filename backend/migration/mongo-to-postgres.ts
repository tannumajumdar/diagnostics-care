/**
 * Copies every collection of a Mongo database into the (empty, migrated)
 * Postgres database named by DATABASE_URL.
 *
 *   npx ts-node --transpile-only migration/mongo-to-postgres.ts [mongoDb] [--check]
 *
 * mongoDb defaults to lms_db. `--check` reads everything and reports what
 * would not load - references to documents that no longer exist, mostly -
 * without writing a row.
 *
 * Ids carry over unchanged, so every link the frontend holds stays valid.
 * The row shapes come from src/db/mappers.ts, the same description the app
 * reads its responses back through.
 *
 * Mongo never enforced a reference; Postgres does. A ref that points at
 * nothing is reported, and the run stops before writing, so nothing is
 * silently dropped. Decide what each one should be, fix it in Mongo, and run
 * again.
 */
import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import { fromDoc, ModelName, specOf } from '../src/db/mappers';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const mongoDb = args.find((a) => !a.startsWith('--')) || 'lms_db';
const mongoHost = process.env.MONGO_HOST || 'mongodb://127.0.0.1:27017';

const prisma = new PrismaClient();
const BATCH = 1000;

/** Collection -> model, in an order where every referenced row already exists. */
const ORDER: [string, ModelName][] = [
  ['users', 'user'],
  ['rolepermissions', 'rolePermission'],
  ['auditlogs', 'auditLog'],
  ['counters', 'counter'],
  ['departments', 'department'],
  ['organizations', 'organization'],
  ['doctors', 'doctor'],
  ['labtests', 'labTest'],
  ['testattachments', 'testAttachment'],
  ['testpackages', 'testPackage'],
  ['ratehistories', 'rateHistory'],
  ['refundpolicies', 'refundPolicy'],
  ['patients', 'patient'],
  ['appointments', 'appointment'],
  ['invoices', 'invoice'],
  ['payments', 'payment'],
  ['paymenttransactions', 'paymentTransaction'],
  ['refunds', 'refund'],
  ['expenses', 'expense'],
  ['samples', 'sample'],
  ['results', 'result'],
  ['savedreports', 'savedReport'],
];

/** Prisma delegate names for the child/join tables each model's nested creates land in. */
const TABLE_OF_REL: Record<string, Record<string, string>> = {
  labTest: { parameters: 'testParameter' },
  testPackage: { tests: 'testPackageItem' },
  appointment: { tests: 'appointmentTest' },
  invoice: { items: 'invoiceItem', paymentBreakdown: 'invoicePaymentSplit', revisions: 'invoiceRevision' },
  sample: { statusHistory: 'sampleStatusHistory' },
  result: { results: 'resultParameter', versions: 'resultVersion' },
};
const PARENT_COL: Record<string, string> = {
  labTest: 'testId',
  testPackage: 'packageId',
  appointment: 'appointmentId',
  invoice: 'invoiceId',
  sample: 'sampleId',
  result: 'resultId',
};

/** JSON columns get what Mongoose's toJSON would have produced: ids and dates as strings. */
const JSON_FIELDS: Partial<Record<string, string[]>> = {
  user: ['permissions'],
  auditLog: ['details'],
  refundPolicy: ['stages'],
  resultVersion: ['results'],
};
const plainJson = (value: any): any => JSON.parse(JSON.stringify(value ?? null));

/** Foreign-key columns per table, and the table they must point into. */
const FKS: Record<string, [string, string][]> = {
  doctor: [['departmentId', 'department'], ['addedById', 'user']],
  labTest: [['departmentId', 'department'], ['tpaId', 'organization'], ['reportTemplateAttachmentId', 'testAttachment']],
  testParameter: [],
  testAttachment: [['testId', 'labTest'], ['uploadedById', 'user']],
  testPackage: [['departmentId', 'department']],
  testPackageItem: [['testId', 'labTest']],
  rateHistory: [['testId', 'labTest'], ['changedById', 'user']],
  patient: [['referringDoctorId', 'doctor'], ['organizationId', 'organization']],
  appointment: [['patientId', 'patient'], ['doctorId', 'doctor']],
  appointmentTest: [['testId', 'labTest']],
  invoice: [
    ['patientId', 'patient'],
    ['referringDoctorId', 'doctor'],
    ['organizationId', 'organization'],
    ['discountDoctorId', 'doctor'],
    ['createdById', 'user'],
  ],
  invoiceItem: [['testId', 'labTest'], ['departmentId', 'department'], ['packageId', 'testPackage']],
  payment: [['invoiceId', 'invoice'], ['patientId', 'patient'], ['receivedById', 'user']],
  paymentTransaction: [
    ['invoiceId', 'invoice'],
    ['patientId', 'patient'],
    ['paymentId', 'payment'],
    ['initiatedById', 'user'],
  ],
  refund: [['invoiceId', 'invoice'], ['patientId', 'patient']],
  expense: [['patientId', 'patient'], ['invoiceId', 'invoice'], ['doctorId', 'doctor']],
  sample: [
    ['patientId', 'patient'],
    ['invoiceId', 'invoice'],
    ['testId', 'labTest'],
    ['departmentId', 'department'],
    ['rejectedById', 'user'],
  ],
  sampleStatusHistory: [['updatedById', 'user']],
  result: [
    ['patientId', 'patient'],
    ['invoiceId', 'invoice'],
    ['sampleId', 'sample'],
    ['testId', 'labTest'],
    ['departmentId', 'department'],
  ],
  savedReport: [['resultId', 'result'], ['patientId', 'patient'], ['invoiceId', 'invoice']],
};

(async () => {
  const conn = await mongoose.createConnection(`${mongoHost}/${mongoDb}`).asPromise();
  const db = conn.db!;
  const existing = new Set((await db.listCollections().toArray()).map((c) => c.name));

  // Build every row first, so references can be checked before anything is written.
  const tables = new Map<string, any[]>();
  const push = (table: string, row: any) => {
    if (!tables.has(table)) tables.set(table, []);
    tables.get(table)!.push(row);
  };

  for (const [collection, model] of ORDER) {
    if (!existing.has(collection)) continue;
    // Natural order - no sort - so insertOrder is numbered the way Mongo
    // returned these documents to a query without a sort, and broke ties.
    const docs = await db.collection(collection).find().toArray();
    for (const doc of docs) {
      const row = fromDoc(model, doc);
      for (const field of JSON_FIELDS[model] || []) if (field in row) row[field] = plainJson(row[field]);

      for (const [rel, childTable] of Object.entries(TABLE_OF_REL[model] || {})) {
        const nested = row[rel];
        delete row[rel];
        for (const child of nested?.create || []) {
          for (const field of JSON_FIELDS[childTable] || []) if (field in child) child[field] = plainJson(child[field]);
          push(childTable, { ...child, [PARENT_COL[model]]: row.id });
        }
      }
      push(model, row);
    }
  }

  // Report references that point at nothing.
  const ids = new Map<string, Set<string>>();
  for (const [table, rows] of tables) ids.set(table, new Set(rows.map((r) => r.id).filter(Boolean)));

  const problems: string[] = [];
  for (const [table, rows] of tables) {
    for (const [col, target] of FKS[table] || []) {
      const known = ids.get(target) || new Set<string>();
      for (const row of rows) {
        const value = row[col];
        if (value && !known.has(value)) {
          problems.push(`${table}${row.id ? ` ${row.id}` : ''}: ${col} -> missing ${target} ${value}`);
        }
      }
    }
  }

  for (const [table, rows] of tables) console.log(`${table}: ${rows.length}`);

  if (problems.length) {
    console.error(`\n${problems.length} reference(s) point at rows that do not exist:`);
    for (const p of problems) console.error(`  ${p}`);
    console.error('\nNothing was written.');
    process.exitCode = 1;
  } else if (checkOnly) {
    console.log('\nCheck passed - every reference resolves. Nothing was written (--check).');
  } else {
    // A test's report template points at an attachment, which points back at
    // the test: load the tests without it and set it once the attachments exist.
    const templates = (tables.get('labTest') || [])
      .filter((r) => r.reportTemplateAttachmentId)
      .map((r) => ({ id: r.id, attachmentId: r.reportTemplateAttachmentId, updatedAt: r.updatedAt }));
    for (const r of tables.get('labTest') || []) r.reportTemplateAttachmentId = null;

    const LOAD_ORDER = [
      'user', 'rolePermission', 'auditLog', 'counter', 'department', 'organization', 'doctor',
      'labTest', 'testParameter', 'testAttachment', 'testPackage', 'testPackageItem', 'rateHistory',
      'refundPolicy', 'patient', 'appointment', 'appointmentTest', 'invoice', 'invoiceItem',
      'invoicePaymentSplit', 'invoiceRevision', 'payment', 'paymentTransaction', 'refund', 'expense',
      'sample', 'sampleStatusHistory', 'result', 'resultParameter', 'resultVersion', 'savedReport',
    ];

    await prisma.$transaction(
      async (tx: any) => {
        for (const table of LOAD_ORDER) {
          const rows = tables.get(table) || [];
          for (let i = 0; i < rows.length; i += BATCH) {
            await tx[table].createMany({ data: rows.slice(i, i + BATCH) });
          }
        }
        for (const t of templates) {
          // updatedAt passed through, or Prisma would stamp the load time on it.
          await tx.labTest.update({
            where: { id: t.id },
            data: { reportTemplateAttachmentId: t.attachmentId, updatedAt: t.updatedAt },
          });
        }
      },
      { timeout: 10 * 60 * 1000 }
    );
    console.log('\nLoaded into Postgres.');
  }

  await conn.close();
  await prisma.$disconnect();
})().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
