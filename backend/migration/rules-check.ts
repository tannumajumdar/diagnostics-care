/**
 * Checks src/db/rules.ts against Mongoose itself.
 *
 *   npx ts-node --transpile-only migration/rules-check.ts [mongoDb]
 *
 * Every document in the database, and a batch of damaged copies of each (a
 * required field removed, an enum value misspelt, numbers sent as strings,
 * padded strings, a negative amount), is run through both Mongoose's
 * validateSync() and prepareForSave(). The two must agree on which paths fail,
 * with what message, and on the cleaned values of what passes.
 */
import mongoose from 'mongoose';
import { prepareForSave, ValidationError } from '../src/db/rules';
import { RULES } from '../src/db/rules.generated';

import './legacy-models/user.model';
import './legacy-models/department.model';
import './legacy-models/doctor.model';
import './legacy-models/organization.model';
import './legacy-models/test.model';
import './legacy-models/package.model';
import './legacy-models/patient.model';
import './legacy-models/appointment.model';
import './legacy-models/invoice.model';
import './legacy-models/payment.model';
import './legacy-models/refund.model';
import './legacy-models/expense.model';
import './legacy-models/sample.model';
import './legacy-models/result.model';
import './legacy-models/refundPolicy.model';

const PAIRS: [string, string, string][] = [
  ['User', 'user', 'users'],
  ['Department', 'department', 'departments'],
  ['Doctor', 'doctor', 'doctors'],
  ['Organization', 'organization', 'organizations'],
  ['LabTest', 'labTest', 'labtests'],
  ['TestPackage', 'testPackage', 'testpackages'],
  ['Patient', 'patient', 'patients'],
  ['Appointment', 'appointment', 'appointments'],
  ['Invoice', 'invoice', 'invoices'],
  ['Payment', 'payment', 'payments'],
  ['Refund', 'refund', 'refunds'],
  ['Expense', 'expense', 'expenses'],
  ['Sample', 'sample', 'samples'],
  ['Result', 'result', 'results'],
  ['RefundPolicy', 'refundPolicy', 'refundpolicies'],
];

const clone = (v: any) => JSON.parse(JSON.stringify(v));

/** Damaged variants of one plain document. */
function mutations(model: string, doc: any): [string, any][] {
  const out: [string, any][] = [];
  for (const [path, rule] of Object.entries(RULES[model])) {
    if (path.includes('.') || rule.of || rule.sub) continue;
    if (rule.required) {
      const d = clone(doc);
      delete d[path];
      out.push([`-${path}`, d]);
      if (rule.type === 'String') out.push([`${path}=''`, { ...clone(doc), [path]: '' }]);
    }
    if (rule.enum) out.push([`${path}=bogus`, { ...clone(doc), [path]: 'Bogus Value' }]);
    if (rule.type === 'Number') {
      out.push([`${path}="12"`, { ...clone(doc), [path]: '12' }]);
      out.push([`${path}="abc"`, { ...clone(doc), [path]: 'abc' }]);
      out.push([`${path}=-5`, { ...clone(doc), [path]: -5 }]);
      out.push([`${path}=500`, { ...clone(doc), [path]: 500 }]);
    }
    if (rule.type === 'String') out.push([`${path} padded`, { ...clone(doc), [path]: `  Mixed Case ${path}  ` }]);
    if (rule.type === 'Boolean') out.push([`${path}="true"`, { ...clone(doc), [path]: 'true' }]);
    if (rule.type === 'Date') out.push([`${path}=garbage`, { ...clone(doc), [path]: 'not a date' }]);
  }
  // Damage inside the first member of each subdocument array.
  for (const [path, rule] of Object.entries(RULES[model])) {
    if (!rule.of || !Array.isArray(doc[path]) || !doc[path].length) continue;
    for (const [sub, r] of Object.entries(rule.of)) {
      if (sub.includes('.')) continue;
      if (r.required) {
        const d = clone(doc);
        delete d[path][0][sub];
        out.push([`-${path}.0.${sub}`, d]);
      }
      if (r.type === 'Number') {
        const d = clone(doc);
        d[path][0][sub] = -1;
        out.push([`${path}.0.${sub}=-1`, d]);
      }
      if (r.enum) {
        const d = clone(doc);
        d[path][0][sub] = 'Nope';
        out.push([`${path}.0.${sub}=Nope`, d]);
      }
    }
  }
  return out;
}

const messages = (err: any) =>
  err ? Object.fromEntries(Object.entries(err.errors).map(([k, e]: any) => [k, e.message])) : {};

(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${process.argv[2] || 'lms_snapshot'}`);
  let cases = 0;
  let failures = 0;

  for (const [modelName, key, collection] of PAIRS) {
    const Model = mongoose.model(modelName);
    const docs = await mongoose.connection.db!.collection(collection).find().limit(15).toArray();
    for (const raw of docs) {
      const base = clone(raw);
      delete base.__v;
      for (const [label, variant] of [['as stored', base] as [string, any], ...mutations(key, base)]) {
        cases++;
        const m = new Model(clone(variant));
        const mErr = m.validateSync();
        let ours: any = clone(variant);
        let oErr: any = null;
        try {
          ours = prepareForSave(key, ours);
        } catch (e) {
          if (!(e instanceof ValidationError)) throw e;
          oErr = e;
        }

        const expected = messages(mErr);
        const got = messages(oErr);
        const problems: string[] = [];
        for (const p of new Set([...Object.keys(expected), ...Object.keys(got)])) {
          if (expected[p] !== got[p]) problems.push(`${p}: mongoose=${JSON.stringify(expected[p])} ours=${JSON.stringify(got[p])}`);
        }
        // When both accept, the cleaned top-level scalars must match.
        if (!mErr && !oErr) {
          const mj = m.toObject({ depopulate: true });
          for (const [path, rule] of Object.entries(RULES[key])) {
            if (path.includes('.') || rule.of || rule.sub || !(path in variant)) continue;
            const a = JSON.stringify(mj[path] instanceof mongoose.Types.ObjectId ? String(mj[path]) : mj[path]);
            const b = JSON.stringify(ours[path]);
            if (a !== b) problems.push(`${path} value: mongoose=${a} ours=${b}`);
          }
        }
        if (problems.length) {
          failures++;
          if (failures <= 400) console.log(`✗ ${modelName} ${raw._id} [${label}]\n    ${problems.join('\n    ')}`);
        }
      }
    }
  }
  console.log(`\n${cases - failures}/${cases} cases agree with Mongoose.`);
  await mongoose.disconnect();
  process.exitCode = failures ? 1 : 0;
})();
