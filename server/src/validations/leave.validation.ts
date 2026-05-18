import { z } from 'zod';

export const applyLeaveSchema = z.object({
  body: z.object({
    employeeId: z.string().min(5),
    leaveType: z.string().min(2),
    startDate: z.string(),
    endDate: z.string(),
    totalDays: z.number().min(1),
    reason: z.string().min(5),
  }),
});
