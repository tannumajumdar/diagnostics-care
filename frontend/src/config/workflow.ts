import {
  ClipboardList,
  Syringe,
  PackageCheck,
  Microscope,
  FileCheck2,
  type LucideIcon,
} from 'lucide-react';

/** Mirrors backend/src/constants/workflow.ts - keep the two in step. */
export const SAMPLE_PIPELINE = [
  'Pending Collection',
  'Collected',
  'Received',
  'Processing',
  'Completed',
] as const;

export type SampleStage = (typeof SAMPLE_PIPELINE)[number];

export interface StageMeta {
  stage: SampleStage;
  short: string;
  /** What physically happens at this bench step. */
  detail: string;
  /** Label on the button that advances a sample out of this stage. */
  action: string;
  next?: SampleStage;
  /** Stage advances via the result-entry screen rather than a status change. */
  entryRoute?: boolean;
  icon: LucideIcon;
  accent: string;
  dot: string;
  owner: string;
}

export const STAGES: StageMeta[] = [
  {
    stage: 'Pending Collection',
    short: 'To Collect',
    detail: 'Ordered and billed. Awaiting the draw.',
    action: 'Mark collected',
    next: 'Collected',
    icon: ClipboardList,
    accent: 'border-amber-200 bg-amber-50',
    dot: 'bg-amber-500',
    owner: 'Phlebotomist',
  },
  {
    stage: 'Collected',
    short: 'Collected',
    detail: 'Drawn and labelled. In transit to the lab.',
    action: 'Receive in lab',
    next: 'Received',
    icon: Syringe,
    accent: 'border-sky-200 bg-sky-50',
    dot: 'bg-sky-500',
    owner: 'Phlebotomist',
  },
  {
    stage: 'Received',
    short: 'Accessioned',
    detail: 'Checked in by the lab. Container and volume verified.',
    action: 'Start processing',
    next: 'Processing',
    icon: PackageCheck,
    accent: 'border-violet-200 bg-violet-50',
    dot: 'bg-violet-500',
    owner: 'Lab Technician',
  },
  {
    stage: 'Processing',
    short: 'On Bench',
    detail: 'Running on the analyser. Enter results, then a pathologist signs off.',
    action: 'Enter results',
    // Completion is owned by result verification, not by a status button.
    entryRoute: true,
    icon: Microscope,
    accent: 'border-blue-200 bg-blue-50',
    dot: 'bg-blue-500',
    owner: 'Lab Technician',
  },
  {
    stage: 'Completed',
    short: 'Reported',
    detail: 'Analysis finished. Ready for verification and release.',
    action: '',
    icon: FileCheck2,
    accent: 'border-emerald-200 bg-emerald-50',
    dot: 'bg-emerald-500',
    owner: 'Pathologist',
  },
];

/** Standard pre-analytical rejection reasons, matching the backend list. */
export const REJECTION_REASONS = [
  'Haemolysed sample',
  'Insufficient quantity (QNS)',
  'Clotted sample',
  'Wrong container / anticoagulant',
  'Unlabelled or mislabelled',
  'Leaked or damaged in transit',
  'Sample too old / delayed transport',
  'Contaminated sample',
];

/** Roles permitted to advance a sample out of a given stage. */
const STAGE_ACTORS: Record<string, string[]> = {
  'Pending Collection': ['Phlebotomist', 'Receptionist', 'Lab Technician', 'Pathologist'],
  Collected: ['Lab Technician', 'Pathologist'],
  Received: ['Lab Technician', 'Pathologist'],
  Processing: ['Lab Technician', 'Pathologist'],
};

export const canAdvance = (stage: string, role?: string): boolean => {
  if (!role) return false;
  if (role === 'Admin') return true;
  return (STAGE_ACTORS[stage] ?? []).includes(role);
};
