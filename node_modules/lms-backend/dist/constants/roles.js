"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_STATUSES = exports.USER_ROLES = exports.ALL_ROLES = exports.PHLEBOTOMIST = exports.ACCOUNTANT = exports.RECEPTIONIST = exports.LAB_TECHNICIAN = exports.PATHOLOGIST = exports.ADMIN = exports.ROLES = void 0;
/**
 * Staff roles for a diagnostic centre. There is no Super Admin tier - the
 * centre owner logs in as Admin and Admin is the top of the tree, so every
 * privileged action is one role away rather than two.
 */
exports.ROLES = {
    ADMIN: 'Admin',
    PATHOLOGIST: 'Pathologist',
    LAB_TECHNICIAN: 'Lab Technician',
    RECEPTIONIST: 'Receptionist',
    ACCOUNTANT: 'Accountant',
    PHLEBOTOMIST: 'Phlebotomist',
};
exports.ADMIN = 'Admin';
exports.PATHOLOGIST = 'Pathologist';
exports.LAB_TECHNICIAN = 'Lab Technician';
exports.RECEPTIONIST = 'Receptionist';
exports.ACCOUNTANT = 'Accountant';
exports.PHLEBOTOMIST = 'Phlebotomist';
exports.ALL_ROLES = Object.values(exports.ROLES);
exports.USER_ROLES = exports.ALL_ROLES;
exports.ALL_STATUSES = ['Active', 'Inactive'];
exports.default = exports.ROLES;
