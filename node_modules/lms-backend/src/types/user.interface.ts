import { StoredDocument } from './document';

export type UserRole =
  | 'Admin'
  | 'Pathologist'
  | 'Lab Technician'
  | 'Receptionist'
  | 'Accountant'
  | 'Phlebotomist';

export interface IUserDocument extends StoredDocument {
  name: string;
  email: string;
  password: string;
  role: UserRole | string;
  mobile?: string;
  refreshToken?: string;
  status: string;
  /**
   * What this person may do, ticked by the Admin on the staff form. Absent on
   * accounts made before per-user permissions, which follow their role.
   */
  permissions?: string[];
  /**
   * Tokens issued before this moment are refused. Bumped whenever the Admin
   * resets a password, changes a role or deactivates an account, so those
   * actions take effect at once instead of at the end of an 8 hour token.
   */
  sessionsValidFrom?: Date;
}

