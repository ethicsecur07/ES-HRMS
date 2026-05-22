"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveOvertimeSchema = exports.endBreakSchema = exports.startBreakSchema = exports.checkOutSchema = exports.checkInSchema = exports.assignShiftRotationSchema = exports.createShiftSchema = exports.simulateBiometricPingSchema = exports.createBiometricDeviceSchema = exports.updateGeoFenceSchema = exports.createGeoFenceSchema = void 0;
const zod_1 = require("zod");
exports.createGeoFenceSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required'),
        latitude: zod_1.z.number().min(-90).max(90),
        longitude: zod_1.z.number().min(-180).max(180),
        radius: zod_1.z.number().positive().default(100),
        isActive: zod_1.z.boolean().optional(),
    }),
});
exports.updateGeoFenceSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1).optional(),
        latitude: zod_1.z.number().min(-90).max(90).optional(),
        longitude: zod_1.z.number().min(-180).max(180).optional(),
        radius: zod_1.z.number().positive().optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid geofence ID'),
    }),
});
exports.createBiometricDeviceSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Name is required'),
        ipAddress: zod_1.z.string().ip({ version: 'v4' }),
        port: zod_1.z.number().int().positive().default(4370),
        secretKey: zod_1.z.string().optional(),
        status: zod_1.z.enum(['ONLINE', 'OFFLINE']).optional(),
        isActive: zod_1.z.boolean().optional(),
    }),
});
exports.simulateBiometricPingSchema = zod_1.z.object({
    body: zod_1.z.object({
        deviceId: zod_1.z.string().min(1, 'Device ID is required'),
        cardNo: zod_1.z.string().min(1, 'Card number is required'),
        direction: zod_1.z.enum(['IN', 'OUT']),
    }),
});
exports.createShiftSchema = zod_1.z.object({
    body: zod_1.z.object({
        name: zod_1.z.string().min(1, 'Shift name is required'),
        startTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:MM format'),
        endTime: zod_1.z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:MM format'),
        workingDays: zod_1.z.array(zod_1.z.number().int().min(0).max(6)).min(1, 'At least one working day is required'),
        isActive: zod_1.z.boolean().optional(),
    }),
});
exports.assignShiftRotationSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid employee ID'),
        shifts: zod_1.z.array(zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid shift ID')).min(1, 'At least one shift is required'),
        rotationCycleWeeks: zod_1.z.number().int().positive().default(1),
        startDate: zod_1.z.string().datetime().optional().or(zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')).optional(),
    }),
});
exports.checkInSchema = zod_1.z.object({
    body: zod_1.z.object({
        employeeId: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid employee ID'),
        deviceInfo: zod_1.z.string().min(1, 'Device info is required'),
        overrideReason: zod_1.z.string().optional(),
        lat: zod_1.z.number().min(-90).max(90).optional(),
        lng: zod_1.z.number().min(-180).max(180).optional(),
    }),
});
exports.checkOutSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid attendance record ID'),
    }),
    body: zod_1.z.object({
        taskReportId: zod_1.z.string().optional(),
    }),
});
exports.startBreakSchema = zod_1.z.object({
    body: zod_1.z.object({
        type: zod_1.z.enum(['LUNCH', 'TEA', 'PERSONAL']).default('LUNCH'),
    }),
});
exports.endBreakSchema = zod_1.z.object({
    body: zod_1.z.object({}),
});
exports.approveOvertimeSchema = zod_1.z.object({
    params: zod_1.z.object({
        id: zod_1.z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid attendance ID'),
    }),
});
