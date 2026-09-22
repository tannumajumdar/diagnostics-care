"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const user_model_1 = require("../models/user.model");
const api_response_util_1 = require("../utils/api-response.util");
const messages_1 = require("../constants/messages");
const api_error_util_1 = require("../utils/api-error.util");
const permissions_1 = require("../constants/permissions");
const roles_1 = require("../constants/roles");
const auditLogger_1 = require("../utils/auditLogger");
/** The Admin performing the action, for the audit trail. */
const actorOf = (req) => ({
    id: req.user?.userId,
    name: req.user?.name,
    role: req.user?.role,
});
/**
 * An Admin may change anyone's account, including another Admin's - but not
 * the last one standing. Locking out or demoting the final active Admin would
 * leave the centre with nobody able to add staff, reset a password or approve
 * a payout, and there is no tier above Admin to recover from it.
 */
const assertNotLastActiveAdmin = async (target, next) => {
    const wasActiveAdmin = target.role === roles_1.ROLES.ADMIN && target.status === 'Active';
    if (!wasActiveAdmin)
        return;
    const staysActiveAdmin = (next.role ?? target.role) === roles_1.ROLES.ADMIN && (next.status ?? target.status) === 'Active';
    if (staysActiveAdmin)
        return;
    const activeAdmins = await user_model_1.User.countDocuments({ role: roles_1.ROLES.ADMIN, status: 'Active' });
    if (activeAdmins <= 1) {
        throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'This is the last active Admin account. Promote another member to Admin first.');
    }
};
/**
 * Everything already issued to this account stops working. Used when the
 * Admin resets a password, changes a role or deactivates someone - without
 * it the old session simply carried on for the rest of its eight hours.
 */
const revokeSessions = (user) => {
    user.sessionsValidFrom = new Date();
    user.refreshToken = undefined;
};
class UserController {
    static getAll = async (req, res, next) => {
        try {
            const { search, role, status, page = 1, limit = 10 } = req.query;
            const filter = {};
            if (search) {
                filter.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } },
                ];
            }
            if (role)
                filter.role = role;
            if (status)
                filter.status = status;
            const skip = (Number(page) - 1) * Number(limit);
            const [users, total] = await Promise.all([
                user_model_1.User.find(filter).select('-password').sort({ name: 1 }).skip(skip).limit(Number(limit)),
                user_model_1.User.countDocuments(filter),
            ]);
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: 'Users retrieved',
                // The staff screen shows what each role may do, read off the same
                // matrix the API enforces rather than a caption maintained by hand.
                data: users.map((user) => ({
                    ...user.toObject(),
                    permissions: (0, permissions_1.permissionsForRole)(user.role),
                })),
                meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
            });
        }
        catch (error) {
            next(error);
        }
    };
    static getAllUsers = async (req, res, next) => {
        return UserController.getAll(req, res, next);
    };
    /**
     * The people who can be sent out on a draw. The front desk assigns home
     * collections but has no business reading the full staff register, so this
     * returns names and roles only.
     */
    static getCollectors = async (_req, res, next) => {
        try {
            const collectors = await user_model_1.User.find({
                role: { $in: ['Phlebotomist', 'Lab Technician'] },
                status: 'Active',
            })
                .select('name role mobile')
                .sort({ name: 1 });
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Collection staff retrieved', data: collectors });
        }
        catch (error) {
            next(error);
        }
    };
    static getUserById = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const user = await user_model_1.User.findById(id).select('-password');
            if (!user)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'User not found');
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'User retrieved', data: user });
        }
        catch (error) {
            next(error);
        }
    };
    static create = async (req, res, next) => {
        try {
            const { name, email, password, role, mobile, status } = req.body;
            const existing = await user_model_1.User.findOne({ email: String(email).toLowerCase() });
            if (existing) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, `A staff account already exists for ${email}`);
            }
            const user = await user_model_1.User.create({ name, email, password, role, mobile, status });
            (0, auditLogger_1.logAuditAction)({
                action: 'STAFF_CREATE',
                module: 'STAFF',
                user: actorOf(req),
                ipAddress: req.ip,
                targetId: user._id.toString(),
                details: { name: user.name, email: user.email, role: user.role },
            });
            const obj = user.toObject();
            delete obj.password;
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.CREATED,
                message: `${user.name} added as ${user.role}`,
                data: obj,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static createUser = async (req, res, next) => {
        return UserController.create(req, res, next);
    };
    static updateUser = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const user = await user_model_1.User.findById(id).select('+password');
            if (!user)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'User not found');
            const { name, email, role, mobile, status, password } = req.body;
            const isSelf = req.user?.userId === user._id.toString();
            // An Admin editing their own row cannot hand away the role or switch
            // themselves off - both are one click from being locked out of the
            // screen that would undo it.
            if (isSelf && role !== undefined && role !== user.role) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'You cannot change your own role');
            }
            if (isSelf && status !== undefined && status !== user.status) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'You cannot change your own account status');
            }
            await assertNotLastActiveAdmin(user, { role, status });
            // Caught here so a clashing address comes back as a sentence rather
            // than a raw duplicate-key error from the driver.
            if (email !== undefined && String(email).toLowerCase() !== user.email) {
                const clash = await user_model_1.User.findOne({ email: String(email).toLowerCase(), _id: { $ne: user._id } });
                if (clash) {
                    throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, `A staff account already exists for ${email}`);
                }
            }
            const changed = [];
            const roleChanged = role !== undefined && role !== user.role;
            const deactivated = status !== undefined && status !== user.status && status !== 'Active';
            if (name !== undefined && name !== user.name)
                changed.push('name');
            if (email !== undefined && String(email).toLowerCase() !== user.email)
                changed.push('email');
            if (mobile !== undefined && mobile !== user.mobile)
                changed.push('mobile');
            if (roleChanged)
                changed.push(`role (${user.role} -> ${role})`);
            if (status !== undefined && status !== user.status)
                changed.push(`status (${status})`);
            if (password)
                changed.push('password');
            if (name !== undefined)
                user.name = name;
            if (email !== undefined)
                user.email = email;
            if (role !== undefined)
                user.role = role;
            if (mobile !== undefined)
                user.mobile = mobile;
            if (status !== undefined)
                user.status = status;
            // Assigned through save() so the hashing hook runs - findByIdAndUpdate
            // bypasses it and would have written the new password in clear text.
            if (password)
                user.password = password;
            // A new password, a new role or a switched-off account has to reach the
            // person now. Never for the Admin doing the editing, who would otherwise
            // sign themselves out by correcting their own phone number.
            if (!isSelf && (password || roleChanged || deactivated)) {
                revokeSessions(user);
            }
            await user.save();
            if (changed.length) {
                (0, auditLogger_1.logAuditAction)({
                    action: password ? 'STAFF_PASSWORD_RESET' : 'STAFF_UPDATE',
                    module: 'STAFF',
                    user: actorOf(req),
                    ipAddress: req.ip,
                    targetId: user._id.toString(),
                    // The new password itself is never recorded - only that it was reset.
                    details: { target: user.name, targetRole: user.role, changed },
                });
            }
            const obj = user.toObject();
            delete obj.password;
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: 'Staff account updated', data: obj });
        }
        catch (error) {
            next(error);
        }
    };
    /**
     * Set someone else's password without knowing the old one. This is the
     * Admin's recovery path - a receptionist who is locked out has no other way
     * back in, since the self-service change requires the password they lost.
     */
    static resetPassword = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const user = await user_model_1.User.findById(id).select('+password');
            if (!user)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'User not found');
            const { password } = req.body;
            user.password = password;
            const isSelf = req.user?.userId === user._id.toString();
            if (!isSelf)
                revokeSessions(user);
            await user.save();
            (0, auditLogger_1.logAuditAction)({
                action: 'STAFF_PASSWORD_RESET',
                module: 'STAFF',
                user: actorOf(req),
                ipAddress: req.ip,
                targetId: user._id.toString(),
                details: { target: user.name, targetRole: user.role },
            });
            (0, api_response_util_1.sendResponse)({
                res,
                statusCode: messages_1.HTTP_STATUS.OK,
                message: `Password reset for ${user.name}. They will need to sign in again.`,
            });
        }
        catch (error) {
            next(error);
        }
    };
    static toggleStatus = async (req, res, next) => {
        try {
            const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
            const user = await user_model_1.User.findById(id);
            if (!user)
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.NOT_FOUND, 'User not found');
            if (req.user?.userId === user._id.toString()) {
                throw new api_error_util_1.ApiError(messages_1.HTTP_STATUS.BAD_REQUEST, 'You cannot change your own account status');
            }
            const next_ = user.status === 'Active' ? 'Inactive' : 'Active';
            await assertNotLastActiveAdmin(user, { status: next_ });
            user.status = next_;
            // Switching someone off has to take hold immediately, not whenever
            // their current token happens to run out.
            if (next_ !== 'Active')
                revokeSessions(user);
            await user.save();
            (0, auditLogger_1.logAuditAction)({
                action: next_ === 'Active' ? 'STAFF_ACTIVATE' : 'STAFF_DEACTIVATE',
                module: 'STAFF',
                user: actorOf(req),
                ipAddress: req.ip,
                targetId: user._id.toString(),
                details: { target: user.name, targetRole: user.role },
            });
            (0, api_response_util_1.sendResponse)({ res, statusCode: messages_1.HTTP_STATUS.OK, message: `${user.name} is now ${next_}`, data: user });
        }
        catch (error) {
            next(error);
        }
    };
}
exports.UserController = UserController;
