/**
 * The real bench lifecycle of a specimen. Every stage below is a physical
 * event in the lab, and a sample may only move along an edge declared here -
 * previously any status could be written over any other, so a specimen could
 * be marked Completed without ever having been drawn.
 */
export const SAMPLE_STATUS = {
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
} as const;

export type SampleStatus = (typeof SAMPLE_STATUS)[keyof typeof SAMPLE_STATUS];

/** Ordered happy path, used for progress rendering and stage indexing. */
export const SAMPLE_PIPELINE: SampleStatus[] = [
  SAMPLE_STATUS.REGISTERED,
  SAMPLE_STATUS.PENDING_COLLECTION,
  SAMPLE_STATUS.COLLECTED,
  SAMPLE_STATUS.RECEIVED,
  SAMPLE_STATUS.PROCESSING,
  SAMPLE_STATUS.COMPLETED,
];

export const SAMPLE_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  // Cancelled is reachable from every stage short of a released result: the
  // patient may call the test off at the counter, in the draw room or while it
  // is on the bench, and the refund policy decides what that costs them.
  [SAMPLE_STATUS.REGISTERED]: [
    SAMPLE_STATUS.PENDING_COLLECTION,
    SAMPLE_STATUS.REJECTED,
    SAMPLE_STATUS.CANCELLED,
  ],
  [SAMPLE_STATUS.PENDING_COLLECTION]: [
    SAMPLE_STATUS.COLLECTED,
    SAMPLE_STATUS.REJECTED,
    SAMPLE_STATUS.CANCELLED,
  ],
  // A drawn specimen must be accessioned by the lab before it can go on the bench.
  [SAMPLE_STATUS.COLLECTED]: [SAMPLE_STATUS.RECEIVED, SAMPLE_STATUS.REJECTED, SAMPLE_STATUS.CANCELLED],
  [SAMPLE_STATUS.RECEIVED]: [SAMPLE_STATUS.PROCESSING, SAMPLE_STATUS.REJECTED, SAMPLE_STATUS.CANCELLED],
  [SAMPLE_STATUS.PROCESSING]: [SAMPLE_STATUS.COMPLETED, SAMPLE_STATUS.REJECTED, SAMPLE_STATUS.CANCELLED],
  [SAMPLE_STATUS.COMPLETED]: [],
  // A rejected specimen is closed out by ordering a fresh draw - or by the
  // patient declining one, which is a cancellation like any other.
  [SAMPLE_STATUS.REJECTED]: [SAMPLE_STATUS.RECOLLECTED, SAMPLE_STATUS.CANCELLED],
  [SAMPLE_STATUS.RECOLLECTED]: [SAMPLE_STATUS.PENDING_COLLECTION, SAMPLE_STATUS.CANCELLED],
  [SAMPLE_STATUS.CANCELLED]: [],
};

/** Timestamp stamped when a sample enters the stage. */
export const SAMPLE_STAGE_TIMESTAMP: Partial<Record<SampleStatus, string>> = {
  [SAMPLE_STATUS.COLLECTED]: 'collectionDate',
  [SAMPLE_STATUS.RECEIVED]: 'receivedAt',
  [SAMPLE_STATUS.PROCESSING]: 'processingAt',
  [SAMPLE_STATUS.COMPLETED]: 'completedAt',
  [SAMPLE_STATUS.REJECTED]: 'rejectedAt',
  [SAMPLE_STATUS.CANCELLED]: 'cancelledAt',
};

/** Standard pre-analytical rejection reasons. */
export const REJECTION_REASONS = [
  'Haemolysed sample',
  'Insufficient quantity (QNS)',
  'Clotted sample',
  'Wrong container / anticoagulant',
  'Unlabelled or mislabelled',
  'Leaked or damaged in transit',
  'Sample too old / delayed transport',
  'Contaminated sample',
] as const;

/** Which role is expected to move a sample into each stage. */
export const SAMPLE_STAGE_OWNER: Partial<Record<SampleStatus, string[]>> = {
  [SAMPLE_STATUS.COLLECTED]: ['Phlebotomist', 'Lab Technician', 'Receptionist', 'Pathologist'],
  [SAMPLE_STATUS.RECEIVED]: ['Lab Technician', 'Pathologist'],
  [SAMPLE_STATUS.PROCESSING]: ['Lab Technician', 'Pathologist'],
  [SAMPLE_STATUS.COMPLETED]: ['Lab Technician', 'Pathologist'],
  [SAMPLE_STATUS.REJECTED]: ['Lab Technician', 'Pathologist', 'Phlebotomist'],
};

export const canTransition = (from: string, to: string): boolean =>
  (SAMPLE_TRANSITIONS[from as SampleStatus] ?? []).includes(to as SampleStatus);

export const nextStatuses = (from: string): SampleStatus[] =>
  SAMPLE_TRANSITIONS[from as SampleStatus] ?? [];

/**
 * Report lifecycle. A report is only handed over after a pathologist has
 * authorised it, so Dispatched is reachable only from Approved.
 */
export const RESULT_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  FINAL: 'Final',
} as const;

export type ResultStatus = (typeof RESULT_STATUS)[keyof typeof RESULT_STATUS];

export const RESULT_TRANSITIONS: Record<ResultStatus, ResultStatus[]> = {
  [RESULT_STATUS.DRAFT]: [RESULT_STATUS.SUBMITTED],
  [RESULT_STATUS.SUBMITTED]: [RESULT_STATUS.UNDER_REVIEW, RESULT_STATUS.APPROVED, RESULT_STATUS.REJECTED],
  [RESULT_STATUS.UNDER_REVIEW]: [RESULT_STATUS.APPROVED, RESULT_STATUS.REJECTED],
  // Rejected sends the run back to the bench for a repeat.
  [RESULT_STATUS.REJECTED]: [RESULT_STATUS.DRAFT],
  [RESULT_STATUS.APPROVED]: [RESULT_STATUS.FINAL],
  [RESULT_STATUS.FINAL]: [],
};

export const DELIVERY_CHANNELS = ['Hand Delivery', 'Email', 'WhatsApp', 'SMS Link', 'Courier'] as const;
