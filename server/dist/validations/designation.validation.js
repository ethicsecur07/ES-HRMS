"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDesignationSchema = exports.createDesignationSchema = void 0;
const zod_1 = require("zod");
exports.createDesignationSchema = zod_1.z.object({
    body: zod_1.z.object({
        departmentId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID'),
        name: zod_1.z.string().min(2, 'Designation name must be at least 2 characters'),
        code: zod_1.z.string().min(2, 'Designation code must be at least 2 characters'),
    }),
});
exports.updateDesignationSchema = zod_1.z.object({
    body: zod_1.z.object({
        departmentId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID').optional(),
        name: zod_1.z.string().min(2).optional(),
        code: zod_1.z.string().min(2).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
