import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  FlaskConical,
  Building,
  Users,
  CreditCard,
  TestTube,
  FileCheck,
  ClipboardCheck,
  Calendar,
  Home,
  BarChart3,
  Syringe,
  Microscope,
  Workflow,
  Wallet,
  IndianRupee,
  UserCog,
  Package as PackageIcon,
  ClipboardList,
  Undo2,
  type LucideIcon,
} from 'lucide-react';

/** Mirrors ROLES in backend/src/constants/roles.ts. */
export type Role =
  | 'Admin'
  | 'Pathologist'
  | 'Lab Technician'
  | 'Receptionist'
  | 'Accountant'
  | 'Phlebotomist';

export const ALL_ROLES: Role[] = [
  'Admin',
  'Pathologist',
  'Lab Technician',
  'Receptionist',
  'Accountant',
  'Phlebotomist',
];

/**
 * Mirrors backend/src/constants/permissions.ts. The server is still the
 * authority - this copy exists so the UI never offers a button the API would
 * refuse, and it is only consulted when the signed-in user has no permission
 * list of their own (an older token issued before the matrix landed).
 */
export const PERMISSIONS = {
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

  PAYOUT_VIEW: 'payout:view',
  PAYOUT_CREATE: 'payout:create',
  PAYOUT_APPROVE: 'payout:approve',
  PAYOUT_DELETE: 'payout:delete',
  REFUND_VIEW: 'refund:view',
  REFUND_ISSUE: 'refund:issue',
  /** Writing the return policy itself - what a cancelled test is worth back. */
  REFUND_POLICY_MANAGE: 'refund:policy-manage',

  SAMPLE_VIEW: 'sample:view',
  SAMPLE_COLLECT: 'sample:collect',
  SAMPLE_PROCESS: 'sample:process',
  SAMPLE_REJECT: 'sample:reject',
  RESULT_VIEW: 'result:view',
  RESULT_ENTER: 'result:enter',
  RESULT_VERIFY: 'result:verify',

  MASTER_VIEW: 'master:view',
  DOCTOR_MANAGE: 'doctor:manage',
  TEST_MANAGE: 'test:manage',
  RATE_MANAGE: 'rate:manage',
  DEPARTMENT_MANAGE: 'department:manage',
  ORGANIZATION_MANAGE: 'organization:manage',

  STAFF_MANAGE: 'staff:manage',
  REPORT_VIEW: 'report:view',
  AUDIT_VIEW: 'audit:view',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

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
  P.PAYOUT_VIEW,
  P.PAYOUT_CREATE,
  P.MASTER_VIEW,
  P.SAMPLE_VIEW,
  P.SAMPLE_COLLECT,
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  Admin: Object.values(P),

  Receptionist: RECEPTIONIST_PERMISSIONS,

  Phlebotomist: [
    P.PATIENT_VIEW,
    P.APPOINTMENT_VIEW,
    P.APPOINTMENT_MANAGE,
    P.SAMPLE_VIEW,
    P.SAMPLE_COLLECT,
    P.SAMPLE_REJECT,
    P.MASTER_VIEW,
  ],

  'Lab Technician': [
    P.PATIENT_VIEW,
    P.SAMPLE_VIEW,
    P.SAMPLE_COLLECT,
    P.SAMPLE_PROCESS,
    P.SAMPLE_REJECT,
    P.RESULT_VIEW,
    P.RESULT_ENTER,
    P.MASTER_VIEW,
  ],

  Pathologist: [
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

  Accountant: [
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

export interface PermissionHolder {
  role?: string;
  permissions?: string[];
}

/** The signed-in user's granted list, falling back to the role matrix. */
export const permissionsFor = (user?: PermissionHolder | null): string[] => {
  if (!user) return [];
  if (Array.isArray(user.permissions) && user.permissions.length) return user.permissions;
  return ROLE_PERMISSIONS[user.role as Role] ?? [];
};

export const hasPermission = (user: PermissionHolder | null | undefined, ...required: Permission[]): boolean => {
  const granted = permissionsFor(user);
  return required.some((permission) => granted.includes(permission));
};

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  group: string;
  /** Any one of these is enough to see the entry and open the route. */
  permissions: Permission[];
  /** Match the route exactly instead of by prefix (used for the index route). */
  exact?: boolean;
  /**
   * Where this entry sits for a particular role, overriding `group`. The admin
   * does not work a front desk shift, so the desk's screens are filed under
   * the headings an owner reads them from - money under Finance, the patient
   * flow under Operations - instead of a "Front Office" section they are only
   * ever looking at, never working in.
   */
  groupForRole?: Partial<Record<Role, string>>;
  /**
   * Roles that should not be offered this entry in the menu. Permission is
   * unchanged, so the route still opens on a deep link - this only decides
   * what the sidebar puts in front of that role.
   */
  hiddenForRoles?: Role[];
}

/** The heading an item sits under for this user, honouring any role override. */
export const groupFor = (item: NavItem, user?: PermissionHolder | null): string =>
  item.groupForRole?.[user?.role as Role] ?? item.group;

/**
 * Single source of truth for navigation. Paths here must match the routes
 * declared in App.tsx, and each entry is gated by the same permission the API
 * enforces, so a desk is never shown a screen its token cannot load.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    group: 'Overview',
    permissions: [],
    exact: true,
  },

  // Front office - the receptionist's day, in the order it happens. The admin
  // sees these same screens, but filed under Operations and Finance.
  {
    label: 'New Visit',
    path: '/visits/new',
    icon: ClipboardList,
    group: 'Front Office',
    permissions: [P.BILL_CREATE],
    hiddenForRoles: ['Admin'],
  },
  {
    label: 'Patients',
    path: '/patients',
    icon: Users,
    group: 'Front Office',
    permissions: [P.PATIENT_VIEW],
    groupForRole: { Admin: 'Operations' },
  },
  {
    label: 'Billing & Invoices',
    path: '/billing',
    icon: CreditCard,
    group: 'Front Office',
    permissions: [P.BILL_VIEW],
    groupForRole: { Admin: 'Finance' },
  },
  {
    label: 'Appointments',
    path: '/appointments',
    icon: Calendar,
    group: 'Front Office',
    permissions: [P.APPOINTMENT_VIEW],
    groupForRole: { Admin: 'Operations' },
  },
  {
    label: 'Home Collection',
    path: '/home-collection',
    icon: Home,
    group: 'Front Office',
    permissions: [P.APPOINTMENT_VIEW],
    groupForRole: { Admin: 'Operations' },
  },
  {
    label: 'Payouts',
    path: '/payouts',
    icon: Wallet,
    group: 'Front Office',
    permissions: [P.PAYOUT_VIEW],
    groupForRole: { Admin: 'Finance' },
  },

  // Laboratory
  {
    label: 'Lab Workflow',
    path: '/workflow',
    icon: Workflow,
    group: 'Laboratory',
    permissions: [P.SAMPLE_VIEW],
  },
  {
    label: 'Collection Queue',
    path: '/samples/collection',
    icon: Syringe,
    group: 'Laboratory',
    permissions: [P.SAMPLE_COLLECT],
  },
  {
    label: 'Processing Queue',
    path: '/samples/pending',
    icon: Microscope,
    group: 'Laboratory',
    permissions: [P.SAMPLE_PROCESS],
  },
  {
    label: 'Sample Directory',
    path: '/samples',
    icon: TestTube,
    group: 'Laboratory',
    permissions: [P.SAMPLE_VIEW],
  },
  { label: 'Result Entry', path: '/results', icon: FileCheck, group: 'Laboratory', permissions: [P.RESULT_ENTER] },
  {
    label: 'Verification',
    path: '/results/pending',
    icon: ClipboardCheck,
    group: 'Laboratory',
    permissions: [P.RESULT_VERIFY],
  },

  // Masters - Admin territory
  {
    label: 'Departments',
    path: '/departments',
    icon: Building2,
    group: 'Masters',
    permissions: [P.DEPARTMENT_MANAGE],
  },
  { label: 'Doctors', path: '/doctors', icon: Stethoscope, group: 'Masters', permissions: [P.DOCTOR_MANAGE] },
  { label: 'Test Catalog', path: '/tests', icon: FlaskConical, group: 'Masters', permissions: [P.TEST_MANAGE] },
  {
    label: 'Test Packages',
    path: '/packages',
    icon: PackageIcon,
    group: 'Masters',
    permissions: [P.TEST_MANAGE],
  },
  { label: 'Rate Master', path: '/rates', icon: IndianRupee, group: 'Masters', permissions: [P.RATE_MANAGE] },
  {
    label: 'Organizations',
    path: '/organizations',
    icon: Building,
    group: 'Masters',
    permissions: [P.ORGANIZATION_MANAGE],
  },
  { label: 'Staff & Roles', path: '/staff', icon: UserCog, group: 'Masters', permissions: [P.STAFF_MANAGE] },
  {
    label: 'Refund Policy',
    path: '/refund-policy',
    icon: Undo2,
    group: 'Masters',
    permissions: [P.REFUND_POLICY_MANAGE],
  },

  // Finance
  {
    label: 'Accounts & Refunds',
    path: '/accounts',
    icon: IndianRupee,
    group: 'Finance',
    permissions: [P.REFUND_VIEW],
  },
  { label: 'Analytics Reports', path: '/reports', icon: BarChart3, group: 'Finance', permissions: [P.REPORT_VIEW] },
];

export const GROUP_ORDER = ['Overview', 'Front Office', 'Operations', 'Laboratory', 'Masters', 'Finance'];

export const canAccess = (item: NavItem, user?: PermissionHolder | null): boolean => {
  if (!user?.role) return false;
  if (!item.permissions.length) return true;
  return hasPermission(user, ...item.permissions);
};

/** Permission says the route opens; this says the menu offers it. */
const isListedFor = (item: NavItem, user?: PermissionHolder | null): boolean =>
  !item.hiddenForRoles?.includes(user?.role as Role);

export const navForUser = (user?: PermissionHolder | null): NavItem[] =>
  NAV_ITEMS.filter((item) => canAccess(item, user) && isListedFor(item, user));

/** Path -> allowed check, so a deep link is gated the same way the menu is. */
export const canAccessPath = (path: string, user?: PermissionHolder | null): boolean => {
  if (!user?.role) return false;
  const match = NAV_ITEMS.find((item) => item.path === path);
  return match ? canAccess(match, user) : true;
};

/**
 * Where a role lands after signing in. The front desk starts on the intake
 * screen because that is the first thing that happens when someone walks in -
 * a dashboard of counters is not what the receptionist needs at that moment.
 */
export const landingPathFor = (user?: PermissionHolder | null): string => {
  if (!user?.role) return '/';
  if (user.role === 'Receptionist') return '/visits/new';
  if (user.role === 'Phlebotomist') return '/samples/collection';
  if (user.role === 'Pathologist') return '/results/pending';
  if (user.role === 'Lab Technician') return '/samples/pending';
  return '/';
};

/** Short, role-appropriate framing for the dashboard header. */
export const ROLE_INTRO: Record<Role, { title: string; subtitle: string }> = {
  Admin: {
    title: 'Centre Control Panel',
    subtitle: 'Full oversight across the front desk, the laboratory and the money.',
  },
  Pathologist: {
    title: 'Verification Desk',
    subtitle: 'Results awaiting your review, sign-off and release.',
  },
  'Lab Technician': {
    title: 'Processing Bench',
    subtitle: 'Samples received and queued for analysis and result entry.',
  },
  Receptionist: {
    title: 'Front Desk',
    subtitle: 'Registration, billing, patient history and cash paid out.',
  },
  Accountant: {
    title: 'Finance Desk',
    subtitle: 'Collections, dues, payouts, refunds and revenue performance.',
  },
  Phlebotomist: {
    title: 'Collection Round',
    subtitle: 'Draws pending collection, including home visits.',
  },
};
