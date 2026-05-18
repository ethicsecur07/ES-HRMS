"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEmployeeSchema = void 0;
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
        emergencyContact: zod_1.z.object({
            name: zod_1.z.string().min(2),
            relationship: zod_1.z.string().min(2),
            phone: zod_1.z.string().min(10),
        }),
    }),
});
