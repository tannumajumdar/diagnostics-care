/**
 * The handful of document operations the services were written against -
 * `findById`, `create`, `findByIdAndUpdate`, `doc.save()` - done on Postgres,
 * taking and returning the same document shapes.
 *
 * Reads return documents built by `toDoc`; writes take a document-shaped
 * object, run it through the Mongoose rules (rules.ts) and store it through
 * `fromDoc`. Queries themselves are ordinary Prisma `where` / `orderBy`
 * objects on the table's columns.
 */
import { Prisma } from '@prisma/client';
import { prisma, Tx, OMITTED } from './prisma';
import { toDoc, fromDoc, childInclude, specOf, ownFields, ModelName } from './mappers';
import { prepareForSave, prepareForUpdate, strict } from './rules';
import { assertObjectId, CastError } from './ids';
import { ApiError } from '../utils/api-error.util';

type Client = Tx | typeof prisma;

/**
 * Mongo's natural order. A query with no sort returned documents in the order
 * they were inserted, and a sort left tied documents in that order too.
 */
export const NATURAL = { insertOrder: 'asc' as const };

const delegate = (db: Client, model: ModelName): any => (db as any)[model];

/** The document field a column stores (`departmentId` -> `department`). */
const fieldOf = (model: ModelName, column: string) =>
  Object.entries(specOf(model).refs || {}).find(([, r]) => r.col === column)?.[0] ?? column;

const CHECK_VIOLATION = /violates check constraint \\?"[A-Za-z]+_(\w+)_check\\?"/;

/**
 * Turns a constraint failure into the error the desk should see.
 *
 * - unique: reshaped as the duplicate-key error Mongo threw (`code: 11000`,
 *   `keyValue`), so errorHandler words it as before: "<value> is already used
 *   by another record (<field>)".
 * - foreign key / check: Mongo stored a dangling ref, or an out-of-list value
 *   sent through an update, without complaint; Postgres refuses both. Answered
 *   as a 400 naming the field - for a bad value, in the words Mongoose used for
 *   a bad enum on create.
 */
function translateDbError(error: unknown, model: ModelName, doc: any): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const target = (error.meta?.target as string[] | string | undefined) ?? [];
    const field = fieldOf(model, Array.isArray(target) ? target[0] : String(target));
    return Object.assign(new Error(`E11000 duplicate key error: ${field}`), {
      code: 11000,
      keyValue: field ? { [field]: doc?.[field] } : {},
    });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
    const constraint = String(error.meta?.constraint ?? error.meta?.field_name ?? '');
    const field = fieldOf(model, constraint.replace(/^[A-Za-z]+_/, '').replace(/_fkey$/, ''));
    return new ApiError(400, `No ${field} exists with id "${doc?.[field] ?? ''}"`);
  }
  const check = CHECK_VIOLATION.exec(String((error as any)?.message ?? ''));
  if (check) {
    const field = check[1];
    return new ApiError(400, `\`${doc?.[field]}\` is not a valid enum value for path \`${field}\`.`);
  }
  return error;
}

/** Relation name -> the model it loads, per model, read off the mapper specs. */
function relationTargets(model: ModelName): Record<string, { model?: ModelName; via?: { rel: string; model: ModelName } }> {
  const spec = specOf(model);
  const out: Record<string, { model?: ModelName; via?: { rel: string; model: ModelName } }> = {};
  for (const r of Object.values(spec.refs || {})) out[r.rel] = { model: r.model };
  for (const w of spec.whos || []) for (const r of Object.values(w.rel || {})) out[r.rel] = { model: r.model };
  for (const c of spec.children || []) out[c.rel] = { model: c.model };
  for (const l of spec.refLists || []) out[l.rel] = { via: l.target };
  return out;
}

/**
 * A Prisma `include` that also loads the child tables of every relation it
 * reaches. A populated document came with its embedded arrays - a populated
 * sample carried its statusHistory, a populated invoice its items - so a
 * relation loaded here brings its child rows too.
 */
function deepInclude(model: ModelName, include?: Record<string, any>): Record<string, any> | undefined {
  const merged: Record<string, any> = { ...(childInclude(model) || {}), ...(include || {}) };
  const targets = relationTargets(model);
  for (const [rel, value] of Object.entries(merged)) {
    const target = targets[rel];
    if (!target) continue;
    if (target.via) {
      // A join table: deepen whatever it loads on the far side.
      const inner = value?.include?.[target.via.rel];
      if (inner !== undefined) {
        merged[rel] = {
          ...value,
          include: { ...value.include, [target.via.rel]: deepen(target.via.model, inner) },
        };
      }
      continue;
    }
    merged[rel] = deepen(target.model!, value);
  }
  return Object.keys(merged).length ? merged : undefined;
}

function deepen(model: ModelName, value: any): any {
  if (value === true) {
    const inner = deepInclude(model);
    return inner ? { include: inner } : true;
  }
  // An explicit `select` is a `.populate(path, 'a b c')`: just those fields.
  if (value && typeof value === 'object' && value.include) return { ...value, include: deepInclude(model, value.include) };
  return value;
}

/** Include every child table plus whatever relations the caller wants loaded. */
const withChildren = (model: ModelName, include?: Record<string, any>) => deepInclude(model, include);

/**
 * The nested writes that replace a document's embedded arrays wholesale, the
 * way assigning `doc.items = [...]` and saving did.
 */
function replaceChildren(model: ModelName, row: any) {
  const spec = specOf(model);
  for (const rel of [...(spec.children || []), ...(spec.refLists || [])].map((c) => c.rel)) {
    if (row[rel]?.create) row[rel] = { deleteMany: {}, create: row[rel].create };
  }
  return row;
}

export interface FindOptions {
  include?: Record<string, any>;
  omit?: Record<string, boolean>;
  db?: Client;
}

export interface WriteOptions extends FindOptions {
  /**
   * Runs on the validated document just before it is written - the place a
   * Mongoose `pre('save')` hook ran, after validation (hashing a password).
   */
  transform?: (doc: any) => void | Promise<void>;
}

export const repo = {
  /** `Model.findById(id)`: a malformed id is a CastError, a missing one is null. */
  async findById(model: ModelName, id: unknown, opts: FindOptions = {}) {
    const key = assertObjectId(id);
    const row = await delegate(opts.db || prisma, model).findUnique({
      where: { id: key },
      include: withChildren(model, opts.include),
      omit: opts.omit,
    });
    return row ? toDoc(model, row) : null;
  },

  /** `Model.findOne(where)`: with no sort, the first match in natural order. */
  async findOne(model: ModelName, where: any, opts: FindOptions & { orderBy?: any } = {}) {
    const row = await delegate(opts.db || prisma, model).findFirst({
      where,
      orderBy: opts.orderBy ?? NATURAL,
      include: withChildren(model, opts.include),
      omit: opts.omit,
    });
    return row ? toDoc(model, row) : null;
  },

  async find(
    model: ModelName,
    args: { where?: any; orderBy?: any; skip?: number; take?: number } & FindOptions = {}
  ) {
    const rows = await delegate(args.db || prisma, model).findMany({
      where: args.where,
      orderBy: args.orderBy ?? NATURAL,
      skip: args.skip || undefined,
      take: args.take || undefined,
      include: withChildren(model, args.include),
      omit: args.omit,
    });
    return rows.map((row: any) => toDoc(model, row));
  },

  count(model: ModelName, where?: any, db: Client = prisma): Promise<number> {
    return delegate(db, model).count({ where });
  },

  /** `Model.create(doc)`: defaults, casting, cleaning and validation, then the insert. */
  async create(model: ModelName, doc: any, opts: WriteOptions = {}) {
    const clean = prepareForSave(model, strict(model, ownFields(doc)));
    await opts.transform?.(clean);
    try {
      const row = await delegate(opts.db || prisma, model).create({
        data: fromDoc(model, clean),
        include: withChildren(model, opts.include),
        omit: opts.omit,
      });
      return toDoc(model, row);
    } catch (error) {
      throw translateDbError(error, model, clean);
    }
  },

  /**
   * `Model.findByIdAndUpdate(id, set, { new: true })`: cast and cleaned but
   * not validated, as Mongoose did it. Null when there is no such row.
   */
  async updateById(model: ModelName, id: unknown, set: any, opts: FindOptions & { runValidators?: boolean } = {}) {
    const key = assertObjectId(id);
    const clean = prepareForUpdate(model, strict(model, ownFields(set)), { runValidators: opts.runValidators });
    delete clean._id;
    try {
      const row = await delegate(opts.db || prisma, model).update({
        where: { id: key },
        data: replaceChildren(model, fromDoc(model, clean, { undefinedAsNull: true })),
        include: withChildren(model, opts.include),
        omit: opts.omit,
      });
      return toDoc(model, row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
      throw translateDbError(error, model, clean);
    }
  },

  /**
   * `doc.save()` on a document read earlier and changed in place: validated
   * as a whole, then written back, embedded arrays included.
   */
  async save(model: ModelName, doc: any, opts: WriteOptions = {}) {
    const notLoaded = Object.keys(OMITTED[model] || {}).filter((f) => !(f in doc));
    const clean = prepareForSave(model, strict(model, ownFields(doc)), notLoaded);
    await opts.transform?.(clean);
    const data = replaceChildren(model, fromDoc(model, clean, { undefinedAsNull: true }));
    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;
    try {
      const row = await delegate(opts.db || prisma, model).update({
        where: { id: doc._id },
        data,
        include: withChildren(model, opts.include),
        omit: opts.omit,
      });
      return toDoc(model, row);
    } catch (error) {
      throw translateDbError(error, model, clean);
    }
  },

  async deleteById(model: ModelName, id: unknown, db: Client = prisma) {
    const key = assertObjectId(id);
    try {
      const row = await delegate(db, model).delete({ where: { id: key } });
      return toDoc(model, row);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') return null;
      throw error;
    }
  },
};

const REGEX_META = /[\\^$.|?*+()[\]{}]/;

/**
 * JavaScript / PCRE spellings Postgres writes differently: a word boundary is
 * `\y` there (`\b` means backspace), its negation `\Y`.
 */
const toPostgresRegex = (source: string) => source.replace(/\\b/g, '\\y').replace(/\\B/g, '\\Y');

/** Quotes a Prisma model name or column as a Postgres identifier. */
const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const TABLE = (model: string) => ident(model[0].toUpperCase() + model.slice(1));

/**
 * The Postgres reading of a Mongo `$regex` filter on one column, as a Prisma
 * `where` fragment.
 *
 * Text without regex characters - what the search boxes send nearly always -
 * becomes a case-insensitive `contains`, which matches exactly the rows the
 * regex did. Anything else is run as a real Postgres regex (`~` / `~*`), so a
 * pattern typed into a search box behaves as it did against Mongo.
 *
 * `column` may reach into a child table (`parameters.shortName`): the match is
 * then "any child row matches", as Mongo's array-path queries were.
 */
export async function regexWhere(
  model: ModelName,
  column: string,
  pattern: string | RegExp,
  caseInsensitive = true
): Promise<any> {
  const source = typeof pattern === 'string' ? pattern : pattern.source;
  const insensitive = typeof pattern === 'string' ? caseInsensitive : pattern.flags.includes('i');

  const [first, rest] = column.split('.', 2);
  const child = rest ? [...(specOf(model).children || [])].find((c) => c.rel === first) : undefined;

  if (!REGEX_META.test(source)) {
    const contains = { contains: source, ...(insensitive ? { mode: 'insensitive' as const } : {}) };
    return child ? { [first]: { some: { [rest]: contains } } } : { [column]: contains };
  }

  const op = insensitive ? '~*' : '~';
  const regex = toPostgresRegex(source);
  if (child) {
    const parentCol = { labTest: 'testId', invoice: 'invoiceId', sample: 'sampleId', result: 'resultId' }[model as string];
    const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT DISTINCT ${ident(parentCol!)} AS id FROM ${TABLE(child.model)} WHERE ${ident(rest)} ${op} $1`,
      regex
    );
    return { id: { in: rows.map((r) => r.id) } };
  }
  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM ${TABLE(model)} WHERE ${ident(column)} ${op} $1`,
    regex
  );
  return { id: { in: rows.map((r) => r.id) } };
}

/** `$or` of `$regex` clauses over several columns, as one Prisma `OR`. */
export async function regexAny(model: ModelName, columns: string[], pattern: string | RegExp, caseInsensitive = true) {
  return { OR: await Promise.all(columns.map((c) => regexWhere(model, c, pattern, caseInsensitive))) };
}

/** Which columns may hold NULL, per Prisma model - read off the generated client. */
const NULLABLE = new Map<string, Set<string>>(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name[0].toLowerCase() + m.name.slice(1),
    new Set(m.fields.filter((f) => f.kind === 'scalar' && !f.isRequired).map((f) => f.name)),
  ])
);

/**
 * A Mongo `.sort()` as a Prisma `orderBy`.
 *
 * Mongo puts a missing value first when sorting up and last when sorting
 * down; Postgres does the opposite unless told. And rows that tie keep the
 * order they were inserted in - Mongo's natural order, kept as insertOrder.
 *
 *   mongoSort('doctor', { commission: -1 })
 */
export function mongoSort(model: ModelName, sort: Record<string, 1 | -1>): any[] {
  const nullable = NULLABLE.get(model) || new Set<string>();
  const order: any[] = Object.entries(sort).map(([field, dir]) => {
    const direction = dir === 1 ? 'asc' : 'desc';
    return {
      [field]: nullable.has(field) ? { sort: direction, nulls: dir === 1 ? 'first' : 'last' } : direction,
    };
  });
  if (!('id' in sort) && !('_id' in sort)) order.push(NATURAL);
  return order;
}

/**
 * An id used as a query filter on a ref path. Mongoose cast it and refused a
 * malformed one with a CastError ("\"x\" is not a valid department", 400)
 * rather than matching nothing.
 */
export const refFilter = (value: unknown, path: string): string => assertObjectId(String(value), path);

/** A date used in a filter; an unparseable one was a CastError too. */
export function dateFilter(value: Date, path: string): Date {
  if (Number.isNaN(value.getTime())) throw new CastError('Invalid Date', path);
  return value;
}
