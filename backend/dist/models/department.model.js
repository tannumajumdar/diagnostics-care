"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Department = void 0;
const mongoose_1 = require("mongoose");
const roles_1 = require("../constants/roles");
const departmentSchema = new mongoose_1.Schema({
    departmentName: {
        type: String,
        required: [true, 'Department name is required'],
        trim: true,
        unique: true,
    },
    departmentCode: {
        type: String,
        required: [true, 'Department code is required'],
        trim: true,
        uppercase: true,
        unique: true,
    },
    description: {
        type: String,
        trim: true,
        default: '',
    },
    status: {
        type: String,
        enum: roles_1.ALL_STATUSES,
        required: [true, 'Status is required'],
        default: 'Active',
    },
}, {
    timestamps: true,
});
exports.Department = (0, mongoose_1.model)('Department', departmentSchema);
