import { UserRole } from './user.interface';

export interface JwtPayload {
  userId: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}
