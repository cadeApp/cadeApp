import { z } from 'zod';
import { signupRoleSchema, type SignupRole } from '@/domain/schemas';
import { authCopy } from './copy';

export const loginSchema = z.object({
  email: z.string().trim().email('Ingresá un email válido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  redirectTo: z.string().optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: z.string().trim().email('Ingresá un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: signupRoleSchema,
  displayName: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  acceptTerms: z
    .boolean()
    .optional()
    .refine((val) => val !== false, {
      message: authCopy.register.errorTermsRequired,
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type { SignupRole };
