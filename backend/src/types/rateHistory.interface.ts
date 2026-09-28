import { StoredDocument, Ref } from './document';

export interface IRateHistoryDocument extends StoredDocument {
  test: Ref;
  testCode?: string;
  testName?: string;
  previousRates: Record<string, number>;
  newRates: Record<string, number>;
  reason?: string;
  changedBy: {
    userId: Ref;
    name: string;
  };
}

