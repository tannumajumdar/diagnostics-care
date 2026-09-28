import { repo } from '../db/repo';
import { comparePassword, hashIfSet } from '../db/passwords';
import { queryValue } from '../db/rules';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS, MESSAGES } from '../constants/messages';
import { LoginCredentials } from '../types/auth.interface';
import { effectivePermissions } from '../constants/permissions';

export class AuthService {
  static async login(credentials: LoginCredentials) {
    const { email, password } = credentials;
    // Mongoose ran the schema's lowercase + trim on the query value as well.
    const user =
      typeof email === 'string'
        ? await repo.findOne('user', { email: queryValue('user', 'email', email) }, { omit: { password: false } })
        : null;

    if (!user || !(await comparePassword(password || '', user.password))) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.INVALID_CREDENTIALS);
    }

    if (user.status !== 'Active') {
      throw new ApiError(HTTP_STATUS.FORBIDDEN, 'Your account has been deactivated');
    }

    const payload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    user.refreshToken = refreshToken;
    const userObject = await repo.save('user', user);
    delete userObject.password;
    delete userObject.refreshToken;

    return {
      // The client renders its menu and buttons off this list, so the UI can
      // never offer an action the API would refuse.
      user: { ...userObject, permissions: effectivePermissions(user) },
      accessToken,
      refreshToken,
    };
  }

  static async refreshToken(token: string) {
    const payload = verifyRefreshToken(token);
    const user = await repo.findById('user', payload.userId, { omit: { refreshToken: false } });

    if (!user || user.refreshToken !== token) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, MESSAGES.AUTH.TOKEN_INVALID);
    }

    const newPayload = {
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
    };

    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    user.refreshToken = newRefreshToken;
    await repo.save('user', user);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(userId: string) {
    await repo.updateById('user', userId, { refreshToken: undefined });
  }

  static async getCurrentUser(userId: string) {
    const user = await repo.findById('user', userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    return { ...user, permissions: effectivePermissions(user) };
  }

  static async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await repo.findById('user', userId, { omit: { password: false } });
    if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    if (!(await comparePassword(oldPass, user.password))) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Current password is incorrect');
    }
    user.password = newPass;
    await repo.save('user', user, { transform: hashIfSet(newPass) });
  }
}

