"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestService = void 0;
const test_model_1 = require("../models/test.model");
const search_util_1 = require("../utils/search.util");
class TestService {
    static getAll = async (params) => {
        const page = params.page || 1;
        const limit = params.limit || 10;
        const skip = (page - 1) * limit;
        const query = {};
        // Name, code, the parameters inside the test, and the initials of the
        // words - the desk types APTT and Hb, not the full name off the menu.
        if (params.search) {
            const clauses = (0, search_util_1.testSearchClauses)(params.search);
            if (clauses.length)
                query.$or = clauses;
        }
        if (params.department)
            query.department = params.department;
        if (params.status)
            query.status = params.status;
        const [tests, total] = await Promise.all([
            test_model_1.LabTest.find(query).populate('department').sort({ testName: 1 }).skip(skip).limit(limit),
            test_model_1.LabTest.countDocuments(query),
        ]);
        return {
            tests: tests.map((t) => ({
                id: t._id.toString(),
                testName: t.testName,
                testCode: t.testCode,
                department: t.department ? { id: t.department._id.toString(), departmentName: t.department.departmentName } : null,
                sampleType: t.sampleType,
                sampleContainer: t.sampleContainer,
                rate: t.rate,
                patientRate: t.patientRate,
                corporateRate: t.corporateRate,
                doctorRate: t.doctorRate,
                emergencyRate: t.emergencyRate,
                referralRate: t.referralRate,
                processingMode: t.processingMode,
                outsourceLab: t.outsourceLab,
                outsourceCost: t.outsourceCost,
                discountAllowed: t.discountAllowed,
                fastingRequired: t.fastingRequired,
                turnaroundTime: t.turnaroundTime,
                status: t.status,
                parameters: t.parameters,
            })),
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        };
    };
    static create = async (data) => {
        const test = await test_model_1.LabTest.create(data);
        return {
            id: test._id.toString(),
            testName: test.testName,
            testCode: test.testCode,
            rate: test.rate,
            sampleContainer: test.sampleContainer,
            status: test.status,
        };
    };
}
exports.TestService = TestService;
