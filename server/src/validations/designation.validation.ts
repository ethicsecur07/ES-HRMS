import { z } from 'zod';

export const createDesignationSchema = z.object({
  body: z.object({
    departmentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID'),
    name: z.string().min(2, 'Designation name must be at least 2 characters'),
    code: z.string().min(2, 'Designation code must be at least 2 characters'),
  }),
});

export const updateDesignationSchema = z.object({
  body: z.object({
    departmentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid department ID').optional(),
    name: z.string().min(2).optional(),
    code: z.string().min(2).optional(),
    isActive: z.boolean().optional(),
  }),
});
