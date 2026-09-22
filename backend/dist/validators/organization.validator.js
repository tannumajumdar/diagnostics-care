"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrganizationSchema = exports.createOrganizationSchema = void 0;
const zod_1 = require("zod");
exports.createOrganizationSchema = zod_1.z.object({
    organizationName: zod_1.z.string().min(2, 'Organization name is required'),
    contactPerson: zod_1.z.string().min(2, 'Contact person is required'),
    mobile: zod_1.z.string().min(10, 'Mobile is required'),
});
exports.updateOrganizationSchema = exports.createOrganizationSchema.partial();
