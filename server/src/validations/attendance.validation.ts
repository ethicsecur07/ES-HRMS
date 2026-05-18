import { z } from 'zod';

export const checkInSchema = z.object({
  body: z.object({
    employeeId: z.string().min(5),
    ipAddress: z.string().min(7),
    deviceInfo: z.string().min(2),
    overrideReason: z.string().optional(),
  }),
});
