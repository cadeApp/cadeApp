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
  displayName: z.string().trim().min(1, 'Ingresá tu nombre y apellido').max(100),
  phone: z.string().trim().min(1, 'Ingresá tu teléfono').max(30),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: authCopy.register.errorTermsRequired }),
  }),
  acceptedTermsVersion: z.string().trim().min(1),
  acceptedPrivacyVersion: z.string().trim().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type { SignupRole };

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Ingresá un email válido'),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const updatePasswordSchema = z
  .object({
    password: z.string().min(8, authCopy.resetPassword.errorLength),
    confirmPassword: z.string().min(1, 'Confirmá tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: authCopy.resetPassword.errorMismatch,
    path: ['confirmPassword'],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;
