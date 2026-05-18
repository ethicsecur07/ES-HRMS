import { z } from 'zod';

export const createEmployeeSchema = z.object({
  body: z.object({
    employeeCode: z.string().min(2),
    fullName: z.string().min(3),
    email: z.string().email(),
    phone: z.string().min(10),
    department: z.string().min(2),
    designation: z.string().min(2),
    joiningDate: z.string(),
    salary: z.number().min(1000),
    address: z.string().min(5),
    emergencyContact: z.object({
      name: z.string().min(2),
      relationship: z.string().min(2),
      phone: z.string().min(10),
    }),
  }),
});
