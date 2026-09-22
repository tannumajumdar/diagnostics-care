/**
 * Staff roles for a diagnostic centre. There is no Super Admin tier - the
 * centre owner logs in as Admin and Admin is the top of the tree, so every
 * privileged action is one role away rather than two.
 */
export const ROLES = {
  ADMIN: 'Admin',
  PATHOLOGIST: 'Pathologist',
  LAB_TECHNICIAN: 'Lab Technician',
  RECEPTIONIST: 'Receptionist',
  ACCOUNTANT: 'Accountant',
  PHLEBOTOMIST: 'Phlebotomist',
} as const;

export const ADMIN = 'Admin';
export const PATHOLOGIST = 'Pathologist';
export const LAB_TECHNICIAN = 'Lab Technician';
export const RECEPTIONIST = 'Receptionist';
export const ACCOUNTANT = 'Accountant';
export const PHLEBOTOMIST = 'Phlebotomist';

export const ALL_ROLES = Object.values(ROLES);
export const USER_ROLES = ALL_ROLES;
export const ALL_STATUSES = ['Active', 'Inactive'] as const;

export default ROLES;
