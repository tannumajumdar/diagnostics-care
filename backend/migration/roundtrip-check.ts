/**
 * Proves the mappers: for every document, the JSON Mongoose would have sent
 * must equal what `toDoc` builds from the row in Postgres.
 *
 *   npx ts-node --transpile-only migration/roundtrip-check.ts [mongoDb]
 *
 * Run it after mongo-to-postgres.ts has loaded the same Mongo database. Each
 * document is compared twice - against the hydrated Mongoose document (what a
 * `.find()` route sent) and the raw `.lean()` one - since those differ on a
 * field the stored document never had: hydration fills the schema default,
 * lean leaves it out. Postgres always has the default, so a field that only
 * the lean side lacks is reported as "default filled", separately from real
 * differences.
 */
import mongoose from 'mongoose';
import { PrismaClient } from '@prisma/client';
import { toDoc, childInclude, ModelName } from '../src/db/mappers';
import { User } from './legacy-models/user.model';
import { RolePermission } from './legacy-models/rolePermission.model';
import { AuditLog } from './legacy-models/auditLog.model';
import { Department } from './legacy-models/department.model';
import { Doctor } from './legacy-models/doctor.model';
import { Organization } from './legacy-models/organization.model';
import { LabTest } from './legacy-models/test.model';
import { TestAttachment } from './legacy-models/testAttachment.model';
import { TestPackage } from './legacy-models/package.model';
import { RateHistory } from './legacy-models/rateHistory.model';
import { RefundPolicy } from './legacy-models/refundPolicy.model';
import { Patient } from './legacy-models/patient.model';
import { Appointment } from './legacy-models/appointment.model';
import { Invoice } from './legacy-models/invoice.model';
import { Payment } from './legacy-models/payment.model';
import { PaymentTransaction } from './legacy-models/paymentTransaction.model';
import { Refund } from './legacy-models/refund.model';
import { Expense } from './legacy-models/expense.model';
import { Sample } from './legacy-models/sample.model';
import { Result } from './legacy-models/result.model';
import { SavedReport } from './legacy-models/savedReport.model';

const mongoDb = process.argv[2] || 'lms_db';
const prisma = new PrismaClient();

const MODELS: [mongoose.Model<any>, ModelName][] = [
  [User, 'user'],
  [RolePermission, 'rolePermission'],
  [AuditLog, 'auditLog'],
  [Department, 'department'],
  [Doctor, 'doctor'],
  [Organization, 'organization'],
  [LabTest, 'labTest'],
  [TestAttachment, 'testAttachment'],
  [TestPackage, 'testPackage'],
  [RateHistory, 'rateHistory'],
  [RefundPolicy, 'refundPolicy'],
  [Patient, 'patient'],
  [Appointment, 'appointment'],
  [Invoice, 'invoice'],
  [Payment, 'payment'],
  [PaymentTransaction, 'paymentTransaction'],
  [Refund, 'refund'],
  [Expense, 'expense'],
  [Sample, 'sample'],
  [Result, 'result'],
  [SavedReport, 'savedReport'],
];

/** What JSON.stringify makes of a value, with Mongo's bookkeeping `__v` dropped. */
const normalise = (value: any): any =>
  JSON.parse(JSON.stringify(value, (key, v) => (key === '__v' ? undefined : v)));

/** Every leaf path that differs between two JSON values. */
function diff(a: any, b: any, path = ''): { path: string; a: any; b: any }[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  const bothObjects = a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b);
  if (!bothObjects) return [{ path: path || '(root)', a, b }];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap((k) => diff(a[k], b[k], path ? `${path}.${k}` : k));
}

(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${mongoDb}`);
  let real = 0;

  for (const [Model, name] of MODELS) {
    const select = Object.keys(Model.schema.paths)
      .filter((p) => (Model.schema.paths[p] as any).options?.select === false)
      .map((p) => `+${p}`)
      .join(' ');
    const hydrated = await Model.find().select(select).sort({ _id: 1 });
    const lean = await Model.find().select(select).sort({ _id: 1 }).lean();
    const omit: any = { user: { password: false, refreshToken: false }, paymentTransaction: { payerToken: false }, savedReport: { data: false }, testAttachment: { data: false } }[name as string];
    const rows = await (prisma as any)[name].findMany({ include: childInclude(name), omit, orderBy: { id: 'asc' } });
    const byId = new Map(rows.map((r: any) => [r.id, r]));

    const defaultFilled = new Map<string, number>();
    const differences = new Map<string, { count: number; example: string }>();

    hydrated.forEach((doc: any, i: number) => {
      const row = byId.get(String(doc._id));
      if (!row) {
        differences.set('(row missing)', { count: (differences.get('(row missing)')?.count || 0) + 1, example: String(doc._id) });
        return;
      }
      const fromPg = normalise(toDoc(name, row));
      const fromHydrated = normalise(doc.toJSON());
      const fromLean = normalise(lean[i]);

      const leanDiffs = new Set(diff(fromLean, fromPg).map((d) => d.path));
      for (const d of diff(fromHydrated, fromPg)) {
        const key = d.path.replace(/\.\d+(?=\.|$)/g, '[]');
        const entry = differences.get(key) || { count: 0, example: '' };
        entry.count++;
        entry.example ||= `${doc._id}: mongoose=${JSON.stringify(d.a)?.slice(0, 80)} postgres=${JSON.stringify(d.b)?.slice(0, 80)}`;
        differences.set(key, entry);
      }
      for (const path of leanDiffs) {
        const key = path.replace(/\.\d+(?=\.|$)/g, '[]');
        if (!differences.has(key)) defaultFilled.set(key, (defaultFilled.get(key) || 0) + 1);
      }
    });

    const status = differences.size ? 'DIFFERS' : 'ok';
    console.log(`\n${name} (${hydrated.length}) ${status}`);
    for (const [path, { count, example }] of differences) {
      real++;
      console.log(`  ✗ ${path} x${count}  e.g. ${example}`);
    }
    if (defaultFilled.size) {
      console.log(`  default filled (absent in .lean() only): ${[...defaultFilled.keys()].join(', ')}`);
    }
  }

  console.log(real ? `\n${real} field(s) differ.` : '\nEvery document round-trips.');
  await mongoose.disconnect();
  await prisma.$disconnect();
  process.exitCode = real ? 1 : 0;
})();
