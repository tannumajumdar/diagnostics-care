/**
 * The requests a parity run makes, in order.
 *
 * Every run starts from the same snapshot, so the ids picked here exist on
 * both backends. Writes are part of the scenario: what a POST returns, and
 * what the GETs after it return, are both compared.
 */
import mongoose from 'mongoose';

export interface Step {
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string | ((ctx: Ctx) => string);
  body?: any | ((ctx: Ctx) => any);
  /** Which token to send; defaults to the Admin's. */
  as?: string;
  /**
   * Set when Postgres answers this step differently on purpose - the reason is
   * printed with the diff, and the step does not count as a failure.
   */
  known?: string;
  /** A token picked up earlier in the run (from a login), used instead of `as`. */
  token?: (ctx: Ctx) => string;
  /**
   * The route returns a Mongo `$group` without a `$sort`, so the order of its
   * rows was never defined - it can change between two runs of the old code.
   * Compared as a set.
   */
  unordered?: boolean;
  /** Pull values out of the response for later steps. */
  keep?: (body: any, ctx: Ctx) => void;
}

export interface Ctx {
  ids: Record<string, string>;
  values: Record<string, any>;
}

/** Picks representative documents out of the snapshot for the steps to address. */
export async function pickIds(db: mongoose.mongo.Db): Promise<Record<string, string>> {
  const one = async (collection: string, filter: any = {}, sort: any = { _id: 1 }) => {
    const doc = await db.collection(collection).findOne(filter, { sort });
    return doc ? String(doc._id) : '';
  };
  const field = async (collection: string, name: string, filter: any = {}) => {
    const doc = await db.collection(collection).findOne(filter, { sort: { _id: 1 } });
    return doc ? String(doc[name]) : '';
  };

  return {
    admin: await one('users', { role: 'Admin', status: 'Active' }),
    receptionist: await one('users', { role: 'Receptionist', status: 'Active' }),
    pathologist: await one('users', { role: 'Pathologist', status: 'Active' }),
    user: await one('users', {}, { _id: -1 }),
    department: await one('departments'),
    doctor: await one('doctors'),
    organization: await one('organizations'),
    test: await one('labtests'),
    testWithParams: await one('labtests', { 'parameters.1': { $exists: true } }),
    testWithTemplate: await one('labtests', { reportTemplate: { $ne: null } }),
    attachment: await one('testattachments'),
    attachmentTest: await field('testattachments', 'test'),
    package: await one('testpackages'),
    patient: await one('patients'),
    patientWithBills: String((await db.collection('invoices').findOne({}, { sort: { _id: 1 } }))?.patient || ''),
    appointment: await one('appointments'),
    invoice: await one('invoices'),
    invoicePartial: await one('invoices', { paymentStatus: { $in: ['Partial', 'Unpaid'] } }),
    invoiceLatest: await one('invoices', {}, { _id: -1 }),
    invoiceBarcode: await field('invoices', 'barcode'),
    sample: await one('samples'),
    sampleBarcode: await field('samples', 'barcode'),
    sampleCollected: await one('samples', { status: 'Collected' }),
    samplePending: await one('samples', { status: 'Pending Collection' }),
    result: await one('results'),
    resultFinal: await one('results', { status: { $in: ['Approved', 'Final'] } }),
    resultSubmitted: await one('results', { status: { $in: ['Submitted', 'Under Review'] } }),
    resultSample: await field('results', 'sample'),
    resultWithTemplate: await one('results', { test: (await db.collection('labtests').findOne({ reportTemplate: { $ne: null } }))?._id }),
    paymentTxn: await field('paymenttransactions', 'txnId'),
    savedReport: await one('savedreports'),
    expense: await one('expenses'),
  };
}

/** File contents the upload steps send, read out of the snapshot as base64. */
export async function pickValues(db: mongoose.mongo.Db): Promise<Record<string, any>> {
  const docx = await db.collection('testattachments').findOne({ fileName: /\.docx$/i });
  const bytes: any = docx?.data;
  return {
    docxB64: bytes ? Buffer.from(bytes.buffer ?? bytes).toString('base64') : '',
    pdfB64: Buffer.from('%PDF-1.4\n% parity test file\n').toString('base64'),
  };
}

const today = new Date().toISOString().slice(0, 10);
const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);

const get = (name: string, path: Step['path']): Step => ({ name, method: 'GET', path });

/** Read-only coverage of every GET route, with the filters the screens send. */
export const READS: Step[] = [
  // auth / users
  get('auth.me', '/auth/me'),
  get('users.list', '/users'),
  get('users.search', '/users?search=a&page=1&limit=5'),
  get('users.byRole', '/users?role=Receptionist'),
  get('users.byId', (c) => `/users/${c.ids.user}`),
  get('users.badId', '/users/not-an-id'),
  get('users.missing', '/users/000000000000000000000000'),
  get('users.collectors', '/users/collectors'),
  get('users.cashiers', '/users/cashiers'),
  get('roles.matrix', '/role-permissions'),

  // masters
  get('departments.list', '/departments'),
  get('departments.search', '/departments?search=path&status=Active'),
  get('departments.page2', '/departments?page=2&limit=2'),
  get('departments.byId', (c) => `/departments/${c.ids.department}`),
  get('departments.badId', '/departments/xyz'),
  get('doctors.list', '/doctors'),
  get('doctors.search', '/doctors?search=dr&status=Active&page=1&limit=3'),
  get('doctors.byId', (c) => `/doctors/${c.ids.doctor}`),
  get('orgs.list', '/organizations'),
  get('orgs.search', '/organizations?search=a'),
  get('orgs.byId', (c) => `/organizations/${c.ids.organization}`),
  get('tests.list', '/tests'),
  get('tests.all', '/tests?limit=1000'),
  get('tests.search', '/tests?search=cbc'),
  get('tests.searchAbbrev', '/tests?search=LFT&limit=50'),
  get('tests.searchParam', '/tests?search=hb&limit=50'),
  get('tests.byDept', (c) => `/tests?department=${c.ids.department}&limit=50`),
  get('tests.inactive', '/tests?status=Inactive'),
  get('tests.byId', (c) => `/tests/${c.ids.testWithParams}`),
  get('tests.attachments', (c) => `/tests/${c.ids.attachmentTest}/attachments`),
  get('tests.attachmentFile', (c) => `/tests/${c.ids.attachmentTest}/attachments/${c.ids.attachment}`),
  get('tests.reportTemplate', (c) => `/tests/${c.ids.testWithTemplate}/report-template`),
  get('packages.list', '/packages'),
  get('packages.search', '/packages?search=full&status=Active'),
  get('packages.byId', (c) => `/packages/${c.ids.package}`),
  get('rates.list', '/rate-history'),
  get('rates.byTest', (c) => `/rate-history/test/${c.ids.test}`),
  get('refundPolicy.get', '/refund-policy'),
  get('refundPolicy.quote', (c) => `/refund-policy/quote/${c.ids.invoice}`),
  get('refundPolicy.quoteLatest', (c) => `/refund-policy/quote/${c.ids.invoiceLatest}`),

  // patients
  get('patients.list', '/patients'),
  get('patients.search', '/patients?search=a&page=1&limit=5'),
  get('patients.searchUhid', '/patients?search=UHID'),
  get('patients.inactive', '/patients?status=Inactive'),
  get('patients.byId', (c) => `/patients/${c.ids.patient}`),
  get('patients.history', (c) => `/patients/${c.ids.patientWithBills}/history`),
  get('appointments.list', '/appointments'),
  get('appointments.filtered', `/appointments?status=Pending&date=${today}`),
  get('appointments.byId', (c) => `/appointments/${c.ids.appointment}`),

  // billing
  get('billing.list', '/billing'),
  get('billing.page', '/billing?page=2&limit=5'),
  get('billing.search', '/billing?search=INV'),
  get('billing.unpaid', '/billing?paymentStatus=Unpaid'),
  get('billing.range', `/billing?from=${monthAgo}&to=${today}`),
  get('billing.byPatient', (c) => `/billing?patientId=${c.ids.patientWithBills}`),
  get('billing.tests', '/billing/tests'),
  get('billing.testsFiltered', `/billing/tests?from=${yearAgo}&to=${today}&limit=500`),
  get('billing.byId', (c) => `/billing/${c.ids.invoice}`),
  get('billing.byBarcode', (c) => `/billing/barcode/${c.ids.invoiceBarcode}`),
  get('gateway.forInvoice', (c) => `/payment-gateway/invoice/${c.ids.invoice}`),
  get('gateway.status', (c) => `/payment-gateway/${c.ids.paymentTxn}`),

  // lab
  get('samples.list', '/samples'),
  get('samples.pending', '/samples?status=Pending%20Collection'),
  get('samples.search', '/samples?search=SMP&limit=50'),
  get('samples.stats', '/samples/stats'),
  get('samples.byBarcode', (c) => `/samples/barcode/${c.ids.sampleBarcode}`),
  get('samples.byId', (c) => `/samples/${c.ids.sample}`),
  get('samples.timeline', (c) => `/samples/${c.ids.sample}/timeline`),
  get('results.list', '/results'),
  get('results.filtered', '/results?status=Final&limit=50'),
  get('results.pending', '/results/pending'),
  get('results.patientReports', '/results/patient-reports'),
  get('results.patientReportsSearch', '/results/patient-reports?search=a'),
  get('results.bySample', (c) => `/results/sample/${c.ids.resultSample}`),
  get('results.visit', (c) => `/results/visit/${c.ids.resultSample}`),
  get('results.byId', (c) => `/results/${c.ids.result}`),
  get('results.pdf', (c) => `/results/${c.ids.resultFinal}/pdf`),
  get('results.docx', (c) => `/results/${c.ids.resultFinal}/docx`),
  get('results.docxTemplate', (c) => `/results/${c.ids.resultWithTemplate}/docx`),
  get('savedReports.list', '/saved-reports'),
  get('savedReports.file', (c) => `/saved-reports/${c.ids.savedReport}/file`),

  // accounts
  get('accounts.daily', '/accounts/collections/daily'),
  get('accounts.dailyDate', `/accounts/collections/daily?date=${today}`),
  get('accounts.trend', '/accounts/collections/trend'),
  get('accounts.trendRange', `/accounts/collections/trend?from=${monthAgo}&to=${today}`),
  get('accounts.overall', '/accounts/collections/overall'),
  get('accounts.ledger', '/accounts/ledger'),
  get('accounts.ledgerFiltered', `/accounts/ledger?from=${yearAgo}&to=${today}&flowType=collection&paymentMethod=Cash&limit=200`),
  get('accounts.ledgerPayout', '/accounts/ledger?flowType=payout'),
  get('accounts.ledgerRefund', '/accounts/ledger?flowType=refund'),
  get('accounts.ledgerPatient', (c) => `/accounts/ledger?patientId=${c.ids.patientWithBills}`),
  get('accounts.ledgerStaff', '/accounts/ledger/staff'),
  get('accounts.refunds', '/accounts/refunds'),
  get('accounts.payouts', '/accounts/payouts'),
  get('accounts.payoutsFiltered', '/accounts/payouts?status=Paid&payeeType=Ambulance'),
  get('accounts.payoutSummary', '/accounts/payouts/summary'),
  get('accounts.expenses', '/accounts/expenses'),
  get('accounts.commissions', '/accounts/doctor-commissions'),

  // reports
  get('reports.daily', '/reports/revenue/daily'),
  get('reports.monthly', '/reports/revenue/monthly'),
  get('reports.patients', '/reports/patients/trend'),
  get('reports.tests', '/reports/tests/revenue'),
  get('reports.departments', '/reports/departments/tests'),
  { ...get('reports.doctors', '/reports/doctors/tests'), unordered: true },
  { ...get('reports.methods', '/reports/payments/methods'), unordered: true },
  get('reports.pending', '/reports/payments/pending'),
  { ...get('reports.completion', '/reports/reports/completion'), unordered: true },
  { ...get('reports.rejections', '/reports/samples/rejections'), unordered: true },
  { ...get('reports.corporate', '/reports/corporate/revenue'), unordered: true },
  get('reports.referrals', '/reports/doctors/referrals'),
  get('reports.referralsRange', `/reports/doctors/referrals?from=${yearAgo}&to=${today}`),
  get('audit.list', '/audit-logs'),
  get('audit.filtered', '/audit-logs?module=Billing&page=2&limit=10'),

  // permission edges
  { name: 'perm.receptionistUsers', method: 'GET', path: '/users', as: 'receptionist' },
  { name: 'perm.receptionistAudit', method: 'GET', path: '/audit-logs', as: 'receptionist' },
  { name: 'perm.noToken', method: 'GET', path: '/patients', as: 'none' },
];

/**
 * Writes, grouped by module and added as each module moves to Postgres. They
 * run after READS, in this order, against the same database, so a later group
 * sees what an earlier one created.
 */
const post = (name: string, path: Step['path'], body?: Step['body'], extra: Partial<Step> = {}): Step => ({
  name,
  method: 'POST',
  path,
  body,
  ...extra,
});
const put = (name: string, path: Step['path'], body?: Step['body'], extra: Partial<Step> = {}): Step => ({
  name,
  method: 'PUT',
  path,
  body,
  ...extra,
});
const patch = (name: string, path: Step['path'], body?: Step['body'], extra: Partial<Step> = {}): Step => ({
  name,
  method: 'PATCH',
  path,
  body,
  ...extra,
});
const del = (name: string, path: Step['path'], extra: Partial<Step> = {}): Step => ({
  name,
  method: 'DELETE',
  path,
  ...extra,
});

/** The id of what a create step returned, for the steps after it. */
const keepId = (key: string) => (body: any, ctx: Ctx) => {
  const id = body?.data?._id || body?.data?.id || body?._id;
  if (id) ctx.ids[key] = String(id);
};

const STAFF: Step[] = [
  post(
    'w.users.create',
    '/users',
    {
      name: '  Parity Tester ',
      email: 'Parity.Tester@Example.com',
      password: 'secret123',
      role: 'Receptionist',
      mobile: ' 9876543210 ',
      permissions: ['patient:view', 'bill:view', 'patient:view'],
    },
    { keep: keepId('newUser') }
  ),
  post('w.users.createDuplicate', '/users', {
    name: 'Other',
    email: 'parity.tester@example.com',
    password: 'secret123',
    role: 'Receptionist',
    mobile: '9876543210',
  }),
  post('w.users.createBadPermission', '/users', {
    name: 'Other',
    email: 'other.tester@example.com',
    password: 'secret123',
    role: 'Receptionist',
    mobile: '9876543210',
    permissions: ['not:a:permission'],
  }),
  get('w.users.getNew', (c) => `/users/${c.ids.newUser}`),
  post('w.auth.loginNew', '/auth/login', { email: 'parity.tester@example.com', password: 'secret123' }, {
    keep: (b, c) => {
      c.values.newAccess = b?.data?.accessToken;
      c.values.newRefresh = b?.data?.refreshToken;
    },
  }),
  post('w.auth.loginWrongPassword', '/auth/login', { email: 'parity.tester@example.com', password: 'wrongpass' }),
  post('w.auth.loginUppercaseEmail', '/auth/login', { email: 'PARITY.TESTER@example.com', password: 'secret123' }),
  { ...get('w.auth.meNew', '/auth/me'), token: (c) => c.values.newAccess },
  {
    ...post('w.auth.changePassword', '/auth/change-password', { oldPassword: 'secret123', newPassword: 'secret456' }),
    token: (c) => c.values.newAccess,
  },
  {
    ...post('w.auth.changePasswordWrongOld', '/auth/change-password', { oldPassword: 'nope123', newPassword: 'secret789' }),
    token: (c) => c.values.newAccess,
  },
  post('w.auth.loginChanged', '/auth/login', { email: 'parity.tester@example.com', password: 'secret456' }, {
    keep: (b, c) => {
      c.values.newAccess = b?.data?.accessToken;
      c.values.newRefresh = b?.data?.refreshToken;
    },
  }),
  post('w.auth.refresh', '/auth/refresh-token', (c: Ctx) => ({ refreshToken: c.values.newRefresh })),
  post('w.auth.refreshBogus', '/auth/refresh-token', { refreshToken: 'bogus' }),
  put('w.users.update', (c) => `/users/${c.ids.newUser}`, {
    name: '  Renamed Tester  ',
    role: 'Accountant',
    mobile: '9999999999',
  }),
  { ...get('w.auth.meAfterRoleChange', '/auth/me'), token: (c) => c.values.newAccess },
  put('w.users.updatePermissions', (c) => `/users/${c.ids.newUser}`, { permissions: ['bill:view', 'payout:view'] }),
  put('w.users.updateEmailClash', (c) => `/users/${c.ids.newUser}`, (c: Ctx) => ({ email: 'parity.tester@example.com' })),
  put('w.users.updateOwnRole', (c) => `/users/${c.ids.admin}`, { role: 'Receptionist' }),
  put('w.users.updateOwnStatus', (c) => `/users/${c.ids.admin}`, { status: 'Inactive' }),
  put('w.users.updateOwnMobile', (c) => `/users/${c.ids.admin}`, { mobile: '9000000001' }),
  patch('w.users.resetPassword', (c) => `/users/${c.ids.newUser}/password`, { password: 'reset999' }),
  post('w.auth.loginAfterReset', '/auth/login', { email: 'parity.tester@example.com', password: 'reset999' }),
  patch('w.users.toggleOff', (c) => `/users/${c.ids.newUser}/status`),
  post('w.auth.loginInactive', '/auth/login', { email: 'parity.tester@example.com', password: 'reset999' }),
  patch('w.users.toggleSelf', (c) => `/users/${c.ids.admin}/status`),
  patch('w.users.toggleOn', (c) => `/users/${c.ids.newUser}/status`),
  get('w.users.missingUpdate', '/users/000000000000000000000000'),
  put('w.users.updateMissing', '/users/000000000000000000000000', { name: 'Nobody' }),
  put('w.users.updateBadId', '/users/nope', { name: 'Nobody' }),
  get('w.users.listAfter', '/users?limit=50'),
  { ...post('w.auth.logoutNew', '/auth/logout'), token: (c) => c.values.newAccess },
  get('w.audit.staff', '/audit-logs?module=STAFF&limit=50'),
  get('w.audit.auth', '/audit-logs?module=AUTH&limit=5'),
];

const MASTERS: Step[] = [
  // departments
  post('w.dept.create', '/departments', { departmentName: '  Parity Dept ', departmentCode: ' pd01 ', description: ' x ', extra: 'dropped' }, { keep: keepId('newDept') }),
  post('w.dept.createDupCode', '/departments', { departmentName: 'Another Dept', departmentCode: 'PD01' }),
  post('w.dept.createDupName', '/departments', { departmentName: 'Parity Dept', departmentCode: 'PD02' }),
  post('w.dept.createShort', '/departments', { departmentName: 'P', departmentCode: 'PD03' }),
  put('w.dept.update', (c) => `/departments/${c.ids.newDept}`, { departmentCode: 'pd09', description: '  trimmed  ' }),
  put('w.dept.updateMissing', '/departments/000000000000000000000000', { description: 'x' }),
  patch('w.dept.toggle', (c) => `/departments/${c.ids.newDept}/status`),
  patch('w.dept.toggleBadId', '/departments/zzz/status'),
  get('w.dept.list', '/departments?limit=100'),
  get('w.dept.searchRegex', '/departments?search=p.r'),
  get('w.dept.inactive', '/departments?status=Inactive'),

  // doctors
  post(
    'w.doctor.create',
    '/doctors',
    (c: Ctx) => ({
      doctorName: '  Dr. Parity ',
      department: c.ids.department,
      mobile: '9123456789',
      email: 'Dr.Parity@Example.com',
      commission: '12.5',
      discountPercentage: 5,
      gender: 'Female',
      dob: '1980-05-17',
      area: 'North Zone',
    }),
    { keep: keepId('newDoctor') }
  ),
  post('w.doctor.createBadDept', '/doctors', { doctorName: 'Dr. Bad', department: 'nope', mobile: '9123456789' }),
  post('w.doctor.createBadCommission', '/doctors', (c: Ctx) => ({ doctorName: 'Dr. Bad', department: c.ids.department, mobile: '9123456789', commission: 150 })),
  post('w.doctor.createBadEnum', '/doctors', (c: Ctx) => ({ doctorName: 'Dr. Bad', department: c.ids.department, mobile: '9123456789', paymentTerm: 'Yearly' })),
  put('w.doctor.update', (c) => `/doctors/${c.ids.newDoctor}`, { hospital: '  City Hospital ', commission: 20 }),
  put('w.doctor.updateCast', (c) => `/doctors/${c.ids.newDoctor}`, { commission: 'abc' }),
  put('w.doctor.updateOutOfRange', (c) => `/doctors/${c.ids.newDoctor}`, { commission: 400 }),
  patch('w.doctor.cutValue', '/doctors/bulk/cut-value', (c: Ctx) => ({ ids: [c.ids.newDoctor, c.ids.doctor], commission: 7, discountPercentage: '3' })),
  patch('w.doctor.cutValueNone', '/doctors/bulk/cut-value', { ids: [] }),
  patch('w.doctor.cutValueNoValue', '/doctors/bulk/cut-value', (c: Ctx) => ({ ids: [c.ids.doctor] })),
  patch('w.doctor.cutValueRange', '/doctors/bulk/cut-value', (c: Ctx) => ({ ids: [c.ids.doctor], commission: 101 })),
  patch('w.doctor.cutValueBadId', '/doctors/bulk/cut-value', { ids: ['bad'], commission: 5 }),
  patch('w.doctor.toggle', (c) => `/doctors/${c.ids.newDoctor}/status`),
  get('w.doctor.list', '/doctors?limit=100'),
  get('w.doctor.byCommission', '/doctors?sortBy=commission&sortDir=asc&limit=100'),
  get('w.doctor.byDobAsc', '/doctors?sortBy=dob&sortDir=asc&limit=100'),
  get('w.doctor.byDobDesc', '/doctors?sortBy=dob&sortDir=desc&limit=100'),
  get('w.doctor.byName', '/doctors?sortBy=doctorName&sortDir=asc&limit=100'),
  get('w.doctor.byDept', (c) => `/doctors?department=${c.ids.department}&limit=100`),
  get('w.doctor.byBadDept', '/doctors?department=xyz'),
  get('w.doctor.byArea', '/doctors?area=north'),
  get('w.doctor.dobRange', '/doctors?dateField=dob&fromDate=1970-01-01&toDate=1990-12-31'),
  get('w.doctor.badDate', '/doctors?fromDate=notadate'),
  get('w.doctor.createdRange', `/doctors?fromDate=${monthAgo}&toDate=${today}`),
  get('w.doctor.byId', (c) => `/doctors/${c.ids.newDoctor}`),

  // organizations
  post('w.org.create', '/organizations', { organizationName: ' Parity Corp ', contactPerson: 'Someone', mobile: '9000000000', discount: '15', creditLimit: 50000, contractRate: 'Standard' }, { keep: keepId('newOrg') }),
  post('w.org.createDup', '/organizations', { organizationName: 'Parity Corp', contactPerson: 'Someone', mobile: '9000000000' }),
  post('w.org.createBadTerms', '/organizations', { organizationName: 'Bad Terms', contactPerson: 'Someone', mobile: '9000000000', paymentTerms: 'Net 90' }),
  put('w.org.update', (c) => `/organizations/${c.ids.newOrg}`, { city: '  Pune ', paymentTerms: 'Net 15' }),
  patch('w.org.toggle', (c) => `/organizations/${c.ids.newOrg}/status`),
  get('w.org.list', '/organizations?limit=100'),
];

const CATALOGUE: Step[] = [
  // tests
  post('w.test.create', '/tests', (c: Ctx) => ({ testName: '  Parity Glucose Fasting ', testCode: 'pgf1', department: c.ids.department, rate: 150 }), {
    keep: keepId('newTest'),
  }),
  post('w.test.createDup', '/tests', (c: Ctx) => ({ testName: 'Another', testCode: 'PGF1', department: c.ids.department, rate: 10 })),
  post('w.test.createImport', '/tests', (c: Ctx) => ({
    testName: 'Parity Imported',
    testCode: 'PIMP',
    department: c.ids.department,
    rate: 300,
    tpa: c.ids.organization,
    importParametersFrom: c.ids.testWithParams,
    processingMode: 'Outsource',
    outsourceLab: 'Ref Lab',
    outsourceCost: 120,
  }), { keep: keepId('tpaTest') }),
  post('w.test.createImportMissing', '/tests', (c: Ctx) => ({ testName: 'Parity X', testCode: 'PX01', department: c.ids.department, rate: 1, importParametersFrom: '000000000000000000000000' })),
  post('w.test.createBadFormula', '/tests', (c: Ctx) => ({
    testName: 'Parity Formula',
    testCode: 'PFRM',
    department: c.ids.department,
    rate: 1,
    parameters: [{ parameterName: 'LDL', shortName: 'LDL', formula: '#TC# - #HDL#' }],
  })),
  post('w.test.createWithParams', '/tests', (c: Ctx) => ({
    testName: 'Parity Lipid',
    testCode: 'PLIP',
    department: c.ids.department,
    rate: 500,
    sampleType: '  ',
    parameters: [
      { parameterName: ' Total Cholesterol ', shortName: 'TC', unit: 'mg/dL', displayOrder: '1', paraFor: 'ALL', ageToDays: '0' },
      { parameterName: 'HDL', shortName: 'HDL', unit: 'mg/dL', displayOrder: 2 },
      { parameterName: 'LDL', shortName: 'LDL', unit: 'mg/dL', displayOrder: 3, formula: '#TC# - #HDL#' },
      { parameterName: 'SECTION', resultType: 'Header', displayOrder: 3 },
    ],
  }), { keep: keepId('lipidTest') }),
  put('w.test.update', (c) => `/tests/${c.ids.newTest}`, { processingMode: 'In-house', rate: 175, interpretation: '  note ', tpa: 'none' }),
  put('w.test.updateImportSelf', (c) => `/tests/${c.ids.newTest}`, (c: Ctx) => ({ importParametersFrom: c.ids.newTest })),
  put('w.test.updateImport', (c) => `/tests/${c.ids.newTest}`, (c: Ctx) => ({ importParametersFrom: c.ids.lipidTest })),
  put('w.test.updateParams', (c) => `/tests/${c.ids.lipidTest}/parameters`, {
    parameters: [
      { parameterName: 'HDL', shortName: 'HDL', unit: 'mg/dL', displayOrder: 1 },
      { parameterName: 'Total Cholesterol', shortName: 'TC', unit: 'mg/dL', displayOrder: 2, paraFor: 'MALE', minValue: '0', maxValue: '200' },
    ],
  }),
  put('w.test.updateParamsBad', (c) => `/tests/${c.ids.lipidTest}/parameters`, { parameters: [{ shortName: 'NONAME' }] }),
  patch('w.test.toggle', (c) => `/tests/${c.ids.newTest}/status`),
  put('w.test.rates', (c) => `/tests/${c.ids.newTest}/rates`, { rates: { rate: 180 }, reason: 'x' }),
  post('w.test.attachPdf', (c) => `/tests/${c.ids.newTest}/attachments`, (c: Ctx) => ({ fileName: ' notes.pdf ', mimeType: '', data: `data:application/pdf;base64,${c.values.pdfB64}` }), {
    keep: (b, c) => {
      if (b?.data?.id) c.ids.pdfAttachment = b.data.id;
    },
  }),
  post('w.test.attachBadType', (c) => `/tests/${c.ids.newTest}/attachments`, (c: Ctx) => ({ fileName: 'run.exe', data: c.values.pdfB64 })),
  post('w.test.attachEmpty', (c) => `/tests/${c.ids.newTest}/attachments`, { fileName: 'a.pdf', data: '' }),
  post('w.test.attachDocx', (c) => `/tests/${c.ids.newTest}/attachments`, (c: Ctx) => ({ fileName: 'report.docx', data: c.values.docxB64 }), {
    keep: (b, c) => {
      if (b?.data?.id) c.ids.docxAttachment = b.data.id;
    },
  }),
  get('w.test.listAttachments', (c) => `/tests/${c.ids.newTest}/attachments`),
  get('w.test.getAfterDocx', (c) => `/tests/${c.ids.newTest}`),
  get('w.test.downloadPdf', (c) => `/tests/${c.ids.newTest}/attachments/${c.ids.pdfAttachment}`),
  get('w.test.downloadWrongTest', (c) => `/tests/${c.ids.test}/attachments/${c.ids.pdfAttachment}`),
  put('w.test.useAsReportPdf', (c) => `/tests/${c.ids.newTest}/attachments/${c.ids.pdfAttachment}/report`),
  put('w.test.useAsReportDocx', (c) => `/tests/${c.ids.newTest}/attachments/${c.ids.docxAttachment}/report`),
  put('w.test.uploadTemplate', (c) => `/tests/${c.ids.lipidTest}/report-template`, (c: Ctx) => ({ fileName: 'lipid.docx', data: c.values.docxB64 })),
  put('w.test.uploadTemplateNotDocx', (c) => `/tests/${c.ids.lipidTest}/report-template`, (c: Ctx) => ({ fileName: 'lipid.doc', data: c.values.docxB64 })),
  put('w.test.uploadTemplateAgain', (c) => `/tests/${c.ids.lipidTest}/report-template`, (c: Ctx) => ({ fileName: 'lipid2.docx', data: c.values.docxB64 })),
  get('w.test.downloadTemplate', (c) => `/tests/${c.ids.lipidTest}/report-template`),
  get('w.test.lipidAttachments', (c) => `/tests/${c.ids.lipidTest}/attachments`),
  del('w.test.removeTemplate', (c) => `/tests/${c.ids.lipidTest}/report-template`),
  get('w.test.downloadTemplateGone', (c) => `/tests/${c.ids.lipidTest}/report-template`),
  del('w.test.removeReportAttachment', (c) => `/tests/${c.ids.newTest}/attachments/${c.ids.docxAttachment}`),
  get('w.test.getAfterRemove', (c) => `/tests/${c.ids.newTest}`),
  del('w.test.removeAttachmentAgain', (c) => `/tests/${c.ids.newTest}/attachments/${c.ids.docxAttachment}`),
  del('w.test.deleteUsed', (c) => `/tests/${c.ids.test}`),
  get('w.test.listOwn', '/tests?tpa=own&limit=500'),
  get('w.test.listTpa', (c) => `/tests?tpa=${c.ids.organization}&limit=500`),
  get('w.test.listBadTpa', '/tests?tpa=zz'),
  get('w.test.searchNew', '/tests?search=parity&limit=50'),

  // packages
  post('w.pkg.create', '/packages', (c: Ctx) => ({
    packageName: '  Parity Panel ',
    packageCode: 'ppan',
    tests: [c.ids.lipidTest, c.ids.test, c.ids.lipidTest],
    rate: 999,
    department: '',
  }), { keep: keepId('newPkg') }),
  post('w.pkg.createMissingTest', '/packages', { packageName: 'Bad Panel', packageCode: 'BADP', tests: ['000000000000000000000000'], rate: 1 }),
  post('w.pkg.createBadTestId', '/packages', { packageName: 'Bad Panel', packageCode: 'BADP', tests: ['xyz'], rate: 1 }),
  post('w.pkg.createDup', '/packages', (c: Ctx) => ({ packageName: 'Dup', packageCode: 'PPAN', tests: [c.ids.test], rate: 1 })),
  put('w.pkg.update', (c) => `/packages/${c.ids.newPkg}`, (c: Ctx) => ({ department: c.ids.department, tests: [c.ids.test, c.ids.lipidTest], referralRate: 1200 })),
  put('w.pkg.clearDept', (c) => `/packages/${c.ids.newPkg}`, { department: '' }),
  patch('w.pkg.toggle', (c) => `/packages/${c.ids.newPkg}/status`),
  get('w.pkg.byId', (c) => `/packages/${c.ids.newPkg}`),
  get('w.pkg.list', '/packages?limit=100'),
  get('w.pkg.byDept', (c) => `/packages?department=${c.ids.department}`),
  del('w.pkg.deleteBilled', (c) => `/packages/${c.ids.package}`),

  // deleting a test that sits in a package
  del('w.test.deleteLipid', (c) => `/tests/${c.ids.lipidTest}`),
  get('w.pkg.afterTestDeleted', (c) => `/packages/${c.ids.newPkg}`),
  del('w.test.deleteMissing', '/tests/000000000000000000000000'),
  del('w.pkg.delete', (c) => `/packages/${c.ids.newPkg}`),
  get('w.pkg.deletedGone', (c) => `/packages/${c.ids.newPkg}`),
];

const PATIENTS: Step[] = [
  post('w.patient.create', '/patients', (c: Ctx) => ({
    patientName: '  Parity Patient ',
    gender: 'Female',
    age: 34,
    mobile: '9811112222',
    city: '  Nagpur ',
    referringDoctor: c.ids.doctor,
    organization: c.ids.organization,
    dateOfBirth: '1990-02-03',
    uhid: 'ignored-by-server',
  }), { keep: keepId('newPatient') }),
  post('w.patient.createChild', '/patients', { patientName: 'Parity Child', gender: 'Male Child', age: 0.5, mobile: '9811113333' }, { keep: keepId('childPatient') }),
  post('w.patient.createBadDoctor', '/patients', { patientName: 'Parity Bad', gender: 'Male', age: 3, mobile: '9811114444', referringDoctor: 'zzz' }),
  put('w.patient.update', (c) => `/patients/${c.ids.newPatient}`, { patientName: ' Parity Renamed ', city: 'Pune', referringDoctor: '', dateOfBirth: null, status: 'Inactive', uhid: 'NOPE' }),
  put('w.patient.updateOrg', (c) => `/patients/${c.ids.newPatient}`, (c: Ctx) => ({ organization: c.ids.organization, pinCode: 440001 })),
  put('w.patient.updateBadRef', (c) => `/patients/${c.ids.newPatient}`, { organization: 'bad' }),
  put('w.patient.updateBadAge', (c) => `/patients/${c.ids.newPatient}`, { emergencyContact: '  ', mobile: '9811112299' }),
  put('w.patient.updateMissing', '/patients/000000000000000000000000', { city: 'X' }),
  patch('w.patient.toggle', (c) => `/patients/${c.ids.newPatient}/status`),
  get('w.patient.byId', (c) => `/patients/${c.ids.newPatient}`),
  get('w.patient.history', (c) => `/patients/${c.ids.newPatient}/history`),
  get('w.patient.search', '/patients?search=parity&limit=50'),
  get('w.patient.list', '/patients?limit=100'),

  // appointments
  post('w.appt.create', '/appointments', (c: Ctx) => ({
    patientId: c.ids.newPatient,
    patientName: 'Parity Patient',
    mobile: '9811112222',
    doctorId: c.ids.doctor,
    testIds: [c.ids.testWithParams, c.ids.test],
    date: '2026-12-01',
    time: '09:30',
    collectionType: 'Home Collection',
    address: ' 12 Main Rd ',
  }), { keep: keepId('newAppt') }),
  // The snapshot's appointment counter trails the appointments already on file
  // (they were seeded), so the first numbers it hands out collide - on both
  // backends alike. Booking again moves past them.
  post('w.appt.createRetry1', '/appointments', { patientName: 'Retry', mobile: '9811119999', date: '2026-12-01', time: '08:00', collectionType: 'Lab Visit' }),
  post('w.appt.createRetry2', '/appointments', (c: Ctx) => ({
    patientId: c.ids.newPatient,
    patientName: 'Parity Patient',
    mobile: '9811112222',
    doctorId: c.ids.doctor,
    testIds: [c.ids.testWithParams, c.ids.test],
    date: '2026-12-01',
    time: '09:30',
    collectionType: 'Home Collection',
    address: ' 12 Main Rd ',
  }), { keep: keepId('newAppt') }),
  post('w.appt.createWalkIn', '/appointments', { patientName: 'Walk In', mobile: '9811119999', date: '2026-12-01', time: '08:00', collectionType: 'Lab Visit' }, { keep: keepId('walkInAppt') }),
  post('w.appt.createBadDate', '/appointments', { patientName: 'Bad', mobile: '9811119999', date: 'not-a-date', time: '08:00', collectionType: 'Lab Visit' }),
  post('w.appt.createBadTests', '/appointments', { patientName: 'Bad', mobile: '9811119999', date: '2026-12-01', time: '08:00', collectionType: 'Lab Visit', testIds: ['xyz'] }),
  patch('w.appt.assign', (c) => `/appointments/${c.ids.newAppt}/assign`, (c: Ctx) => ({ userId: c.ids.user, name: 'Collector One', mobile: '9000000000', extra: 'dropped' })),
  patch('w.appt.status', (c) => `/appointments/${c.ids.newAppt}/status`, { status: 'Collected', notes: 'done' }),
  patch('w.appt.statusBad', (c) => `/appointments/${c.ids.walkInAppt}/status`, { status: 'Lost' }),
  get('w.appt.byId', (c) => `/appointments/${c.ids.newAppt}`),
  get('w.appt.list', '/appointments?limit=100'),
  get('w.appt.byPhleb', (c) => `/appointments?phlebotomistId=${c.ids.user}`),
  get('w.appt.searchUhid', '/appointments?search=UHID-2026'),
  get('w.appt.searchName', '/appointments?search=walk'),
  get('w.appt.homeOnly', '/appointments?collectionType=Home%20Collection'),
  get('w.appt.badId', '/appointments/xyz'),
];

/** The sheet a result screen sends back: every line typed into, the way the bench fills it. */
const filledSheet = (rows: any[] = []) =>
  rows.map((r: any, i: number) => ({
    ...r,
    value: r.resultType === 'Header' ? '' : r.resultType === 'Numeric' || !r.resultType ? String(10 + i * 1.5) : 'Negative',
  }));

const LAB: Step[] = [
  // One draw walked through the bench
  patch('l.sample.collectFuture', '/samples/6a9bcd33ac172e44b8c4ef2f/status', { status: 'Collected', collectedAt: '2099-01-01T00:00:00.000Z' }),
  patch('l.sample.collectBeforeOrder', '/samples/6a9bcd33ac172e44b8c4ef2f/status', { status: 'Collected', collectedAt: '2026-01-01T00:00:00.000Z' }),
  patch('l.sample.collectBadDate', '/samples/6a9bcd33ac172e44b8c4ef2f/status', { status: 'Collected', collectedAt: 'yesterday' }),
  patch('l.sample.collect', '/samples/6a9bcd33ac172e44b8c4ef2f/status', {
    status: 'Collected',
    collector: ' Ravi ',
    collectedAt: '2026-09-05T09:00:00.000Z',
    remarks: 'drawn at home',
  }),
  patch('l.sample.collectAgain', '/samples/6a9bcd33ac172e44b8c4ef2f/status', { status: 'Collected' }),
  patch('l.sample.completeDirect', '/samples/6a9bcd33ac172e44b8c4ef2f/status', { status: 'Completed' }),
  patch('l.sample.illegal', '/samples/6a9bcd33ac172e44b8c4ef2f/status', { status: 'Registered' }),
  patch('l.sample.receive', '/samples/6a9bcd33ac172e44b8c4ef2f/status', { status: 'Received' }),
  get('l.sample.timeline', '/samples/6a9bcd33ac172e44b8c4ef2f/timeline'),
  {
    ...get('l.results.openSheet', '/results/sample/6a9bcd33ac172e44b8c4ef2f'),
    keep: (b, c) => {
      c.values.sheet = b?.data?.results || [];
    },
  },
  get('l.results.openSheetAgain', '/results/sample/6a9bcd33ac172e44b8c4ef2f'),
  get('l.results.openSheetBadId', '/results/sample/nope'),
  get('l.results.visit', '/results/visit/6a9bcd33ac172e44b8c4ef2f'),
  post('l.results.draftEmpty', '/results/draft', { sampleId: '6a9bcd33ac172e44b8c4ef2f', results: [] }),
  post('l.results.draft', '/results/draft', (c: Ctx) => ({
    sampleId: '6a9bcd33ac172e44b8c4ef2f',
    results: filledSheet(c.values.sheet),
    overallRemarks: ' looks fine ',
  }), { keep: keepId('labResult') }),
  post('l.results.submitEmpty', '/results/submit', (c: Ctx) => ({
    sampleId: '6a9bcd33ac172e44b8c4ef2f',
    results: (c.values.sheet || []).map((r: any) => ({ ...r, value: '' })),
  })),
  post('l.results.submit', '/results/submit', (c: Ctx) => ({
    sampleId: '6a9bcd33ac172e44b8c4ef2f',
    results: filledSheet(c.values.sheet).map((r: any, i: number) => (i === 0 ? { ...r, flag: 'Critical', flagManual: true } : r)),
  })),
  get('l.results.pending', '/results/pending'),
  get('l.sample.afterSubmit', '/samples/6a9bcd33ac172e44b8c4ef2f'),
  patch('l.results.verifyUnderReview', (c) => `/results/${c.ids.labResult}/verify`, { action: 'Under Review' }, { as: 'pathologist' }),
  patch('l.results.approve', (c) => `/results/${c.ids.labResult}/verify`, { action: 'Approve' }, { as: 'pathologist' }),
  post('l.results.draftLocked', '/results/draft', (c: Ctx) => ({ sampleId: '6a9bcd33ac172e44b8c4ef2f', results: filledSheet(c.values.sheet) }), {
    as: 'receptionist',
  }),
  get('l.results.byId', (c) => `/results/${c.ids.labResult}`),
  get('l.results.pdf', (c) => `/results/${c.ids.labResult}/pdf`),
  get('l.results.docx', (c) => `/results/${c.ids.labResult}/docx`),
  get('l.results.patientReports', '/results/patient-reports?limit=100'),
  get('l.results.patientReportsSearch', '/results/patient-reports?search=cbc'),
  get('l.results.list', '/results?limit=100'),
  get('l.sample.afterApprove', '/samples/6a9bcd33ac172e44b8c4ef2f/timeline'),
  post('l.saved.provisional', (c) => `/saved-reports/from-result/${c.ids.labResult}`, { provisional: true }),
  post('l.saved.final', (c) => `/saved-reports/from-result/${c.ids.labResult}`, {}, {
    keep: (b, c) => {
      if (b?.data?._id) c.ids.savedNew = String(b.data._id);
    },
  }),
  post('l.saved.badId', '/saved-reports/from-result/xyz', {}),
  get('l.saved.list', '/saved-reports?limit=50'),
  get('l.saved.search', '/saved-reports?search=cbc'),
  get('l.saved.file', (c) => `/saved-reports/${c.ids.savedNew}/file`),

  // A draw refused and taken again
  patch('l.sample.rejectNoReason', '/samples/6a9bcd33ac172e44b8c4ef3e/reject', {}),
  patch('l.sample.reject', '/samples/6a9bcd33ac172e44b8c4ef3e/reject', { rejectionReason: 'Haemolysed', rejectionRemarks: ' clotted ' }),
  patch('l.sample.recollect', '/samples/6a9bcd33ac172e44b8c4ef3e/recollect', { remarks: 'second draw' }),
  get('l.sample.recollectedTimeline', '/samples/6a9bcd33ac172e44b8c4ef3e/timeline'),
  post('l.results.submitRejectedPath', '/results/submit', { sampleId: '6a9bcd33ac172e44b8c4ef3e', results: [{ parameterName: 'X', value: '1' }] }),
  get('l.sample.stats', '/samples/stats'),
  get('l.sample.list', '/samples?limit=100'),
  get('l.sample.multiStatus', '/samples?status=Received,Processing&limit=100'),
];

const T = {
  cbc: '6a9bcd0de022c57f9a236d5c',
  fbs: '6a9bcd0de022c57f9a236d5d',
  hb: '6aa134f94327c9750f9cd21c',
  esr: '6aa134f94327c9750f9cd21d',
  tlc: '6aa134f94327c9750f9cd21e',
  pbs: '6aa134f94327c9750f9cd221',
};

const keepInvoice = (key: string) => (body: any, ctx: Ctx) => {
  const inv = body?.data?.invoice;
  if (inv?._id) ctx.ids[key] = String(inv._id);
  if (inv?.barcode) ctx.values[`${key}Barcode`] = inv.barcode;
  if (body?.data?.patient?._id) ctx.ids[`${key}Patient`] = String(body.data.patient._id);
};

const MONEY: Step[] = [
  // Intake
  post('m.visit.newPatient', '/billing/visit', (c: Ctx) => ({
    patient: { patientName: ' Money Tester ', gender: 'Female', age: 29, mobile: '9700000001', city: 'Pune' },
    doctorId: c.ids.doctor,
    items: [{ testId: T.cbc }, { testId: T.fbs, rate: 280, discountAmount: 20, processingMode: 'Outsource', outsourceLab: 'Ref Lab' }],
    discountType: 'Percentage',
    discountValue: 5,
    discountDoctorId: c.ids.doctor,
    paymentSplits: [
      { method: 'Cash', amount: 100 },
      { method: 'UPI', amount: 50.555, transactionRef: 'UPI-REF-1' },
    ],
    priority: 'Urgent',
    chiefComplaint: 'fever',
  }), { keep: keepInvoice('mVisit') }),
  post('m.visit.existingCredit', '/billing/visit', (c: Ctx) => ({
    patientId: c.ids.mVisitPatient,
    testIds: [T.hb, T.hb, T.esr],
    paymentMethod: 'Credit',
  }), { keep: keepInvoice('mCredit') }),
  post('m.invoice.overpaid', '/billing', (c: Ctx) => ({
    patientId: c.ids.patient,
    organizationId: c.ids.organization,
    testIds: [T.tlc, T.pbs],
    paidAmount: 99999,
    paymentMethod: 'Card',
    discountType: 'Fixed',
    discountValue: 33.333,
  }), { keep: keepInvoice('mOver') }),
  post('m.invoice.partial', '/billing', (c: Ctx) => ({
    patientId: c.ids.patient,
    doctorName: '  Dr. Outside ',
    items: [{ testId: T.cbc, referralRate: 650 }, { testId: T.esr }],
    paidAmount: 150,
    paymentMethod: 'Cheque',
  }), { keep: keepInvoice('mPartial') }),
  post('m.invoice.bigDiscountDesk', '/billing', (c: Ctx) => ({ patientId: c.ids.patient, testIds: [T.cbc], discountType: 'Percentage', discountValue: 50 }), {
    as: 'receptionist',
  }),
  post('m.invoice.lineDiscountDesk', '/billing', (c: Ctx) => ({ patientId: c.ids.patient, items: [{ testId: T.cbc, rate: 100 }] }), { as: 'receptionist' }),
  post('m.invoice.missingTest', '/billing', (c: Ctx) => ({ patientId: c.ids.patient, testIds: ['000000000000000000000000'] })),
  post('m.invoice.badTestId', '/billing', (c: Ctx) => ({ patientId: c.ids.patient, testIds: ['xyz'] })),
  post('m.invoice.badPatient', '/billing', { patientId: '000000000000000000000000', testIds: [T.cbc] }),
  post('m.invoice.creditSplit', '/billing', (c: Ctx) => ({
    patientId: c.ids.patient,
    testIds: [T.cbc],
    paymentSplits: [{ method: 'Credit', amount: 10 }, { method: 'Cash', amount: 10 }],
  })),
  post('m.visit.noPatient', '/billing/visit', { testIds: [T.cbc] }),
  // A package billed whole
  post('m.pkg.create', '/packages', { packageName: 'Money Panel', packageCode: 'MPAN', tests: [T.hb, T.esr, T.tlc], rate: 300 }, { keep: keepId('mPkg') }),
  post('m.invoice.package', '/billing', (c: Ctx) => ({
    patientId: c.ids.patient,
    items: [
      { testId: T.hb, packageId: c.ids.mPkg, packageName: 'typed name' },
      { testId: T.esr, packageId: c.ids.mPkg },
      { testId: T.tlc, packageId: c.ids.mPkg },
      { testId: T.pbs, packageId: 'nonsense' },
    ],
    paidAmount: 200,
  }), { as: 'receptionist', keep: keepInvoice('mPackage') }),
  get('m.invoice.byId', (c) => `/billing/${c.ids.mVisit}`),
  get('m.invoice.byBarcode', (c) => `/billing/barcode/${c.values.mVisitBarcode}`),
  get('m.invoice.byBarcodeMissing', '/billing/barcode/NOPE-1'),

  // Revising a bill
  put('m.revise.addTest', (c) => `/billing/${c.ids.mPartial}`, { addItems: [{ testId: T.tlc, discountAmount: 10 }], revisionNote: 'added TLC' }),
  put('m.revise.discount', (c) => `/billing/${c.ids.mPartial}`, (c: Ctx) => ({
    discountType: 'Fixed',
    discountValue: 25,
    discountReason: 'camp',
    discountDoctorId: c.ids.doctor,
    priority: 'Urgent',
  })),
  put('m.revise.duplicate', (c) => `/billing/${c.ids.mPartial}`, { addItems: [{ testId: T.cbc }] }),
  put('m.revise.belowPaid', (c) => `/billing/${c.ids.mOver}`, { discountType: 'Percentage', discountValue: 100 }),
  put('m.revise.nothing', (c) => `/billing/${c.ids.mPartial}`, {}),
  put('m.revise.asDesk', (c) => `/billing/${c.ids.mCredit}`, { clinicalNotes: 'repeat' }, { as: 'receptionist' }),

  // Collecting
  post('m.pay.cash', (c) => `/billing/${c.ids.mPartial}/payments`, { amount: 50, paymentMethod: 'Cash' }),
  post('m.pay.split', (c) => `/billing/${c.ids.mPartial}/payments`, {
    paymentSplits: [{ method: 'Card', amount: 10, transactionRef: 'CARD-9' }, { method: 'UPI', amount: 15.25 }],
    notes: 'second visit',
  }),
  post('m.pay.overpay', (c) => `/billing/${c.ids.mPartial}/payments`, { amount: 99999, paymentMethod: 'UPI' }),
  post('m.pay.alreadyPaid', (c) => `/billing/${c.ids.mPartial}/payments`, { amount: 5, paymentMethod: 'Cash' }),
  post('m.pay.missing', '/billing/000000000000000000000000/payments', { amount: 5, paymentMethod: 'Cash' }),
  get('m.invoice.afterPayments', (c) => `/billing/${c.ids.mPartial}`),

  // Collecting through the gateway
  post('m.gw.upi', '/payment-gateway/initiate', (c: Ctx) => ({ invoiceId: c.ids.mCredit, amount: 100.9, method: 'UPI', vpa: ' tester@okbank ' }), {
    keep: (b, c) => {
      c.values.txn1 = b?.data?.txnId;
      c.values.token1 = b?.data?.payerToken;
    },
  }),
  get('m.gw.status', (c) => `/payment-gateway/${c.values.txn1}`),
  post('m.gw.badToken', (c) => `/payment-gateway/${c.values.txn1}/simulate`, { token: 'x'.repeat(20), outcome: 'success' }, { as: 'none' }),
  post('m.gw.fail', (c) => `/payment-gateway/${c.values.txn1}/simulate`, (c: Ctx) => ({ token: c.values.token1, outcome: 'failure', reason: 'insufficient funds' }), {
    as: 'none',
  }),
  post('m.gw.card', '/payment-gateway/initiate', (c: Ctx) => ({ invoiceId: c.ids.mCredit, amount: 200, method: 'Card' }), {
    keep: (b, c) => {
      c.values.txn2 = b?.data?.txnId;
      c.values.token2 = b?.data?.payerToken;
    },
  }),
  post('m.gw.upiAgain', '/payment-gateway/initiate', (c: Ctx) => ({ invoiceId: c.ids.mCredit, amount: 150, method: 'UPI' }), {
    keep: (b, c) => {
      c.values.txn3 = b?.data?.txnId;
      c.values.token3 = b?.data?.payerToken;
    },
  }),
  get('m.gw.supersededCard', (c) => `/payment-gateway/${c.values.txn2}`),
  post('m.gw.success', (c) => `/payment-gateway/${c.values.txn3}/simulate`, (c: Ctx) => ({ token: c.values.token3, outcome: 'success', vpa: 'payer@okbank' }), {
    as: 'none',
  }),
  post('m.gw.successAgain', (c) => `/payment-gateway/${c.values.txn3}/simulate`, (c: Ctx) => ({ token: c.values.token3, outcome: 'success' }), { as: 'none' }),
  post('m.gw.cancelDone', (c) => `/payment-gateway/${c.values.txn3}/cancel`),
  post('m.gw.cardAgain', '/payment-gateway/initiate', (c: Ctx) => ({ invoiceId: c.ids.mCredit, amount: 25, method: 'Card' }), {
    keep: (b, c) => {
      c.values.txn4 = b?.data?.txnId;
    },
  }),
  post('m.gw.cancel', (c) => `/payment-gateway/${c.values.txn4}/cancel`),
  get('m.gw.list', (c) => `/payment-gateway/invoice/${c.ids.mCredit}`),
  get('m.gw.missing', '/payment-gateway/PGT-0000-999999'),
  post('m.gw.paidInvoice', '/payment-gateway/initiate', (c: Ctx) => ({ invoiceId: c.ids.mOver, amount: 10, method: 'UPI' })),
  get('m.invoice.afterGateway', (c) => `/billing/${c.ids.mCredit}`),

  // Refund policy
  get('m.refund.quote', (c) => `/refund-policy/quote/${c.ids.mVisit}`),
  put('m.refund.policy', '/refund-policy', {
    stages: { beforeCollection: { refundPercent: 90 }, afterCollection: { allowed: true, refundPercent: 40 } },
    cancellationFee: 15,
    policyNote: ' updated ',
  }),
  put('m.refund.policyBad', '/refund-policy', { stages: { afterReport: { refundPercent: 140 } } }),
  get('m.refund.quoteAfter', (c) => `/refund-policy/quote/${c.ids.mVisit}`),
  post('m.refund.cancel', '/refund-policy/cancel-tests', (c: Ctx) => ({
    invoiceId: c.ids.mVisit,
    itemIndexes: [1],
    reason: 'patient left',
    paymentMethod: 'Cash',
  })),
  post('m.refund.cancelAgain', '/refund-policy/cancel-tests', (c: Ctx) => ({
    invoiceId: c.ids.mVisit,
    itemIndexes: [1],
    reason: 'again',
    paymentMethod: 'Cash',
  })),
  post('m.refund.cancelOverride', '/refund-policy/cancel-tests', (c: Ctx) => ({
    invoiceId: c.ids.mOver,
    itemIndexes: [0],
    reason: 'doctor changed',
    paymentMethod: 'UPI',
    overrideAmount: 99.4,
    overrideReason: 'goodwill',
  })),
  post('m.refund.cancelBadLine', '/refund-policy/cancel-tests', (c: Ctx) => ({ invoiceId: c.ids.mOver, itemIndexes: [9], reason: 'x y', paymentMethod: 'Cash' })),
  get('m.refund.quoteFinal', (c) => `/refund-policy/quote/${c.ids.mVisit}`),
  get('m.refund.samplesAfter', (c) => `/billing/${c.ids.mVisit}`),

  // Accounts
  post('m.acc.refund', '/accounts/refunds', (c: Ctx) => ({ invoiceId: c.ids.mPackage, refundAmount: 20.5, reason: 'overcharged', paymentMethod: 'UPI', remarks: 'ok' })),
  post('m.acc.refundTooMuch', '/accounts/refunds', (c: Ctx) => ({ invoiceId: c.ids.mPackage, refundAmount: 99999, reason: 'overcharged', paymentMethod: 'Cash' })),
  post('m.acc.payoutDesk', '/accounts/payouts', (c: Ctx) => ({
    payeeType: 'Ambulance',
    payeeName: 'City Ambulance',
    description: 'pickup',
    amount: 9000,
    paymentMethod: 'Cash',
    expenseDate: '2026-09-10',
    patientId: c.ids.patient,
  }), { as: 'receptionist', keep: keepId('payout1') }),
  post('m.acc.payoutSmallDesk', '/accounts/payouts', { payeeType: 'Courier', payeeName: 'Speed Post', description: 'samples out', amount: 250, paymentMethod: 'UPI' }, {
    as: 'receptionist',
    keep: keepId('payout2'),
  }),
  post('m.acc.payoutDoctor', '/accounts/payouts', (c: Ctx) => ({
    payeeType: 'Doctor Referral',
    payeeName: 'Dr. Cut',
    description: 'september cut',
    amount: 1200,
    paymentMethod: 'Bank Transfer',
    doctorId: c.ids.doctor,
    invoiceId: c.ids.mVisit,
  }), { keep: keepId('payout3') }),
  post('m.acc.expenseAlias', '/accounts/expenses', { payeeType: 'Rent & Utilities', payeeName: 'Landlord', description: 'rent', amount: 15000, paymentMethod: 'Cheque' }),
  patch('m.acc.approve', (c) => `/accounts/payouts/${c.ids.payout1}/status`, { status: 'Paid' }),
  patch('m.acc.approveAgain', (c) => `/accounts/payouts/${c.ids.payout1}/status`, { status: 'Paid' }),
  patch('m.acc.rejectNoReason', (c) => `/accounts/payouts/${c.ids.payout2}/status`, { status: 'Rejected' }),
  del('m.acc.delete', (c) => `/accounts/payouts/${c.ids.payout2}`),
  del('m.acc.deleteMissing', '/accounts/payouts/000000000000000000000000'),
  get('m.acc.payouts', '/accounts/payouts?limit=100'),
  get('m.acc.payoutsByName', '/accounts/payouts?payeeName=city&from=2026-09-01&to=2026-09-30'),
  get('m.acc.summary', '/accounts/payouts/summary?from=2026-09-01&to=2026-09-30'),
  get('m.acc.commissions', '/accounts/doctor-commissions'),
  get('m.acc.refunds', '/accounts/refunds?limit=50'),
  get('m.acc.daily', '/accounts/collections/daily'),
  get('m.acc.dailyBad', '/accounts/collections/daily?date=garbage'),
  get('m.acc.trend', '/accounts/collections/trend?days=10'),
  get('m.acc.overall', '/accounts/collections/overall'),
  get('m.acc.ledger', '/accounts/ledger?limit=200'),
  get('m.acc.ledgerStaff', '/accounts/ledger?handledBy=admin,emily&limit=200'),
  get('m.acc.ledgerSplit', '/accounts/ledger?paymentMethod=Split&limit=200'),
  get('m.acc.ledgerPatient', (c) => `/accounts/ledger?patientId=${c.ids.mVisitPatient}`),
  get('m.acc.ledgerSearch', '/accounts/ledger?search=money&limit=200'),
  get('m.acc.ledgerPayouts', '/accounts/ledger?flowType=payout&payeeType=Ambulance'),
  get('m.acc.ledgerTimes', `/accounts/ledger?from=${today}&to=${today}&fromTime=00:00&toTime=23:59`),
  get('m.acc.staffNames', '/accounts/ledger/staff'),

  // Directory reads over the new bills
  get('m.bills.all', '/billing?limit=100'),
  get('m.bills.upi', '/billing?paymentMethod=UPI&limit=100'),
  get('m.bills.credit', '/billing?paymentMethod=Credit&limit=100'),
  get('m.bills.cash', '/billing?paymentMethod=Cash&limit=100'),
  get('m.bills.paid', '/billing?paymentStatus=Paid&limit=100'),
  get('m.bills.unpaid', '/billing?paymentStatus=Unpaid&limit=100'),
  get('m.bills.partial', '/billing?paymentStatus=Partial&limit=100'),
  get('m.bills.outsource', '/billing?processingMode=Outsource&limit=100'),
  get('m.bills.inhouse', '/billing?processingMode=In-house&limit=100'),
  get('m.bills.searchName', '/billing?search=money'),
  get('m.bills.patient', (c) => `/billing?patient=${c.ids.mVisitPatient}`),
  get('m.bills.today', `/billing?from=${today}&to=${today}`),
  get('m.tests.all', '/billing/tests?limit=500'),
  get('m.tests.pending', '/billing/tests?status=Pending&limit=500'),
  get('m.tests.cancelled', '/billing/tests?status=Cancelled&limit=500'),
  get('m.tests.completed', '/billing/tests?status=Completed&limit=500'),
  get('m.tests.dayCount', '/billing/tests?view=daycount&limit=5'),
  get('m.tests.dayCountCancelled', '/billing/tests?view=daycount&status=Cancelled'),
  get('m.tests.byDoctor', (c) => `/billing/tests?doctor=${c.ids.doctor}&limit=500`),
  get('m.tests.byOrg', (c) => `/billing/tests?organization=${c.ids.organization}&limit=500`),
  get('m.tests.byDept', (c) => `/billing/tests?department=${c.ids.department}&limit=500`),
  get('m.tests.outsource', '/billing/tests?processingMode=Outsource'),
  get('m.tests.search', '/billing/tests?search=cbc&limit=500'),
  get('m.tests.searchDoctor', '/billing/tests?search=outside&limit=500'),
  get('m.tests.paidUpi', '/billing/tests?paymentMethod=UPI&paymentStatus=Paid&limit=500'),
  get('m.tests.page2', '/billing/tests?page=2&limit=7'),
  get('m.tests.today', `/billing/tests?from=${today}&to=${today}&limit=500`),

  // The owner's charts after all of it
  get('m.reports.daily', '/reports/revenue/daily'),
  get('m.reports.monthly', '/reports/revenue/monthly'),
  get('m.reports.patients', '/reports/patients/trend'),
  get('m.reports.tests', '/reports/tests/revenue'),
  get('m.reports.departments', '/reports/departments/tests'),
  { ...get('m.reports.doctors', '/reports/doctors/tests'), unordered: true },
  { ...get('m.reports.methods', '/reports/payments/methods'), unordered: true },
  get('m.reports.pending', '/reports/payments/pending'),
  { ...get('m.reports.corporate', '/reports/corporate/revenue'), unordered: true },
  get('m.reports.referrals', '/reports/doctors/referrals'),
  get('m.reports.referralsDoctor', (c) => `/reports/doctors/referrals?doctor=${c.ids.doctor}`),
  get('m.patient.history', (c) => `/patients/${c.ids.mVisitPatient}/history`),
  get('m.audit.billing', '/audit-logs?module=BILLING&limit=50'),
];

/**
 * Inputs Mongo accepted and Postgres refuses, by design. They run last, so
 * the row Mongo stored does not ripple into every list after it, and are
 * reported apart from real differences.
 */
const REFUSED_NOW: Step[] = [
  {
    ...put('x.dept.updateBadStatus', (c) => `/departments/${c.ids.newDept}`, { status: 'Dormant' }),
    known: 'An update outside the enum was stored by Mongo (no validators on update); the CHECK constraint refuses it with a 400.',
  },
  {
    ...post('x.doctor.createMissingDept', '/doctors', { doctorName: 'Dr. Bad', department: '000000000000000000000000', mobile: '9123456789' }),
    known: 'Mongo stored a doctor pointing at a department that does not exist; the foreign key refuses it with a 400.',
  },
];

export const WRITES: Step[] = [...STAFF, ...MASTERS, ...CATALOGUE, ...PATIENTS, ...LAB, ...MONEY, ...REFUSED_NOW];

export const SCENARIO: Step[] = [...READS, ...WRITES];
