"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYOUT_STATUSES = exports.PAYEE_TYPES = void 0;
/**
 * Who the money is going to. The centre pays an ambulance for a pickup far
 * more often than it buys a centrifuge, so the ambulance case is a first-class
 * payee type rather than a free-text category.
 */
exports.PAYEE_TYPES = [
    'Ambulance',
    'Doctor Referral',
    'Collection Agent',
    'Courier',
    'Staff Advance',
    'Vendor / Supplier',
    'Reagents & Consumables',
    'Equipment & Maintenance',
    'Rent & Utilities',
    'Other',
];
exports.PAYOUT_STATUSES = ['Pending', 'Paid', 'Rejected'];
