import { User } from '../models/user.model';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util';
import { ApiError } from '../utils/api-error.util';
import { HTTP_STATUS, MESSAGES } from '../constants/messages';
import { LoginCredentials } from '../types/auth.interface';
import { permissionsForRole } from '../constants/permissions';

export class AuthService {
  static async login(credentials: LoginCredentials) {
    const { email, password } = credentials;
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password || ''))) {
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
    await user.save();

    const userObject = user.toObject();
    delete userObject.password;
    delete userObject.refreshToken;

    return {
      // The client renders its menu and buttons off this list, so the UI can
      // never offer an action the API would refuse.
      user: { ...userObject, permissions: permissionsForRole(user.role) },
      accessToken,
      refreshToken,
    };
  }

  static async refreshToken(token: string) {
    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.userId).select('+refreshToken');

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
    await user.save();

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(userId: string) {
    await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
  }

  static async getCurrentUser(userId: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    }
    return { ...user.toObject(), permissions: permissionsForRole(user.role) };
  }

  static async changePassword(userId: string, oldPass: string, newPass: string) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'User not found');
    if (!(await user.comparePassword(oldPass))) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Current password is incorrect');
    }
    user.password = newPass;
    await user.save();
  }
}

