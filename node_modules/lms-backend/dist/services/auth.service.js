"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const user_model_1 = require("../models/user.model");
const jwt_util_1 = require("../utils/jwt.util");
const api_error_util_1 = require("../utils/api-error.util");
const messages_1 = require("../constants/messages");
const permissions_1 = require("../constants/permissions");
class AuthService {
    static async login(credentials) {
        const { email, password } = credentials;
        const user = await user_model_1.User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password || ''))) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.UNAUTHORIZED, messages_1.MESSAGES.AUTH.INVALID_CREDENTIALS);
        }
        if (user.status !== 'Active') {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.FORBIDDEN, 'Your account has been deactivated');
        }
        const payload = {
            userId: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
        };
        const accessToken = (0, jwt_util_1.generateAccessToken)(payload);
        const refreshToken = (0, jwt_util_1.generateRefreshToken)(payload);
        user.refreshToken = refreshToken;
        await user.save();
        const userObject = user.toObject();
        delete userObject.password;
        delete userObject.refreshToken;
        return {
            // The client renders its menu and buttons off this list, so the UI can
            // never offer an action the API would refuse.
            user: { ...userObject, permissions: (0, permissions_1.permissionsForRole)(user.role) },
            accessToken,
            refreshToken,
        };
    }
    static async refreshToken(token) {
        const payload = (0, jwt_util_1.verifyRefreshToken)(token);
        const user = await user_model_1.User.findById(payload.userId).select('+refreshToken');
        if (!user || user.refreshToken !== token) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.UNAUTHORIZED, messages_1.MESSAGES.AUTH.TOKEN_INVALID);
        }
        const newPayload = {
            userId: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role,
        };
        const accessToken = (0, jwt_util_1.generateAccessToken)(newPayload);
        const newRefreshToken = (0, jwt_util_1.generateRefreshToken)(newPayload);
        user.refreshToken = newRefreshToken;
        await user.save();
        return {
            accessToken,
            refreshToken: newRefreshToken,
        };
    }
    static async logout(userId) {
        await user_model_1.User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
    }
    static async getCurrentUser(userId) {
        const user = await user_model_1.User.findById(userId);
        if (!user) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'User not found');
        }
        return { ...user.toObject(), permissions: (0, permissions_1.permissionsForRole)(user.role) };
    }
    static async changePassword(userId, oldPass, newPass) {
        const user = await user_model_1.User.findById(userId).select('+password');
        if (!user)
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'User not found');
        if (!(await user.comparePassword(oldPass))) {
            throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'Current password is incorrect');
        }
        user.password = newPass;
        await user.save();
    }
}
exports.AuthService = AuthService;
