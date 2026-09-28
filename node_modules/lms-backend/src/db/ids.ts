import { randomBytes } from 'crypto';

/**
 * Every id in the app is a 24-hex ObjectId string, in Postgres as it was in
 * Mongo (see gen_object_id() in the init migration).
 *
 * Mongoose refused a malformed id before it reached the database, with a
 * CastError the error handler turns into `400 "<value>" is not a valid _id`.
 * Postgres would simply find nothing and the route would answer 404, so the
 * services check ids up front with this to keep the old answer.
 */
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

export const isObjectId = (value: unknown): value is string =>
  typeof value === 'string' && OBJECT_ID.test(value);

/** The error Mongoose threw for an id it could not cast. */
export class CastError extends Error {
  name = 'CastError';
  constructor(public value: unknown, public path = '_id') {
    super(`Cast to ObjectId failed for value "${value}" at path "${path}"`);
  }
}

/**
 * The id as Mongo would have stored it: an ObjectId's hex is lower case, and
 * Mongoose cast an upper-case one to it, so both spellings found the document.
 */
export const assertObjectId = (value: unknown, path = '_id'): string => {
  if (!isObjectId(value)) throw new CastError(value, path);
  return value.toLowerCase();
};

/** Mongo read an ObjectId ref as a hex string or an object with `_id`; both land here. */
export const idOf = (value: any): string | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;
  // A bson ObjectId answers `._id` with itself, so check for one first.
  if (value._bsontype === 'ObjectId' || value._bsontype === 'ObjectID') return value.toHexString();
  if (value._id !== undefined && value._id !== value) return idOf(value._id);
  return String(value);
};

/**
 * A fresh ObjectId-shaped id, made the way gen_object_id() makes them in the
 * database: eight hex digits of Unix seconds, then sixteen random ones. For
 * the places the code minted `new mongoose.Types.ObjectId()` itself.
 */
export const newObjectId = (): string =>
  Math.floor(Date.now() / 1000).toString(16).padStart(8, '0') + randomBytes(8).toString('hex');

/** `mongoose.Types.ObjectId.isValid`: a 24-hex string (or an ObjectId itself). */
export const isValidObjectIdValue = (value: unknown): boolean =>
  isObjectId(value) || (!!value && typeof value === 'object' && (value as any)._bsontype === 'ObjectId');
