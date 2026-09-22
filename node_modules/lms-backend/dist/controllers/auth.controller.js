"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const auth_service_1 = require("../services/auth.service");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
const auditLogger_1 = require("../utils/auditLogger");
class AuthController {
    static login = async (req, res, next) => {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.AuthService.login({ email, password });
            (0, auditLogger_1.logAuditAction)({
                action: 'LOGIN',
                module: 'AUTH',
                user: { id: (result.user._id || result.user.id).toString(), name: result.user.name, role: result.user.role },
                ipAddress: req.ip,
                details: { email },
            });
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: messages_1.MESSAGES.AUTH.LOGIN_SUCCESS,
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static refreshToken = async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            const result = await auth_service_1.AuthService.refreshToken(refreshToken);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Token refreshed successfully',
                data: result,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getCurrentUser = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const user = await auth_service_1.AuthService.getCurrentUser(currentUser.userId);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Current user profile retrieved',
                data: user,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static changePassword = async (req, res, next) => {
        try {
            const currentUser = req.user;
            const { oldPassword, newPassword } = req.body;
            await auth_service_1.AuthService.changePassword(currentUser.userId, oldPassword, newPassword);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Password changed successfully',
            });
        }
        catch (error) {
            next(error);
        }
    };
    static logout = async (req, res, next) => {
        try {
            const currentUser = req.user;
            if (currentUser?.userId) {
                await auth_service_1.AuthService.logout(currentUser.userId);
            }
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: messages_1.MESSAGES.AUTH.LOGOUT_SUCCESS,
            });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.AuthController = AuthController;
