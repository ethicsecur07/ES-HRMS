"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyLeaveSchema = void 0;
const zod_1 = require("zod");
exports.applyLeaveSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: zod_1.z.string().min(5),
        leaveType: zod_1.z.string().min(2),
        startDate: zod_1.z.string(),
        endDate: zod_1.z.string(),
        totalDays: zod_1.z.number().min(1),
        reason: zod_1.z.string().min(5),
    }),
});
