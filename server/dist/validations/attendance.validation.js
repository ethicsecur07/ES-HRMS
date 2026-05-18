"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkInSchema = void 0;
const zod_1 = require("zod");
exports.checkInSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: zod_1.z.string().min(5),
        ipAddress: zod_1.z.string().min(7),
        deviceInfo: zod_1.z.string().min(2),
        overrideReason: zod_1.z.string().optional(),
    }),
});
