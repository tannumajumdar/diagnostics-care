import * as bcrypt from 'bcryptjs';

/**
 * What the User model's `pre('save')` hook and `comparePassword` method did.
 * Hashing is now called where a password is set - after validation, as the
 * hook ran - rather than on every save.
 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

export function comparePassword(candidate: string, hash: string): Promise<boolean> {
  return bcrypt.compare(candidate, hash);
}

/** A `repo` write transform that hashes `password` when the write carries one. */
export const hashIfSet = (plain: string | undefined) => async (doc: any) => {
  if (plain !== undefined) doc.password = await hashPassword(doc.password);
};
