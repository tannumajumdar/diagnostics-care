import { Schema, model, Types } from 'mongoose';

/**
 * A reference file kept with a test in the catalogue. Stored in its own
 * collection rather than on the test, so listing the catalogue never drags
 * the file bytes along with it.
 */
export interface ITestAttachment {
  test: Types.ObjectId;
  fileName: string;
  mimeType: string;
  size: number;
  data: Buffer;
  uploadedBy?: { userId?: Types.ObjectId; name?: string };
  createdAt?: Date;
}

const testAttachmentSchema = new Schema<ITestAttachment>(
  {
    test: { type: Schema.Types.ObjectId, ref: 'LabTest', required: true, index: true },
    fileName: { type: String, required: true, trim: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    data: { type: Buffer, required: true, select: false },
    uploadedBy: {
      userId: { type: Schema.Types.ObjectId, ref: 'User' },
      name: { type: String },
    },
  },
  { timestamps: true }
);

export const TestAttachment = model<ITestAttachment>('TestAttachment', testAttachmentSchema);
