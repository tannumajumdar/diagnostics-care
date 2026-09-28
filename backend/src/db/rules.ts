/**
 * What the Mongoose schemas did to a document before it was stored, done the
 * same way before a Prisma write.
 *
 * - cast: "5" to 5, "true" to true, an ISO string to a Date - or refuse it
 * - clean: trim, uppercase, lowercase
 * - validate: required, enum, min, max - with Mongoose's own messages, since
 *   the error handler shows them to the desk as they are
 *
 * The rules themselves are generated from the old schemas
 * (rules.generated.ts), so nothing here was retyped by hand.
 *
 * Mongoose ran the validators on `create` and `save`, but not on
 * `findByIdAndUpdate` (it only cast and cleaned there), so the two modes below
 * keep that difference.
 */
import { RULES } from './rules.generated';
import { inspect } from 'util';
import { isObjectId, idOf, CastError } from './ids';

export interface Rule {
  type: string;
  required?: string | true;
  enum?: { values: string[]; message?: string };
  min?: [number, string?];
  max?: [number, string?];
  trim?: true;
  uppercase?: true;
  lowercase?: true;
  of?: Record<string, Rule>;
  sub?: Record<string, Rule>;
  item?: string;
  default?: { now: true } | { value: any };
}

/** Shaped like Mongoose's, so errorHandler reads it the same way. */
export class ValidationError extends Error {
  name = 'ValidationError';
  constructor(public errors: Record<string, { message: string; path: string; value?: any }>) {
    super(Object.values(errors).map((e) => e.message).join(', '));
  }
}

class Cast {
  constructor(public kind: string, public value: any) {}
}

/** Mongoose's getValueType: the primitive type, or the object's constructor name. */
const typeName = (v: any) =>
  v == null ? String(v) : typeof v !== 'object' ? typeof v : typeof v.constructor === 'function' ? v.constructor.name : 'object';

/** Mongoose's getStringValue: util.inspect, with the quotes made double. */
const stringValue = (v: any) => {
  let s = inspect(v).replace(/^'|'$/g, '"');
  if (!s.startsWith('"')) s = `"${s}"`;
  return s;
};

function cast(type: string, value: any): any {
  if (value === null || value === undefined) return value;
  switch (type) {
    case 'String':
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (value instanceof Date) return value.toString();
      if (value._bsontype || (value._id && isObjectId(idOf(value)))) return idOf(value);
      return new Cast('string', value);
    case 'Number': {
      if (typeof value === 'number') return Number.isNaN(value) ? new Cast('Number', value) : value;
      if (typeof value === 'boolean') return value ? 1 : 0;
      if (typeof value === 'string') {
        if (value.trim() === '') return null;
        const n = Number(value);
        return Number.isNaN(n) ? new Cast('Number', value) : n;
      }
      return new Cast('Number', value);
    }
    case 'Boolean':
      if (typeof value === 'boolean') return value;
      if ([true, 'true', 1, '1', 'yes'].includes(value)) return true;
      if ([false, 'false', 0, '0', 'no'].includes(value)) return false;
      return new Cast('Boolean', value);
    case 'Date': {
      if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Cast('date', value) : value;
      if (typeof value === 'string' && value.trim() === '') return null;
      const d = new Date(typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value);
      return Number.isNaN(d.getTime()) ? new Cast('date', value) : d;
    }
    case 'ObjectId': {
      const id = idOf(value);
      return id && isObjectId(id) ? id.toLowerCase() : new Cast('ObjectId', value);
    }
    default:
      return value;
  }
}

function clean(rule: Rule, value: any): any {
  if (typeof value !== 'string') return value;
  let v = value;
  if (rule.trim) v = v.trim();
  if (rule.lowercase) v = v.toLowerCase();
  if (rule.uppercase) v = v.toUpperCase();
  return v;
}

const present = (type: string, v: any) =>
  !(v === null || v === undefined || (type === 'String' && v === '') || (type === 'Array' && false));

type Errors = Record<string, { message: string; path: string; value?: any }>;

/**
 * `path` is where the error is filed (`items.0.rate`); `local` is what the
 * message names - Mongoose words a subdocument's error by the subdocument's
 * own path (`rate`).
 */
function check(rule: Rule, path: string, value: any, errors: Errors, local = path) {
  if (rule.required && !present(rule.type, value)) {
    errors[path] = {
      path,
      message: rule.required === true ? `Path \`${local}\` is required.` : rule.required,
    };
    return;
  }
  if (value === null || value === undefined) return;
  if (rule.enum && rule.type === 'String' && !rule.enum.values.includes(value)) {
    errors[path] = {
      path,
      value,
      message: rule.enum.message || `\`${value}\` is not a valid enum value for path \`${local}\`.`,
    };
  }
  if (rule.min && typeof value === 'number' && value < rule.min[0]) {
    errors[path] = {
      path,
      value,
      message: rule.min[1] || `Path \`${local}\` (${value}) is less than minimum allowed value (${rule.min[0]}).`,
    };
  }
  if (rule.max && typeof value === 'number' && value > rule.max[0]) {
    errors[path] = {
      path,
      value,
      message: rule.max[1] || `Path \`${local}\` (${value}) is more than maximum allowed value (${rule.max[0]}).`,
    };
  }
}

const copy = (v: any) => (v === null || typeof v !== 'object' ? v : JSON.parse(JSON.stringify(v)));

/** Fills every missing path that has a default, nested paths included. */
function applyDefaults(rules: Record<string, Rule>, obj: any) {
  for (const [path, rule] of Object.entries(rules)) {
    if (!rule.default) continue;
    const parts = path.split('.');
    let parent = obj;
    for (const p of parts.slice(0, -1)) {
      if (parent[p] === undefined) parent[p] = {};
      parent = parent[p];
      if (parent === null || typeof parent !== 'object') break;
    }
    if (parent === null || typeof parent !== 'object') continue;
    const key = parts[parts.length - 1];
    if (parent[key] === undefined) parent[key] = 'now' in rule.default ? new Date() : copy(rule.default.value);
  }
}

/**
 * Mongoose's CastError wording (lib/error/cast.js). An ObjectId that will not
 * parse also names the bson error behind it.
 */
const castMessage = (c: Cast, path: string) =>
  `Cast to ${c.kind} failed for value ${stringValue(c.value)} (type ${typeName(c.value)}) at path "${path}"` +
  (c.kind === 'ObjectId' ? ' because of "BSONError"' : '');

/** One member of an array that would not cast: reported against the whole array (lib/schema/array.js). */
const arrayCastMessage = (c: Cast, list: any[], path: string) =>
  `Cast to [${c.kind}] failed for value ${stringValue(inspect(list))} (type string) at path "${path}" because of "CastError"`;

/**
 * Walks a document-shaped object (nested paths like `createdBy.name` read
 * from their nested objects), casting and cleaning in place.
 *
 * `validate` false = cast and clean only, for the paths the object carries.
 */
function walk(
  rules: Record<string, Rule>,
  obj: any,
  prefix: string,
  validate: boolean,
  errors: Errors,
  onlyPresent = false
) {
  // Mongoose filled defaults in before it validated, so a missing field with
  // a default never failed `required`. Only on a full save - an update left
  // absent fields alone.
  if (validate && !onlyPresent) applyDefaults(rules, obj);

  for (const [path, rule] of Object.entries(rules)) {
    const parts = path.split('.');
    let parent = obj;
    for (const p of parts.slice(0, -1)) {
      if (parent === null || parent === undefined || typeof parent !== 'object') {
        parent = undefined;
        break;
      }
      parent = parent[p];
    }
    const key = parts[parts.length - 1];
    const full = prefix + path;
    const has = parent && typeof parent === 'object' && key in parent;
    let value = has ? parent[key] : undefined;

    if (has) {
      if (rule.of && Array.isArray(value)) {
        value.forEach((member: any, i: number) => {
          if (member && typeof member === 'object') walk(rule.of!, member, `${full}.${i}.`, validate, errors);

        });
      } else if (rule.sub && value && typeof value === 'object') {
        walk(rule.sub, value, `${full}.`, validate, errors);
      } else if (rule.type === 'Array' && rule.item) {
        if (value !== null && value !== undefined) {
          const list = Array.isArray(value) ? value : [value];
          parent[key] = list.map((item: any, i: number) => {
            const c = cast(rule.item!, item);
            if (c instanceof Cast) {
              errors[full] = { path: full, value: list, message: arrayCastMessage(c, list, `${full}.${i}`) };
              return item;
            }
            const cleaned = clean(rule, c);
            if (validate && rule.enum && cleaned !== null && !rule.enum.values.includes(cleaned)) {
              errors[`${full}.${i}`] = {
                path: `${full}.${i}`,
                value: cleaned,
                message: rule.enum.message || `\`${cleaned}\` is not a valid enum value for path \`${full}.${i}\`.`,
              };
            }
            return cleaned;
          });
        }
      } else if (!rule.of && !rule.sub) {
        const c = cast(rule.type, value);
        if (c instanceof Cast) {
          errors[full] = { path: full, value, message: castMessage(c, full) };
          continue;
        }
        value = clean(rule, c);
        parent[key] = value;
      }
    }

    // An update's validators looked only at the paths the update set.
    if (onlyPresent && !has) continue;
    if (validate && !rule.of && !rule.sub && !(rule.type === 'Array' && rule.item)) check(rule, full, value, errors, path);
  }
}

/**
 * Casts, cleans and validates a document-shaped object for a create or a
 * `save()` - what Mongoose did there. Throws a ValidationError naming every
 * failing path. Mutates and returns `doc`.
 */
export function prepareForSave<T extends Record<string, any>>(model: string, doc: T, notLoaded: string[] = []): T {
  const errors: Errors = {};
  // A path the document was read without (`select: false`) was not validated
  // by Mongoose either - it is not being written.
  const rules = notLoaded.length
    ? Object.fromEntries(Object.entries(RULES[model]).filter(([p]) => !notLoaded.includes(p)))
    : RULES[model];
  walk(rules, doc, '', true, errors);
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return doc;
}

/**
 * Casts and cleans the fields an update sets, without the validators - what
 * Mongoose's findByIdAndUpdate did by default. A value that cannot be cast is
 * still refused, as it was.
 */
export function prepareForUpdate<T extends Record<string, any>>(
  model: string,
  set: T,
  opts: { runValidators?: boolean } = {}
): T {
  const castErrors: Errors = {};
  walk(RULES[model], set, '', false, castErrors);
  // An update query cast its values before sending them; the first that
  // would not cast was thrown as a plain CastError, not a ValidationError.
  const first = Object.values(castErrors)[0];
  if (first) throw new CastError(first.value, first.path);

  // `{ runValidators: true }`: the validators of the paths being set.
  if (opts.runValidators) {
    const errors: Errors = {};
    walk(RULES[model], set, '', true, errors, true);
    if (Object.keys(errors).length) throw new ValidationError(errors);
  }
  return set;
}

/** Only the fields a Mongoose schema declared; anything else was dropped by strict mode. */
export function strict<T extends Record<string, any>>(model: string, doc: T): Partial<T> {
  const rules = RULES[model];
  const top = new Set(Object.keys(rules).map((p) => p.split('.')[0]));
  const out: any = {};
  for (const [k, v] of Object.entries(doc)) if (top.has(k) || k === '_id') out[k] = v;
  return out;
}

/**
 * A value for an equality filter on `path`, cleaned the way Mongoose cleaned
 * query values: a schema's trim / lowercase / uppercase ran on the filter too,
 * so `{ email: 'A@B.COM' }` found the account stored as `a@b.com`.
 */
export function queryValue(model: string, path: string, value: any): any {
  const rule = RULES[model]?.[path];
  if (!rule || typeof value !== 'string') return value;
  return clean(rule, value);
}
