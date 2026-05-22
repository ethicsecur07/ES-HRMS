"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateEmployeeSchema = exports.createEmployeeSchema = void 0;
const zod_1 = require("zod");
exports.createEmployeeSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeCode: zod_1.z.string().min(2),
        fullName: zod_1.z.string().min(3),
        email: zod_1.z.string().email(),
        phone: zod_1.z.string().min(10),
        department: zod_1.z.string().min(2),
        designation: zod_1.z.string().min(2),
        joiningDate: zod_1.z.string(),
        salary: zod_1.z.number().min(1000),
        address: zod_1.z.string().min(5),
        password: zod_1.z.string().optional(),
        profileImage: zod_1.z.string().optional(),
        emergencyContact: zod_1.z.object({
            name: zod_1.z.string().min(2),
            relationship: zod_1.z.string().min(2),
            phone: zod_1.z.string().min(10),
        }),
        branchId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID').optional(),
        costCenterId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid cost center ID').optional(),
        primaryManagerId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager ID').optional(),
        designationId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid designation ID').optional(),
        departmentId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID').optional(),
        confirmationDate: zod_1.z.string().optional(),
        terminationDate: zod_1.z.string().optional(),
        bankDetails: zod_1.z.object({
            bankName: zod_1.z.string().optional(),
            accountName: zod_1.z.string().optional(),
            accountNumber: zod_1.z.string().optional(),
            ifscCode: zod_1.z.string().optional(),
            branchName: zod_1.z.string().optional(),
        }).optional(),
        taxDetails: zod_1.z.object({
            panNumber: zod_1.z.string().optional(),
            taxRegime: zod_1.z.enum(['OLD', 'NEW', '']).optional(),
        }).optional(),
    }),
});
exports.updateEmployeeSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeCode: zod_1.z.string().min(2).optional(),
        fullName: zod_1.z.string().min(3).optional(),
        email: zod_1.z.string().email().optional(),
        phone: zod_1.z.string().min(10).optional(),
        department: zod_1.z.string().min(2).optional(),
        designation: zod_1.z.string().min(2).optional(),
        joiningDate: zod_1.z.string().optional(),
        salary: zod_1.z.number().min(1000).optional(),
        address: zod_1.z.string().min(5).optional(),
        profileImage: zod_1.z.string().optional(),
        emergencyContact: zod_1.z.object({
            name: zod_1.z.string().min(2).optional(),
            relationship: zod_1.z.string().min(2).optional(),
            phone: zod_1.z.string().min(10).optional(),
        }).optional(),
        isActive: zod_1.z.boolean().optional(),
        branchId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid branch ID').optional(),
        costCenterId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid cost center ID').optional(),
        primaryManagerId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid manager ID').optional(),
        designationId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid designation ID').optional(),
        departmentId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID').optional(),
        confirmationDate: zod_1.z.string().optional(),
        terminationDate: zod_1.z.string().optional(),
        bankDetails: zod_1.z.object({
            bankName: zod_1.z.string().optional(),
            accountName: zod_1.z.string().optional(),
            accountNumber: zod_1.z.string().optional(),
            ifscCode: zod_1.z.string().optional(),
            branchName: zod_1.z.string().optional(),
        }).optional(),
        taxDetails: zod_1.z.object({
            panNumber: zod_1.z.string().optional(),
            taxRegime: zod_1.z.enum(['OLD', 'NEW', '']).optional(),
        }).optional(),
    }),
});
