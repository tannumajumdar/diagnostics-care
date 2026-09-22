import { Document, Schema } from 'mongoose';

export interface IRateHistoryDocument extends Document {
  test: Schema.Types.ObjectId;
  testCode?: string;
  testName?: string;
  previousRates: Record<string, number>;
  newRates: Record<string, number>;
  reason?: string;
  changedBy: {
    userId: Schema.Types.ObjectId;
    name: string;
  };
}

