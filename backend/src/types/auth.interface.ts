import { UserRole } from './user.interface';

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  /** This account's own granted list, resolved on every request. */
  permissions?: string[];
}

export interface LoginCredentials {
  email: string;
  password?: string;
}
