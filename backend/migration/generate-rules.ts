/**
 * Writes src/db/rules.generated.ts from the Mongoose schemas in src/models.
 *
 *   npx ts-node --transpile-only migration/generate-rules.ts
 *
 * A Mongoose model did more than store a document. It cast what it was given
 * ("5" -> 5), cleaned it (trim, uppercase, lowercase) and refused it with a
 * readable message when a required field was missing or a value was outside
 * its enum or range - and the error handler sends those messages to the
 * screen. Prisma does none of that, so the rules are lifted out of the
 * schemas, verbatim, into data that src/db/rules.ts applies before a write.
 *
 * Generated once, while the Mongoose models still exist; the file it writes is
 * what the app keeps.
 */
import fs from 'fs';
import path from 'path';
import { Schema } from 'mongoose';

import './legacy-models/user.model';
import './legacy-models/rolePermission.model';
import './legacy-models/auditLog.model';
import './legacy-models/department.model';
import './legacy-models/doctor.model';
import './legacy-models/organization.model';
import './legacy-models/test.model';
import './legacy-models/testAttachment.model';
import './legacy-models/package.model';
import './legacy-models/rateHistory.model';
import './legacy-models/refundPolicy.model';
import './legacy-models/patient.model';
import './legacy-models/appointment.model';
import './legacy-models/invoice.model';
import './legacy-models/payment.model';
import './legacy-models/paymentTransaction.model';
import './legacy-models/refund.model';
import './legacy-models/expense.model';
import './legacy-models/sample.model';
import './legacy-models/result.model';
import './legacy-models/savedReport.model';
import mongoose from 'mongoose';

const MODELS: Record<string, string> = {
  User: 'user',
  RolePermission: 'rolePermission',
  AuditLog: 'auditLog',
  Department: 'department',
  Doctor: 'doctor',
  Organization: 'organization',
  LabTest: 'labTest',
  TestAttachment: 'testAttachment',
  TestPackage: 'testPackage',
  RateHistory: 'rateHistory',
  RefundPolicy: 'refundPolicy',
  Patient: 'patient',
  Appointment: 'appointment',
  Invoice: 'invoice',
  Payment: 'payment',
  PaymentTransaction: 'paymentTransaction',
  Refund: 'refund',
  Expense: 'expense',
  Sample: 'sample',
  Result: 'result',
  SavedReport: 'savedReport',
};

interface Rule {
  type: string;
  required?: string | true;
  enum?: { values: string[]; message?: string };
  min?: [number, string?];
  max?: [number, string?];
  trim?: true;
  uppercase?: true;
  lowercase?: true;
  /** Rules for the members of an array of subdocuments. */
  of?: Record<string, Rule>;
  /** Rules for a single nested subdocument. */
  sub?: Record<string, Rule>;
  /** Element type of an array of scalars. */
  item?: string;
  /**
   * What Mongoose filled in when the path was missing. `{ now: true }` is
   * `Date.now`, taken at write time; anything else is a JSON value, copied
   * fresh for each document.
   */
  default?: { now: true } | { value: any };
}

/** `enum: [...]` is just the values; only `enum: { values, message }` carries a message. */
const enumMessage = (e: any): string | undefined =>
  e && !Array.isArray(e) && typeof e === 'object' ? e.message : undefined;

const messageOf = (v: any): string | undefined => (Array.isArray(v) ? v[1] : typeof v === 'object' && v ? v.message : undefined);

function rulesOf(schema: Schema): Record<string, Rule> {
  const out: Record<string, Rule> = {};
  schema.eachPath((p, type: any) => {
    if (p === '_id' || p === '__v' || p === 'createdAt' || p === 'updatedAt') return;
    const o = type.options || {};
    const rule: Rule = { type: type.instance };

    if (o.required) rule.required = messageOf(o.required) || true;
    if ('default' in o && o.default !== undefined) {
      if (o.default === Date.now) rule.default = { now: true };
      else if (typeof o.default === 'function') rule.default = { value: JSON.parse(JSON.stringify(o.default() ?? null)) };
      else rule.default = { value: o.default };
    } else if (type.instance === 'Array' && !('default' in o)) {
      // An array path Mongoose started out as [] unless told otherwise.
      rule.default = { value: [] };
    }
    const enumValues = type.enumValues?.length ? type.enumValues : undefined;
    if (enumValues) rule.enum = { values: enumValues, message: enumMessage(o.enum) };
    if (o.min !== undefined) rule.min = Array.isArray(o.min) ? [o.min[0], o.min[1]] : [o.min];
    if (o.max !== undefined) rule.max = Array.isArray(o.max) ? [o.max[0], o.max[1]] : [o.max];
    if (o.trim) rule.trim = true;
    if (o.uppercase) rule.uppercase = true;
    if (o.lowercase) rule.lowercase = true;

    if (type.schema) {
      if (type.$isMongooseDocumentArray) rule.of = rulesOf(type.schema);
      else rule.sub = rulesOf(type.schema);
    } else if (type.instance === 'Array' && type.caster) {
      const c = type.caster;
      rule.item = c.instance;
      const co = c.options || {};
      if (co.trim) rule.trim = true;
      if (c.enumValues?.length) rule.enum = { values: c.enumValues, message: enumMessage(co.enum) };
    }
    out[p] = rule;
  });
  return out;
}

const all: Record<string, Record<string, Rule>> = {};
for (const [modelName, key] of Object.entries(MODELS)) {
  all[key] = rulesOf(mongoose.model(modelName).schema);
}

const target = path.join(__dirname, '../src/db/rules.generated.ts');
fs.writeFileSync(
  target,
  `/* Generated by migration/generate-rules.ts from the Mongoose schemas. Do not edit by hand. */\n` +
    `import type { Rule } from './rules';\n\n` +
    `export const RULES: Record<string, Record<string, Rule>> = ${JSON.stringify(all, null, 2)};\n`
);
console.log(`Wrote ${target}`);
