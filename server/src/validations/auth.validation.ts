import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().optional(),
    role: z.string().optional(),
  }),
});
