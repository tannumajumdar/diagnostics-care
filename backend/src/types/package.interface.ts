import { Document, Schema } from 'mongoose';

export interface ITestPackageDocument extends Document {
  packageName: string;
  packageCode: string;
  description: string;
  tests: Schema.Types.ObjectId[];
  /** What the patient is charged for the whole panel. */
  rate: number;
  /** What a referring doctor's own copy prints the panel at. */
  referralRate: number;
  discountAllowed: boolean;
  status: string;
}
