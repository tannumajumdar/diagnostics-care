"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELIVERY_CHANNELS = exports.RESULT_TRANSITIONS = exports.RESULT_STATUS = exports.nextStatuses = exports.canTransition = exports.SAMPLE_STAGE_OWNER = exports.REJECTION_REASONS = exports.SAMPLE_STAGE_TIMESTAMP = exports.SAMPLE_TRANSITIONS = exports.SAMPLE_PIPELINE = exports.SAMPLE_STATUS = void 0;
/**
 * The real bench lifecycle of a specimen. Every stage below is a physical
 * event in the lab, and a sample may only move along an edge declared here -
 * previously any status could be written over any other, so a specimen could
 * be marked Completed without ever having been drawn.
 */
exports.SAMPLE_STATUS = {
    REGISTERED: 'Registered',
    PENDING_COLLECTION: 'Pending Collection',
    COLLECTED: 'Collected',
    RECEIVED: 'Received',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    REJECTED: 'Rejected',
    RECOLLECTED: 'Recollected',
    /** The patient called the test off. Terminal, and not the lab's doing. */
    CANCELLED: 'Cancelled',
};
/** Ordered happy path, used for progress rendering and stage indexing. */
exports.SAMPLE_PIPELINE = [
    exports.SAMPLE_STATUS.REGISTERED,
    exports.SAMPLE_STATUS.PENDING_COLLECTION,
    exports.SAMPLE_STATUS.COLLECTED,
    exports.SAMPLE_STATUS.RECEIVED,
    exports.SAMPLE_STATUS.PROCESSING,
    exports.SAMPLE_STATUS.COMPLETED,
];
exports.SAMPLE_TRANSITIONS = {
    // Cancelled is reachable from every stage short of a released result: the
    // patient may call the test off at the counter, in the draw room or while it
    // is on the bench, and the refund policy decides what that costs them.
    [exports.SAMPLE_STATUS.REGISTERED]: [
        exports.SAMPLE_STATUS.PENDING_COLLECTION,
        exports.SAMPLE_STATUS.REJECTED,
        exports.SAMPLE_STATUS.CANCELLED,
    ],
    [exports.SAMPLE_STATUS.PENDING_COLLECTION]: [
        exports.SAMPLE_STATUS.COLLECTED,
        exports.SAMPLE_STATUS.REJECTED,
        exports.SAMPLE_STATUS.CANCELLED,
    ],
    // A drawn specimen must be accessioned by the lab before it can go on the bench.
    [exports.SAMPLE_STATUS.COLLECTED]: [exports.SAMPLE_STATUS.RECEIVED, exports.SAMPLE_STATUS.REJECTED, exports.SAMPLE_STATUS.CANCELLED],
    [exports.SAMPLE_STATUS.RECEIVED]: [exports.SAMPLE_STATUS.PROCESSING, exports.SAMPLE_STATUS.REJECTED, exports.SAMPLE_STATUS.CANCELLED],
    [exports.SAMPLE_STATUS.PROCESSING]: [exports.SAMPLE_STATUS.COMPLETED, exports.SAMPLE_STATUS.REJECTED, exports.SAMPLE_STATUS.CANCELLED],
    [exports.SAMPLE_STATUS.COMPLETED]: [],
    // A rejected specimen is closed out by ordering a fresh draw - or by the
    // patient declining one, which is a cancellation like any other.
    [exports.SAMPLE_STATUS.REJECTED]: [exports.SAMPLE_STATUS.RECOLLECTED, exports.SAMPLE_STATUS.CANCELLED],
    [exports.SAMPLE_STATUS.RECOLLECTED]: [exports.SAMPLE_STATUS.PENDING_COLLECTION, exports.SAMPLE_STATUS.CANCELLED],
    [exports.SAMPLE_STATUS.CANCELLED]: [],
};
/** Timestamp stamped when a sample enters the stage. */
exports.SAMPLE_STAGE_TIMESTAMP = {
    [exports.SAMPLE_STATUS.COLLECTED]: 'collectionDate',
    [exports.SAMPLE_STATUS.RECEIVED]: 'receivedAt',
    [exports.SAMPLE_STATUS.PROCESSING]: 'processingAt',
    [exports.SAMPLE_STATUS.COMPLETED]: 'completedAt',
    [exports.SAMPLE_STATUS.REJECTED]: 'rejectedAt',
    [exports.SAMPLE_STATUS.CANCELLED]: 'cancelledAt',
};
/** Standard pre-analytical rejection reasons. */
exports.REJECTION_REASONS = [
    'Haemolysed sample',
    'Insufficient quantity (QNS)',
    'Clotted sample',
    'Wrong container / anticoagulant',
    'Unlabelled or mislabelled',
    'Leaked or damaged in transit',
    'Sample too old / delayed transport',
    'Contaminated sample',
];
/** Which role is expected to move a sample into each stage. */
exports.SAMPLE_STAGE_OWNER = {
    [exports.SAMPLE_STATUS.COLLECTED]: ['Phlebotomist', 'Lab Technician', 'Receptionist'],
    [exports.SAMPLE_STATUS.RECEIVED]: ['Lab Technician', 'Pathologist'],
    [exports.SAMPLE_STATUS.PROCESSING]: ['Lab Technician', 'Pathologist'],
    [exports.SAMPLE_STATUS.COMPLETED]: ['Lab Technician', 'Pathologist'],
    [exports.SAMPLE_STATUS.REJECTED]: ['Lab Technician', 'Pathologist', 'Phlebotomist'],
};
const canTransition = (from, to) => (exports.SAMPLE_TRANSITIONS[from] ?? []).includes(to);
exports.canTransition = canTransition;
const nextStatuses = (from) => exports.SAMPLE_TRANSITIONS[from] ?? [];
exports.nextStatuses = nextStatuses;
/**
 * Report lifecycle. A report is only handed over after a pathologist has
 * authorised it, so Dispatched is reachable only from Approved.
 */
exports.RESULT_STATUS = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    FINAL: 'Final',
};
exports.RESULT_TRANSITIONS = {
    [exports.RESULT_STATUS.DRAFT]: [exports.RESULT_STATUS.SUBMITTED],
    [exports.RESULT_STATUS.SUBMITTED]: [exports.RESULT_STATUS.UNDER_REVIEW, exports.RESULT_STATUS.APPROVED, exports.RESULT_STATUS.REJECTED],
    [exports.RESULT_STATUS.UNDER_REVIEW]: [exports.RESULT_STATUS.APPROVED, exports.RESULT_STATUS.REJECTED],
    // Rejected sends the run back to the bench for a repeat.
    [exports.RESULT_STATUS.REJECTED]: [exports.RESULT_STATUS.DRAFT],
    [exports.RESULT_STATUS.APPROVED]: [exports.RESULT_STATUS.FINAL],
    [exports.RESULT_STATUS.FINAL]: [],
};
exports.DELIVERY_CHANNELS = ['Hand Delivery', 'Email', 'WhatsApp', 'SMS Link', 'Courier'];
