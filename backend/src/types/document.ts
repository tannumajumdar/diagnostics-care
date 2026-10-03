/**
 * A stored record as the API sends it: the document shape the app was built
 * on, which db/mappers.ts rebuilds from the Postgres rows - `_id` and the two
 * timestamps. The interfaces in this folder describe those shapes.
 */
export interface StoredDocument {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Another record, by its 24-hex id - or the record itself once it is loaded. */
export type Ref = string;
