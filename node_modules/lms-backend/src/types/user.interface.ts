import { Document } from 'mongoose';

export type UserRole =
  | 'Admin'
  | 'Pathologist'
  | 'Lab Technician'
  | 'Receptionist'
  | 'Accountant'
  | 'Phlebotomist';

export interface IUserDocument extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole | string;
  mobile?: string;
  refreshToken?: string;
  status: string;
  /**
   * Tokens issued before this moment are refused. Bumped whenever the Admin
   * resets a password, changes a role or deactivates an account, so those
   * actions take effect at once instead of at the end of an 8 hour token.
   */
  sessionsValidFrom?: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

