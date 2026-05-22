"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDepartmentSchema = exports.createDepartmentSchema = void 0;
const zod_1 = require("zod");
exports.createDepartmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2, 'Department name must be at least 2 characters'),
        code: zod_1.z.string().min(2, 'Department code must be at least 2 characters'),
        headOfDepartment: zod_1.z.string().optional(),
    }),
});
exports.updateDepartmentSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(2).optional(),
        code: zod_1.z.string().min(2).optional(),
        headOfDepartment: zod_1.z.string().optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
