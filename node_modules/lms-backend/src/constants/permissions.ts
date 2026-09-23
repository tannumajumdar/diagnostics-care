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
  // Read-only on the catalogue, because a bill cannot be raised without
  // seeing tests, rates and referring doctors.
  P.MASTER_VIEW,
  // Hand-off to the lab: the front desk marks a walk-in draw as collected.
  P.SAMPLE_VIEW,
  P.SAMPLE_COLLECT,
];

const ADMIN_PERMISSIONS: Permission[] = Object.values(P);

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
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

export const permissionsForRole = (role?: string): Permission[] =>
  (role && ROLE_PERMISSIONS[role]) || [];

export const can = (role: string | undefined, permission: Permission): boolean =>
  permissionsForRole(role).includes(permission);

/**
 * Petty-cash ceiling for a payout recorded by anyone without PAYOUT_APPROVE.
 * Anything above this is filed as Pending and waits for the Admin, so the
 * ambulance fare goes out immediately but a large vendor payment does not.
 */
export const SELF_APPROVE_PAYOUT_LIMIT = Number(process.env.PAYOUT_SELF_APPROVE_LIMIT || 5000);

/** Discount a non-admin may apply on a bill without approval, in percent. */
export const MAX_STAFF_DISCOUNT_PERCENT = Number(process.env.MAX_STAFF_DISCOUNT_PERCENT || 20);
