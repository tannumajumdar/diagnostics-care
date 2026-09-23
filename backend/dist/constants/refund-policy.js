"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REFUND_POLICY = exports.REFUND_STAGE_LABELS = exports.REFUND_STAGE_ORDER = exports.REFUND_STAGES = void 0;
/**
 * How much of a cancelled test's money goes back to the patient.
 *
 * A patient who changes their mind on the way to the draw room and a patient
 * who asks after the report has been signed are not owed the same thing - the
 * first cost the centre nothing, the second cost it a vial, a reagent and a
 * pathologist's time. So the policy is written per stage of the work actually
 * done, and the stage is read off the sample rather than typed in by whoever
 * is at the counter.
 */
exports.REFUND_STAGES = {
    BEFORE_COLLECTION: 'beforeCollection',
    AFTER_COLLECTION: 'afterCollection',
    AFTER_PROCESSING: 'afterProcessing',
    AFTER_REPORT: 'afterReport',
};
exports.REFUND_STAGE_ORDER = [
    exports.REFUND_STAGES.BEFORE_COLLECTION,
    exports.REFUND_STAGES.AFTER_COLLECTION,
    exports.REFUND_STAGES.AFTER_PROCESSING,
    exports.REFUND_STAGES.AFTER_REPORT,
];
/** What each stage means at the bench, in the words the counter would use. */
exports.REFUND_STAGE_LABELS = {
    [exports.REFUND_STAGES.BEFORE_COLLECTION]: {
        label: 'Before the sample is drawn',
        description: 'Billed, but nothing has been taken from the patient yet. The centre has spent nothing on this test.',
    },
    [exports.REFUND_STAGES.AFTER_COLLECTION]: {
        label: 'Sample drawn, not yet on the bench',
        description: 'The vial has been drawn and accessioned. Consumables are gone; the analyser has not been run.',
    },
    [exports.REFUND_STAGES.AFTER_PROCESSING]: {
        label: 'Already on the bench',
        description: 'The test is running. Reagent and machine time have been spent on this patient.',
    },
    [exports.REFUND_STAGES.AFTER_REPORT]: {
        label: 'Result out / report released',
        description: 'The work is finished and the result has been issued. The service was delivered in full.',
    },
};
/**
 * What a new centre starts with: a full refund before the draw, half back once
 * the vial is taken, a quarter once it is on the bench, and nothing once the
 * report is out. Every figure here is editable by the Admin from the Refund
 * Policy screen - these are only the defaults.
 */
exports.DEFAULT_REFUND_POLICY = {
    enabled: true,
    stages: {
        [exports.REFUND_STAGES.BEFORE_COLLECTION]: { allowed: true, refundPercent: 100 },
        [exports.REFUND_STAGES.AFTER_COLLECTION]: { allowed: true, refundPercent: 50 },
        [exports.REFUND_STAGES.AFTER_PROCESSING]: { allowed: true, refundPercent: 25 },
        [exports.REFUND_STAGES.AFTER_REPORT]: { allowed: false, refundPercent: 0 },
    },
    cancellationFee: 0,
    refundWindowDays: 30,
    /**
     * A specimen the lab itself rejected - haemolysed, clotted, spilt - is not
     * the patient's doing, so their money comes back in full when they decline
     * the re-draw. Kept as a switch because some centres re-collect free instead.
     */
    fullRefundOnLabRejection: true,
    /** Whether an Admin may hand back more than the stage allows, with a reason. */
    allowAdminOverride: true,
    policyNote: 'Tests cancelled before the sample is drawn are refunded in full. Once a sample has been ' +
        'collected or processed, the consumables and bench time already spent are retained as per the ' +
        'rates above. A test whose report has been released cannot be refunded.',
};
