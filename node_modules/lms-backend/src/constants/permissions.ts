import { ROLES } from './roles';

/**
 * Every guarded action in the centre, named after what the staff member is
 * actually doing at the desk rather than after the HTTP route. Routes map onto
 * these so a role's reach can be read in one place instead of being scattered
 * across a dozen `authorize([...])` lists.
 */
export const PERMISSIONS = {
  // Front desk
  PATIENT_VIEW: 'patient:view',
  PATIENT_CREATE: 'patient:create',
  PATIENT_EDIT: 'patient:edit',
  PATIENT_HISTORY: 'patient:history',

  BILL_VIEW: 'bill:view',
  BILL_CREATE: 'bill:create',
  BILL_COLLECT_PAYMENT: 'bill:collect-payment',
  BILL_DISCOUNT_OVERRIDE: 'bill:discount-override',
  BILL_CANCEL: 'bill:cancel',

  APPOINTMENT_VIEW: 'appointment:view',
  APPOINTMENT_MANAGE: 'appointment:manage',

  // Money going out
  PAYOUT_VIEW: 'payout:view',
  PAYOUT_CREATE: 'payout:create',
  PAYOUT_APPROVE: 'payout:approve',
  PAYOUT_DELETE: 'payout:delete',
  REFUND_VIEW: 'refund:view',
  REFUND_ISSUE: 'refund:issue',
  /** Writing the return policy itself - what a cancelled test is worth back. */
  REFUND_POLICY_MANAGE: 'refund:policy-manage',

  // Laboratory
  SAMPLE_VIEW: 'sample:view',
  SAMPLE_COLLECT: 'sample:collect',
  SAMPLE_PROCESS: 'sample:process',
  SAMPLE_REJECT: 'sample:reject',
  RESULT_VIEW: 'result:view',
  RESULT_ENTER: 'result:enter',
  RESULT_VERIFY: 'result:verify',

  // Masters - the catalogue the centre is configured with
  MASTER_VIEW: 'master:view',
  DOCTOR_MANAGE: 'doctor:manage',
  TEST_MANAGE: 'test:manage',
  RATE_MANAGE: 'rate:manage',
  DEPARTMENT_MANAGE: 'department:manage',
  ORGANIZATION_MANAGE: 'organization:manage',

  // Administration
  STAFF_MANAGE: 'staff:manage',
  REPORT_VIEW: 'report:view',
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

/** Everything a front-desk receptionist needs and nothing beyond it. */
const RECEPTIONIST_PERMISSIONS: Permission[] = [
  P.PATIENT_VIEW,
  P.PATIENT_CREATE,
  P.PATIENT_EDIT,
  P.PATIENT_HISTORY,
  P.BILL_VIEW,
  P.BILL_CREATE,
  P.BILL_COLLECT_PAYMENT,
  P.APPOINTMENT_VIEW,
  P.APPOINTMENT_MANAGE,
  // Cash handed to the ambulance driver, courier, etc. Recording is allowed;
  // approving your own payout is not - that stays with the Admin.
  P.PAYOUT_VIEW,
  P.PAYOUT_CREATE,
  // A patient who changes their mind is standing at the counter, so the desk
  // can cancel a test and hand the money back. Writing the policy that prices
  // it (REFUND_POLICY_MANAGE) stays with the Admin.
  P.REFUND_VIEW,
  P.REFUND_ISSUE,
  // Read-only on the catalogue, because a bill cannot be raised without
  // seeing tests, rates and referring doctors.
  P.MASTER_VIEW,
  // Hand-off to the lab: the front desk marks a walk-in draw as collected.
  P.SAMPLE_VIEW,
  P.SAMPLE_COLLECT,
];

const ADMIN_PERMISSIONS: Permission[] = Object.values(P);

/**
 * The starting point for each role. When a staff account is created these are
 * pre-ticked for the chosen role; the Admin then adds or removes permissions
 * for that one person, and the account keeps its own list from then on.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [ROLES.ADMIN]: ADMIN_PERMISSIONS,

  [ROLES.RECEPTIONIST]: RECEPTIONIST_PERMISSIONS,

  [ROLES.PHLEBOTOMIST]: [
    P.PATIENT_VIEW,
    P.APPOINTMENT_VIEW,
    P.APPOINTMENT_MANAGE,
    P.SAMPLE_VIEW,
    P.SAMPLE_COLLECT,
    P.SAMPLE_REJECT,
    P.MASTER_VIEW,
  ],

  [ROLES.LAB_TECHNICIAN]: [
    P.PATIENT_VIEW,
    P.SAMPLE_VIEW,
    P.SAMPLE_COLLECT,
    P.SAMPLE_PROCESS,
    P.SAMPLE_REJECT,
    P.RESULT_VIEW,
    P.RESULT_ENTER,
    P.MASTER_VIEW,
  ],

  [ROLES.PATHOLOGIST]: [
    P.PATIENT_VIEW,
    P.PATIENT_HISTORY,
    P.SAMPLE_VIEW,
    // The pathologist runs the whole bench in a smaller lab, from the draw
    // onwards, so they can mark a sample collected like the phlebotomist.
    P.SAMPLE_COLLECT,
    P.SAMPLE_PROCESS,
    P.SAMPLE_REJECT,
    P.RESULT_VIEW,
    P.RESULT_ENTER,
    P.RESULT_VERIFY,
    P.MASTER_VIEW,
    P.REPORT_VIEW,
  ],

  [ROLES.ACCOUNTANT]: [
    P.PATIENT_VIEW,
    P.PATIENT_HISTORY,
    P.BILL_VIEW,
    P.BILL_COLLECT_PAYMENT,
    P.PAYOUT_VIEW,
    P.PAYOUT_CREATE,
    P.PAYOUT_APPROVE,
    P.REFUND_VIEW,
    P.REFUND_ISSUE,
    P.MASTER_VIEW,
    P.ORGANIZATION_MANAGE,
    P.REPORT_VIEW,
  ],
};

/** The role the matrix cannot be changed for, so the centre can never lock itself out. */
export const LOCKED_ROLE = ROLES.ADMIN;

const ALL_PERMISSIONS = Object.values(P) as Permission[];

export const isPermission = (value: string): value is Permission =>
  (ALL_PERMISSIONS as string[]).includes(value);

/**
 * The live matrix every guard reads. Starts as the defaults and is replaced
 * role by role with what the Admin saved (see RolePermissionService).
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = Object.fromEntries(
  Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, list]) => [role, [...list]])
);

export const setRolePermissions = (role: string, permissions: string[]): void => {
  if (role === LOCKED_ROLE) return;
  ROLE_PERMISSIONS[role] = Array.from(new Set(permissions.filter(isPermission)));
};

export const resetRolePermissions = (role: string): void => {
  if (role === LOCKED_ROLE) return;
  ROLE_PERMISSIONS[role] = [...(DEFAULT_ROLE_PERMISSIONS[role] || [])];
};

/**
 * What each permission means, in the words the Admin reads on the screen,
 * grouped the way the sidebar is.
 */
export const PERMISSION_CATALOG: Array<{ group: string; key: Permission; label: string; description: string }> = [
  { group: 'Front desk', key: P.PATIENT_VIEW, label: 'View patients', description: 'Open the patient list and profiles' },
  { group: 'Front desk', key: P.PATIENT_CREATE, label: 'Register patients', description: 'Add a new patient' },
  { group: 'Front desk', key: P.PATIENT_EDIT, label: 'Edit patients', description: 'Change a patient’s details' },
  { group: 'Front desk', key: P.PATIENT_HISTORY, label: 'Patient history', description: 'See past visits, bills and reports' },
  { group: 'Front desk', key: P.APPOINTMENT_VIEW, label: 'View appointments', description: 'Appointments and home collection' },
  { group: 'Front desk', key: P.APPOINTMENT_MANAGE, label: 'Manage appointments', description: 'Book, reschedule and cancel' },

  { group: 'Billing', key: P.BILL_VIEW, label: 'View bills', description: 'Bill list, booked tests, ledger and collections' },
  { group: 'Billing', key: P.BILL_CREATE, label: 'Create & revise bills', description: 'New visit, new bill, add tests to a bill' },
  { group: 'Billing', key: P.BILL_COLLECT_PAYMENT, label: 'Collect payment', description: 'Take money against a bill' },
  {
    group: 'Billing',
    key: P.BILL_DISCOUNT_OVERRIDE,
    label: 'Discount above limit',
    description: 'Give more discount than the staff ceiling',
  },
  { group: 'Billing', key: P.BILL_CANCEL, label: 'Cancel bills', description: 'Cancel a whole bill' },

  { group: 'Money out', key: P.PAYOUT_VIEW, label: 'View payouts', description: 'See cash paid out' },
  { group: 'Money out', key: P.PAYOUT_CREATE, label: 'Record payouts', description: 'Ambulance, courier, doctor cut, etc.' },
  { group: 'Money out', key: P.PAYOUT_APPROVE, label: 'Approve payouts', description: 'Approve pending payouts' },
  { group: 'Money out', key: P.PAYOUT_DELETE, label: 'Delete payouts', description: 'Remove a payout entry' },
  { group: 'Money out', key: P.REFUND_VIEW, label: 'View refunds', description: 'Accounts & Refunds screen' },
  { group: 'Money out', key: P.REFUND_ISSUE, label: 'Cancel test & refund', description: 'Cancel tests and issue refunds' },
  {
    group: 'Money out',
    key: P.REFUND_POLICY_MANAGE,
    label: 'Refund policy',
    description: 'Edit the refund policy and override it on a refund',
  },

  { group: 'Laboratory', key: P.SAMPLE_VIEW, label: 'View samples', description: 'Lab workflow and sample directory' },
  { group: 'Laboratory', key: P.SAMPLE_COLLECT, label: 'Collect samples', description: 'Mark a sample collected' },
  { group: 'Laboratory', key: P.SAMPLE_PROCESS, label: 'Process samples', description: 'Receive and run samples on the bench' },
  { group: 'Laboratory', key: P.SAMPLE_REJECT, label: 'Reject samples', description: 'Reject a sample and ask for a redraw' },
  { group: 'Laboratory', key: P.RESULT_VIEW, label: 'View results', description: 'See entered results' },
  { group: 'Laboratory', key: P.RESULT_ENTER, label: 'Enter results', description: 'Result entry' },
  { group: 'Laboratory', key: P.RESULT_VERIFY, label: 'Verify & release', description: 'Verify results and release reports' },

  { group: 'Masters', key: P.MASTER_VIEW, label: 'View masters', description: 'Read tests, doctors (needed for billing)' },
  { group: 'Masters', key: P.DOCTOR_MANAGE, label: 'Manage doctors', description: 'Add and edit doctors' },
  { group: 'Masters', key: P.TEST_MANAGE, label: 'Manage tests', description: 'Test catalog and packages' },
  { group: 'Masters', key: P.DEPARTMENT_MANAGE, label: 'Manage departments', description: 'Add and edit departments' },
  { group: 'Masters', key: P.ORGANIZATION_MANAGE, label: 'Manage organizations', description: 'TPA / corporate organizations' },

  { group: 'Administration', key: P.STAFF_MANAGE, label: 'Staff & permissions', description: 'Add staff and choose what each person can do' },
  { group: 'Administration', key: P.REPORT_VIEW, label: 'Analytics reports', description: 'Reports and doctor commission' },
  { group: 'Administration', key: P.AUDIT_VIEW, label: 'Audit log', description: 'Who did what, and when' },
];

export const permissionsForRole = (role?: string): Permission[] =>
  (role && ROLE_PERMISSIONS[role]) || [];

/** Anything that carries a role and, optionally, its own granted list. */
export interface PermissionHolder {
  role?: string;
  permissions?: string[] | null;
}

/**
 * What one staff member may actually do. Each account carries its own list,
 * ticked when the Admin creates or edits it; an account saved before that
 * existed has none and falls back to its role's defaults. The Admin always
 * has everything, so the centre can never lock itself out.
 */
export const effectivePermissions = (holder?: PermissionHolder | null): Permission[] => {
  if (!holder) return [];
  if (holder.role === LOCKED_ROLE) return [...ALL_PERMISSIONS];
  if (Array.isArray(holder.permissions)) return holder.permissions.filter(isPermission);
  return permissionsForRole(holder.role);
};

export const can = (who: string | PermissionHolder | null | undefined, permission: Permission): boolean =>
  effectivePermissions(typeof who === 'string' ? { role: who } : who).includes(permission);

/**
 * Petty-cash ceiling for a payout recorded by anyone without PAYOUT_APPROVE.
 * Anything above this is filed as Pending and waits for the Admin, so the
 * ambulance fare goes out immediately but a large vendor payment does not.
 */
export const SELF_APPROVE_PAYOUT_LIMIT = Number(process.env.PAYOUT_SELF_APPROVE_LIMIT || 5000);

/** Discount a non-admin may apply on a bill without approval, in percent. */
export const MAX_STAFF_DISCOUNT_PERCENT = Number(process.env.MAX_STAFF_DISCOUNT_PERCENT || 20);
