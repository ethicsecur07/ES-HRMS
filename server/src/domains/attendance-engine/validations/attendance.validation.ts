import { z } from 'zod';

export const createGeoFenceSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    radius: z.number().positive().default(100),
    isActive: z.boolean().optional(),
  }),
});

export const updateGeoFenceSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    radius: z.number().positive().optional(),
    isActive: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid geofence ID'),
  }),
});

export const createBiometricDeviceSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    ipAddress: z.string().ip({ version: 'v4' }),
    port: z.number().int().positive().default(4370),
    secretKey: z.string().optional(),
    status: z.enum(['ONLINE', 'OFFLINE']).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const simulateBiometricPingSchema = z.object({
  body: z.object({
    deviceId: z.string().min(1, 'Device ID is required'),
    cardNo: z.string().min(1, 'Card number is required'),
    direction: z.enum(['IN', 'OUT']),
  }),
});

export const createShiftSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Shift name is required'),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Start time must be HH:MM format'),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'End time must be HH:MM format'),
    workingDays: z.array(z.number().int().min(0).max(6)).min(1, 'At least one working day is required'),
    isActive: z.boolean().optional(),
  }),
});

export const assignShiftRotationSchema = z.object({
  body: z.object({
    employeeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid employee ID'),
    shifts: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid shift ID')).min(1, 'At least one shift is required'),
    rotationCycleWeeks: z.number().int().positive().default(1),
    startDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')).optional(),
  }),
});

export const checkInSchema = z.object({
  body: z.object({
    employeeId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid employee ID'),
    deviceInfo: z.string().min(1, 'Device info is required'),
    overrideReason: z.string().optional(),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
  }),
});

export const checkOutSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid attendance record ID'),
  }),
  body: z.object({
    taskReportId: z.string().optional(),
  }),
});

export const startBreakSchema = z.object({
  body: z.object({
    type: z.enum(['LUNCH', 'TEA', 'PERSONAL']).default('LUNCH'),
  }),
});

export const endBreakSchema = z.object({
  body: z.object({}),
});

export const approveOvertimeSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid attendance ID'),
  }),
});
