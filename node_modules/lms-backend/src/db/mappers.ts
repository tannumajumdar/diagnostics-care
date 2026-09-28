/**
 * The one place that knows how a Mongo document and a Postgres row line up.
 *
 * Every model is described once, and the description is read both ways:
 *
 * - `toDoc(model, row)` turns a Prisma row (with whatever relations it was
 *   loaded with) back into the JSON the Mongoose model used to send - `_id`
 *   for `id`, `{ userId, name }` objects rebuilt from their flattened columns,
 *   child tables folded back into arrays, a loaded relation in the place a
 *   `.populate()` used to put it. The API's responses are built from this, so
 *   the frontend keeps receiving exactly the shape it was written against.
 *
 * - `fromDoc(model, doc)` goes the other way, into a Prisma create input. The
 *   Mongo -> Postgres data migration is built from it, and services use it to
 *   write a document-shaped payload.
 *
 * Mongoose left an unset optional field out of the JSON rather than sending
 * `null`, so `toDoc` drops nulls too - except on the few fields whose Mongoose
 * default was an explicit `null` (`nullKept`), which the frontend has always
 * received as null.
 */
import { Prisma } from '@prisma/client';
import { idOf } from './ids';

export type ModelName =
  | 'user'
  | 'rolePermission'
  | 'auditLog'
  | 'counter'
  | 'department'
  | 'doctor'
  | 'organization'
  | 'labTest'
  | 'testParameter'
  | 'testAttachment'
  | 'testPackage'
  | 'rateHistory'
  | 'refundPolicy'
  | 'patient'
  | 'appointment'
  | 'invoice'
  | 'invoiceItem'
  | 'invoicePaymentSplit'
  | 'invoiceRevision'
  | 'payment'
  | 'paymentTransaction'
  | 'refund'
  | 'expense'
  | 'sample'
  | 'sampleStatusHistory'
  | 'result'
  | 'resultParameter'
  | 'resultVersion'
  | 'savedReport';

/** A `{ userId, name, role }`-style object Mongoose kept inline, stored as prefixed columns. */
interface WhoSpec {
  doc: string;
  /** Sub-field on the Mongo object -> column on the row. */
  cols: Record<string, string>;
  /** Sub-fields that were `ref: 'User'`: the Prisma relation to read when it was loaded. */
  rel?: Record<string, { rel: string; model: ModelName }>;
}

interface RefSpec {
  col: string;
  rel: string;
  model: ModelName;
}

/** An embedded array Mongo kept on the document, now its own table. */
interface ChildSpec {
  doc: string;
  rel: string;
  model: ModelName;
}

/** An array of refs (`tests: [ObjectId]`), now a join table ordered by `position`. */
interface RefListSpec {
  doc: string;
  rel: string;
  /** Column on the join row holding the referenced id, and the relation to it. */
  col: string;
  target: { rel: string; model: ModelName };
}

interface ModelSpec {
  /** False for the rows that were `_id: false` subdocuments in Mongo. */
  hasId: boolean;
  scalars: string[];
  refs?: Record<string, RefSpec>;
  whos?: WhoSpec[];
  children?: ChildSpec[];
  refLists?: RefListSpec[];
  nullKept?: string[];
  /**
   * JSONB columns. Stored as the JSON Mongoose would have sent - ObjectIds and
   * Dates as strings - since that is how they were always read back.
   */
  json?: string[];
  /** Model-specific fields that do not fit the patterns above. */
  toDoc?: (row: any, doc: any) => void;
  fromDoc?: (doc: any, row: any) => void;
}

const TIMESTAMPS = ['createdAt', 'updatedAt'];

const ref = (col: string, rel: string, model: ModelName): RefSpec => ({ col, rel, model });

/**
 * `createdBy.userId` -> `createdById`, `createdBy.name` -> `createdByName`.
 * `stamp` names the column a timestamp sub-field (`at` / `date`) lands in.
 */
const who = (
  doc: string,
  prefix: string,
  fields: string[] = ['userId', 'name', 'role'],
  stamp = `${prefix}At`
): WhoSpec => {
  const cols: Record<string, string> = {};
  for (const field of fields) {
    cols[field] =
      field === 'userId'
        ? `${prefix}Id`
        : field === 'at' || field === 'date'
          ? stamp
          : `${prefix}${field[0].toUpperCase()}${field.slice(1)}`;
  }
  return { doc, cols };
};

/** A who-object whose `userId` was a real `ref: 'User'`. */
const whoUser = (doc: string, prefix: string, fields: string[], rel: string): WhoSpec => ({
  ...who(doc, prefix, fields),
  rel: { userId: { rel, model: 'user' } },
});

const SPECS: Record<ModelName, ModelSpec> = {
  user: {
    json: ['permissions'],
    hasId: true,
    scalars: [
      'name',
      'email',
      'password',
      'role',
      'mobile',
      'status',
      'refreshToken',
      'permissions',
      'sessionsValidFrom',
      ...TIMESTAMPS,
    ],
  },

  rolePermission: {
    hasId: true,
    scalars: ['role', 'permissions', ...TIMESTAMPS],
    whos: [
      {
        doc: 'updatedBy',
        cols: { userId: 'updatedById', name: 'updatedByName', at: 'updatedByAt' },
      },
    ],
  },

  auditLog: {
    json: ['details'],
    hasId: true,
    scalars: [
      'action',
      'module',
      'performedBy',
      'performedByName',
      'userRole',
      'ipAddress',
      'targetId',
      'details',
      'createdAt',
    ],
    fromDoc: (doc, row) => {
      // Mixed in Mongo; always a user id or a label in practice.
      row.performedBy = idOf(doc.performedBy) ?? '';
    },
  },

  counter: {
    hasId: false,
    scalars: ['name', 'seq'],
  },

  department: {
    hasId: true,
    scalars: ['departmentName', 'departmentCode', 'description', 'status', ...TIMESTAMPS],
  },

  doctor: {
    hasId: true,
    scalars: [
      'doctorName',
      'gender',
      'degree',
      'specialty',
      'mobile',
      'email',
      'dob',
      'area',
      'areaCode',
      'hospital',
      'paymentTerm',
      'discountType',
      'discountPercentage',
      'commission',
      'status',
      ...TIMESTAMPS,
    ],
    refs: {
      department: ref('departmentId', 'department', 'department'),
      addedBy: ref('addedById', 'addedBy', 'user'),
    },
  },

  organization: {
    hasId: true,
    scalars: [
      'organizationName',
      'contactPerson',
      'mobile',
      'email',
      'address',
      'city',
      'state',
      'gstNumber',
      'contractRate',
      'discount',
      'creditLimit',
      'paymentTerms',
      'status',
      ...TIMESTAMPS,
    ],
  },

  labTest: {
    hasId: true,
    scalars: [
      'testName',
      'testCode',
      'testType',
      'sampleType',
      'sampleContainer',
      'rate',
      'patientRate',
      'corporateRate',
      'doctorRate',
      'emergencyRate',
      'referralRate',
      'processingMode',
      'outsourceLab',
      'outsourceCost',
      'discountAllowed',
      'fastingRequired',
      'preparationRequired',
      'turnaroundTime',
      'interpretationTitle',
      'interpretation',
      'status',
      ...TIMESTAMPS,
    ],
    refs: {
      department: ref('departmentId', 'department', 'department'),
      tpa: ref('tpaId', 'tpa', 'organization'),
    },
    children: [{ doc: 'parameters', rel: 'parameters', model: 'testParameter' }],
    nullKept: ['tpa'],
    toDoc: (row, doc) => {
      if (row.reportTemplateAttachmentId === undefined) return;
      doc.reportTemplate = row.reportTemplateAttachmentId
        ? dropNulls({
            attachment: row.reportTemplateAttachmentId,
            fileName: row.reportTemplateFileName,
            size: row.reportTemplateSize,
            uploadedAt: row.reportTemplateUploadedAt,
            uploadedBy: row.reportTemplateUploadedBy,
          })
        : null;
    },
    fromDoc: (doc, row) => {
      if (doc.reportTemplate === undefined) return;
      const t = doc.reportTemplate;
      row.reportTemplateAttachmentId = t ? idOf(t.attachment) : null;
      row.reportTemplateFileName = t?.fileName ?? null;
      row.reportTemplateSize = t?.size ?? null;
      row.reportTemplateUploadedAt = t?.uploadedAt ?? null;
      row.reportTemplateUploadedBy = t?.uploadedBy ?? null;
    },
  },

  testParameter: {
    hasId: false,
    scalars: [
      'parameterName',
      'shortName',
      'unit',
      'maleReferenceRange',
      'femaleReferenceRange',
      'childReferenceRange',
      'criticalLow',
      'criticalHigh',
      'method',
      'resultType',
      'displayOrder',
      'paraFor',
      'minValue',
      'maxValue',
      'highRange',
      'lowRange',
      'ageFromDays',
      'ageToDays',
      'referenceText',
      'formula',
    ],
  },

  testAttachment: {
    hasId: true,
    scalars: ['fileName', 'mimeType', 'size', 'data', 'kind', ...TIMESTAMPS],
    refs: { test: ref('testId', 'test', 'labTest') },
    whos: [whoUser('uploadedBy', 'uploadedBy', ['userId', 'name'], 'uploadedBy')],
  },

  testPackage: {
    hasId: true,
    scalars: [
      'packageName',
      'packageCode',
      'description',
      'rate',
      'referralRate',
      'discountAllowed',
      'status',
      ...TIMESTAMPS,
    ],
    refs: { department: ref('departmentId', 'department', 'department') },
    refLists: [{ doc: 'tests', rel: 'tests', col: 'testId', target: { rel: 'test', model: 'labTest' } }],
  },

  rateHistory: {
    hasId: true,
    scalars: ['testCode', 'testName', 'reason', ...TIMESTAMPS],
    refs: { test: ref('testId', 'test', 'labTest') },
    whos: [whoUser('changedBy', 'changedBy', ['userId', 'name'], 'changedBy')],
    toDoc: (row, doc) => {
      const rates = (prefix: string) =>
        dropNulls({
          rate: fromDecimal(row[`${prefix}Rate`]),
          patientRate: fromDecimal(row[`${prefix}PatientRate`]),
          corporateRate: fromDecimal(row[`${prefix}CorporateRate`]),
          doctorRate: fromDecimal(row[`${prefix}DoctorRate`]),
          emergencyRate: fromDecimal(row[`${prefix}EmergencyRate`]),
          referralRate: fromDecimal(row[`${prefix}ReferralRate`]),
        });
      doc.previousRates = rates('prev');
      doc.newRates = rates('new');
    },
    fromDoc: (doc, row) => {
      const rates = (prefix: string, r: any = {}) => {
        row[`${prefix}Rate`] = r.rate;
        row[`${prefix}PatientRate`] = r.patientRate;
        row[`${prefix}CorporateRate`] = r.corporateRate;
        row[`${prefix}DoctorRate`] = r.doctorRate;
        row[`${prefix}EmergencyRate`] = r.emergencyRate;
        row[`${prefix}ReferralRate`] = r.referralRate ?? null;
      };
      rates('prev', doc.previousRates);
      rates('new', doc.newRates);
    },
  },

  refundPolicy: {
    json: ['stages'],
    hasId: true,
    scalars: [
      'singleton',
      'enabled',
      'stages',
      'cancellationFee',
      'refundWindowDays',
      'fullRefundOnLabRejection',
      'allowAdminOverride',
      'policyNote',
      ...TIMESTAMPS,
    ],
    whos: [who('updatedBy', 'updatedBy', ['userId', 'name', 'role', 'at'])],
  },

  patient: {
    hasId: true,
    scalars: [
      'uhid',
      'patientName',
      'gender',
      'dateOfBirth',
      'age',
      'mobile',
      'address',
      'city',
      'state',
      'pinCode',
      'emergencyContact',
      'registrationDate',
      'status',
      ...TIMESTAMPS,
    ],
    refs: {
      referringDoctor: ref('referringDoctorId', 'referringDoctor', 'doctor'),
      organization: ref('organizationId', 'organization', 'organization'),
    },
  },

  appointment: {
    hasId: true,
    scalars: [
      'appointmentId',
      'patientName',
      'mobile',
      'date',
      'time',
      'collectionType',
      'address',
      'status',
      'notes',
      ...TIMESTAMPS,
    ],
    refs: {
      patient: ref('patientId', 'patient', 'patient'),
      doctor: ref('doctorId', 'doctor', 'doctor'),
    },
    whos: [
      {
        doc: 'phlebotomist',
        cols: { userId: 'phlebotomistUserId', name: 'phlebotomistName', mobile: 'phlebotomistMobile' },
      },
    ],
    refLists: [{ doc: 'tests', rel: 'tests', col: 'testId', target: { rel: 'test', model: 'labTest' } }],
  },

  invoice: {
    hasId: true,
    scalars: [
      'invoiceNumber',
      'enquiryNo',
      'uhid',
      'referringDoctorName',
      'chiefComplaint',
      'clinicalNotes',
      'priority',
      'subtotal',
      'discountType',
      'discountValue',
      'discountReason',
      'discountDoctorName',
      'netAmount',
      'referralTotal',
      'paidAmount',
      'dueAmount',
      'paymentStatus',
      'paymentMethod',
      'barcode',
      ...TIMESTAMPS,
    ],
    refs: {
      patient: ref('patientId', 'patient', 'patient'),
      referringDoctor: ref('referringDoctorId', 'referringDoctor', 'doctor'),
      organization: ref('organizationId', 'organization', 'organization'),
      discountDoctor: ref('discountDoctorId', 'discountDoctor', 'doctor'),
    },
    whos: [whoUser('createdBy', 'createdBy', ['userId', 'name'], 'createdBy')],
    children: [
      { doc: 'items', rel: 'items', model: 'invoiceItem' },
      { doc: 'paymentBreakdown', rel: 'paymentBreakdown', model: 'invoicePaymentSplit' },
      { doc: 'revisions', rel: 'revisions', model: 'invoiceRevision' },
    ],
  },

  invoiceItem: {
    hasId: false,
    scalars: [
      'testCode',
      'testName',
      'departmentName',
      'rate',
      'lineDiscountAmount',
      'discountAmount',
      'netAmount',
      'processingMode',
      'outsourceLab',
      'referralRate',
      'packageName',
      'cancelled',
      'cancelledAt',
      'cancellationReason',
      'refundedAmount',
      'retainedAmount',
    ],
    refs: {
      test: ref('testId', 'test', 'labTest'),
      department: ref('departmentId', 'department', 'department'),
      packageId: ref('packageId', 'package', 'testPackage'),
    },
    whos: [who('cancelledBy', 'cancelledBy')],
  },

  invoicePaymentSplit: {
    hasId: false,
    scalars: ['method', 'amount'],
  },

  invoiceRevision: {
    hasId: false,
    scalars: ['at', 'summary', 'testsAdded', 'netBefore', 'netAfter'],
    whos: [{ doc: 'by', cols: { userId: 'byUserId', name: 'byName', role: 'byRole' } }],
  },

  payment: {
    hasId: true,
    scalars: ['receiptNumber', 'amount', 'paymentMethod', 'transactionRef', 'notes', ...TIMESTAMPS],
    refs: {
      invoice: ref('invoiceId', 'invoice', 'invoice'),
      patient: ref('patientId', 'patient', 'patient'),
    },
    whos: [whoUser('receivedBy', 'receivedBy', ['userId', 'name'], 'receivedBy')],
  },

  paymentTransaction: {
    hasId: true,
    scalars: [
      'txnId',
      'amount',
      'method',
      'status',
      'vpa',
      'upiIntent',
      'utr',
      'cardLast4',
      'cardNetwork',
      'authCode',
      'rrn',
      'payerToken',
      'failureReason',
      'expiresAt',
      'completedAt',
      ...TIMESTAMPS,
    ],
    refs: {
      invoice: ref('invoiceId', 'invoice', 'invoice'),
      patient: ref('patientId', 'patient', 'patient'),
      payment: ref('paymentId', 'payment', 'payment'),
    },
    whos: [whoUser('initiatedBy', 'initiatedBy', ['userId', 'name'], 'initiatedBy')],
  },

  refund: {
    hasId: true,
    scalars: [
      'refundId',
      'originalAmount',
      'refundAmount',
      'reason',
      'paymentMethod',
      'date',
      'remarks',
      ...TIMESTAMPS,
    ],
    refs: {
      invoice: ref('invoiceId', 'invoice', 'invoice'),
      patient: ref('patientId', 'patient', 'patient'),
    },
    whos: [who('approvedBy', 'approvedBy')],
  },

  expense: {
    hasId: true,
    scalars: [
      'expenseId',
      'payeeType',
      'payeeName',
      'payeeContact',
      'category',
      'description',
      'amount',
      'paymentMethod',
      'referenceNo',
      'expenseDate',
      'status',
      'needsApproval',
      'rejectionReason',
      'receiptUrl',
      ...TIMESTAMPS,
    ],
    refs: {
      patient: ref('patientId', 'patient', 'patient'),
      invoice: ref('invoiceId', 'invoice', 'invoice'),
      doctor: ref('doctorId', 'doctor', 'doctor'),
    },
    whos: [who('recordedBy', 'recordedBy'), who('approvedBy', 'approvedBy', ['userId', 'name', 'role', 'at'], 'approvedAt')],
  },

  sample: {
    hasId: true,
    scalars: [
      'sampleId',
      'barcode',
      'uhid',
      'enquiryNo',
      'testCode',
      'testName',
      'sampleType',
      'sampleContainer',
      'processingMode',
      'outsourceLab',
      'collectionDate',
      'collectionTime',
      'collector',
      'status',
      'priority',
      'chiefComplaint',
      'rejectionReason',
      'rejectionRemarks',
      'rejectedAt',
      'cancelledAt',
      'cancellationReason',
      'receivedAt',
      'processingAt',
      'completedAt',
      'expectedAt',
      'recollectionCount',
      ...TIMESTAMPS,
    ],
    refs: {
      patient: ref('patientId', 'patient', 'patient'),
      invoice: ref('invoiceId', 'invoice', 'invoice'),
      test: ref('testId', 'test', 'labTest'),
      department: ref('departmentId', 'department', 'department'),
    },
    whos: [whoUser('rejectedBy', 'rejectedBy', ['userId', 'name'], 'rejectedBy')],
    children: [{ doc: 'statusHistory', rel: 'statusHistory', model: 'sampleStatusHistory' }],
  },

  sampleStatusHistory: {
    hasId: false,
    scalars: ['fromStatus', 'toStatus', 'timestamp', 'notes'],
    whos: [whoUser('updatedBy', 'updatedBy', ['userId', 'name', 'role'], 'updatedBy')],
  },

  result: {
    hasId: true,
    scalars: [
      'resultId',
      'uhid',
      'enquiryNo',
      'status',
      'overallRemarks',
      'rejectionReason',
      ...TIMESTAMPS,
    ],
    refs: {
      patient: ref('patientId', 'patient', 'patient'),
      invoice: ref('invoiceId', 'invoice', 'invoice'),
      sample: ref('sampleId', 'sample', 'sample'),
      test: ref('testId', 'test', 'labTest'),
      department: ref('departmentId', 'department', 'department'),
    },
    whos: [
      who('enteredBy', 'enteredBy', ['userId', 'name', 'role', 'date'], 'enteredAt'),
      who('verifiedBy', 'verifiedBy', ['userId', 'name', 'role', 'date'], 'verifiedAt'),
    ],
    children: [
      { doc: 'results', rel: 'results', model: 'resultParameter' },
      { doc: 'versions', rel: 'versions', model: 'resultVersion' },
    ],
  },

  resultParameter: {
    hasId: false,
    scalars: [
      'parameterId',
      'parameterName',
      'shortName',
      'value',
      'unit',
      'referenceRange',
      'flag',
      'flagManual',
      'method',
      'remarks',
      'resultType',
      'dropdownOptions',
      'criticalLow',
      'criticalHigh',
      'highRange',
      'lowRange',
      'displayOrder',
      'formula',
      'formulaOverride',
    ],
  },

  resultVersion: {
    json: ['results'],
    hasId: false,
    scalars: ['version', 'results', 'status', 'reason', 'timestamp'],
    whos: [who('changedBy', 'changedBy')],
  },

  savedReport: {
    hasId: true,
    scalars: [
      'patientName',
      'uhid',
      'mobile',
      'invoiceNumber',
      'enquiryNo',
      'reportNo',
      'status',
      'tests',
      'fileName',
      'size',
      'data',
      ...TIMESTAMPS,
    ],
    refs: {
      result: ref('resultId', 'result', 'result'),
      patient: ref('patientId', 'patient', 'patient'),
      invoice: ref('invoiceId', 'invoice', 'invoice'),
    },
    whos: [who('savedBy', 'savedBy')],
  },
};

export const specOf = (model: ModelName): ModelSpec => SPECS[model];

function dropNulls<T extends Record<string, any>>(obj: T): Partial<T> {
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) out[k] = v;
  return out;
}

const byPosition = (a: any, b: any) => (a.position ?? 0) - (b.position ?? 0);

/** Columns stored as numeric (Prisma `Decimal`), per model - every Mongo Number. */
const DECIMAL_COLUMNS = new Map<string, Set<string>>(
  Prisma.dmmf.datamodel.models.map((m) => [
    m.name[0].toLowerCase() + m.name.slice(1),
    new Set(m.fields.filter((f) => f.type === 'Decimal').map((f) => f.name)),
  ])
);

/**
 * A JS number for a numeric column. Handed over as a Decimal built from the
 * number's own shortest spelling, which keeps every digit: given the plain
 * number, Prisma rounds it to 16 significant digits first.
 */
export const exactDecimal = (value: number) => new Prisma.Decimal(String(value));

/** What came back from a numeric column, as the JS number that was stored. */
export const fromDecimal = (value: any) => (Prisma.Decimal.isDecimal(value) ? Number(value.toString()) : value);

/** Decimal-typed columns of `model` in a data object turned into exact Decimals, in place. */
export function decimalsIn(model: string, data: any) {
  const columns = DECIMAL_COLUMNS.get(model);
  if (!columns || !data) return data;
  for (const column of columns) if (typeof data[column] === 'number') data[column] = exactDecimal(data[column]);
  return data;
}

/**
 * An empty nested object: Mongoose left it out of the JSON, but reading the
 * path on the document still gave `{}`. So it is there to read and invisible
 * to JSON; assigning to it makes it an ordinary field again.
 */
function emptyNested(doc: any, key: string) {
  let value: any = {};
  Object.defineProperty(doc, key, {
    enumerable: false,
    configurable: true,
    get: () => value,
    set: (next) => {
      value = next;
      Object.defineProperty(doc, key, { value: next, enumerable: true, writable: true, configurable: true });
    },
  });
}

/**
 * A document's own fields for writing back, including an empty nested object
 * the code has since filled in place (`doc.verifiedBy.name = ...`).
 */
export function ownFields(doc: any): any {
  const out: any = { ...doc };
  for (const key of Object.getOwnPropertyNames(doc)) {
    if (key in out) continue;
    const value = doc[key];
    if (value && typeof value === 'object' && Object.keys(value).length) out[key] = value;
  }
  return out;
}

/** A Prisma row (plus any loaded relations) as the Mongoose document's JSON. */
export function toDoc(model: ModelName, row: any): any {
  if (row === null || row === undefined) return row;
  const spec = SPECS[model];
  const doc: any = {};
  if (spec.hasId && row.id !== undefined) doc._id = row.id;

  for (const field of spec.scalars) {
    const value = row[field];
    if (value === undefined) continue;
    if (value === null) {
      if (spec.nullKept?.includes(field)) doc[field] = null;
      continue;
    }
    doc[field] =
      Buffer.isBuffer(value) || value instanceof Uint8Array ? Buffer.from(value) : fromDecimal(value);
  }

  for (const [field, r] of Object.entries(spec.refs || {})) {
    const loaded = row[r.rel];
    if (loaded !== undefined && loaded !== null) doc[field] = toDoc(r.model, loaded);
    else if (row[r.col] !== undefined && row[r.col] !== null) doc[field] = row[r.col];
    else if ((row[r.col] === null || loaded === null) && spec.nullKept?.includes(field)) doc[field] = null;
  }

  for (const w of spec.whos || []) {
    const obj: any = {};
    let seen = false;
    let loadedAny = false;
    for (const [sub, col] of Object.entries(w.cols)) {
      const rel = w.rel?.[sub];
      const loaded = rel ? row[rel.rel] : undefined;
      if (row[col] !== undefined) loadedAny = true;
      if (loaded !== undefined && loaded !== null) {
        obj[sub] = toDoc(rel!.model, loaded);
        seen = true;
      } else if (row[col] !== undefined && row[col] !== null) {
        obj[sub] = row[col];
        seen = true;
      }
    }
    if (seen) doc[w.doc] = obj;
    // An empty nested object: Mongoose left it out of the JSON, but reading
    // the path on the document still gave `{}`. Non-enumerable does both.
    else if (loadedAny) emptyNested(doc, w.doc);
  }

  for (const c of spec.children || []) {
    const rows = row[c.rel];
    if (Array.isArray(rows)) doc[c.doc] = [...rows].sort(byPosition).map((child) => toDoc(c.model, child));
  }

  for (const l of spec.refLists || []) {
    const rows = row[l.rel];
    if (Array.isArray(rows)) {
      doc[l.doc] = [...rows]
        .sort(byPosition)
        .map((join) => (join[l.target.rel] ? toDoc(l.target.model, join[l.target.rel]) : join[l.col]));
    }
  }

  spec.toDoc?.(row, doc);
  return doc;
}

/**
 * A Mongo-shaped document as a Prisma unchecked create input: foreign keys as
 * plain id columns, child arrays as nested `create`s. Fields the document does
 * not carry are left undefined, so the column's default applies - which is
 * what Mongoose's schema default did.
 */
export function fromDoc(model: ModelName, doc: any, opts: { undefinedAsNull?: boolean } = {}): any {
  const spec = SPECS[model];
  const row: any = {};
  if (spec.hasId && doc._id !== undefined) row.id = idOf(doc._id);
  // On a save, a field set to undefined (`user.refreshToken = undefined`) was
  // an $unset; a field the document simply does not carry is left alone.
  const cleared = (obj: any, key: string) => opts.undefinedAsNull && obj && key in obj && obj[key] === undefined;

  for (const field of spec.scalars) {
    if (cleared(doc, field)) {
      row[field] = spec.json?.includes(field) ? Prisma.DbNull : null;
      continue;
    }
    if (doc[field] === undefined) continue;
    const value = doc[field];
    row[field] =
      value && value._bsontype === 'Binary'
        ? Buffer.from(value.buffer)
        : spec.json?.includes(field)
          ? value === null
            ? Prisma.DbNull
            : JSON.parse(JSON.stringify(value))
          : value;
  }

  decimalsIn(model, row);

  for (const [field, r] of Object.entries(spec.refs || {})) {
    if (cleared(doc, field)) row[r.col] = null;
    else if (doc[field] !== undefined) row[r.col] = idOf(doc[field]);
  }

  for (const w of spec.whos || []) {
    const obj = doc[w.doc];
    if (cleared(doc, w.doc) || (obj === null && opts.undefinedAsNull)) {
      for (const col of Object.values(w.cols)) row[col] = null;
      continue;
    }
    if (obj === undefined || obj === null) continue;
    for (const [sub, col] of Object.entries(w.cols)) {
      // Assigning a whole nested object in Mongoose replaced it: a sub-field
      // the new object leaves out is gone afterwards.
      if (cleared(obj, sub) || (opts.undefinedAsNull && obj[sub] === undefined)) {
        row[col] = null;
        continue;
      }
      if (obj[sub] === undefined) continue;
      row[col] = w.rel?.[sub] ? idOf(obj[sub]) : obj[sub];
    }
  }

  for (const c of spec.children || []) {
    const list = doc[c.doc];
    if (!Array.isArray(list)) continue;
    row[c.rel] = { create: list.map((child, position) => ({ ...fromDoc(c.model, child), position })) };
  }

  for (const l of spec.refLists || []) {
    const list = doc[l.doc];
    if (!Array.isArray(list)) continue;
    row[l.rel] = { create: list.map((id, position) => ({ [l.col]: idOf(id), position })) };
  }

  spec.fromDoc?.(doc, row);
  return decimalsIn(model, row);
}

/** The Prisma `include` that loads every child table a model folds back into arrays. */
export function childInclude(model: ModelName): Record<string, true> | undefined {
  const spec = SPECS[model];
  const include: Record<string, any> = {};
  for (const c of spec.children || []) include[c.rel] = true;
  for (const l of spec.refLists || []) include[l.rel] = true;
  return Object.keys(include).length ? include : undefined;
}
