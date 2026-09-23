"use strict";
/**
 * How money moves at the centre.
 *
 * This list used to be written out by hand in seven places - the payment,
 * refund and expense models, three validators and two aggregations - and they
 * had drifted apart: the desk could take a payment by a method the refund
 * screen could not give back, and the daily collection figure silently dropped
 * any method its if-else chain had not been taught about. One list, consumed
 * everywhere, so a method added here reaches every screen at once.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DISBURSEMENT_METHOD_VALUES = exports.COLLECTION_METHOD_VALUES = exports.METHOD_FIELDS = exports.METHOD_FIELD = exports.DISBURSEMENT_METHODS = exports.COLLECTION_METHODS = void 0;
/** Everything the centre can take money by. */
exports.COLLECTION_METHODS = [
    'Cash',
    'UPI',
    'Card',
    'Bank Transfer',
    'Cheque',
    'Online',
    // Not money in the drawer - the patient is billed and pays later. It is a
    // method at the counter because that is the choice the desk makes there.
    'Credit',
];
/**
 * How money goes back out - a refund to a patient, or a payout to a vendor.
 * "Credit" has no meaning here: there is no such thing as refunding someone
 * by promising to pay them later.
 */
exports.DISBURSEMENT_METHODS = exports.COLLECTION_METHODS.filter((m) => m !== 'Credit');
/**
 * The field each method is totalled into on a collection summary. Keeping the
 * mapping here means a new method cannot be added without deciding where it
 * lands in the books.
 */
exports.METHOD_FIELD = {
    Cash: 'cash',
    UPI: 'upi',
    Card: 'card',
    'Bank Transfer': 'bank',
    Cheque: 'cheque',
    Online: 'online',
    Credit: 'credit',
};
/** The keys a breakdown object carries, in the order a summary reads them. */
exports.METHOD_FIELDS = exports.COLLECTION_METHODS.map((m) => exports.METHOD_FIELD[m]);
/** Zod-friendly tuple form, since `z.enum` will not take a readonly array. */
exports.COLLECTION_METHOD_VALUES = [...exports.COLLECTION_METHODS];
exports.DISBURSEMENT_METHOD_VALUES = [...exports.DISBURSEMENT_METHODS];
