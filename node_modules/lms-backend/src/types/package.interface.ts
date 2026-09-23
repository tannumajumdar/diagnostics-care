import { Document, Schema } from 'mongoose';

export interface ITestPackageDocument extends Document {
  packageName: string;
  packageCode: string;
  description: string;
  /**
   * The department the panel is filed under - Biochemistry, Radiology, a
   * "Health Checkup" desk of its own. A panel may draw tests from several
   * departments, so this is what the centre sells it as rather than what runs
   * it, and it is left unset for a panel that genuinely spans the lab.
   */
  department?: Schema.Types.ObjectId;
  tests: Schema.Types.ObjectId[];
  /** What the patient is charged for the whole panel. */
  rate: number;
  /** What a referring doctor's own copy prints the panel at. */
  referralRate: number;
  discountAllowed: boolean;
  status: string;
}
