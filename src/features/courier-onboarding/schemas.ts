import { z } from 'zod';
import { vehicleTypeSchema } from '@/domain/schemas';

export const DNI_REGEX = /^(\d{7,8}|\d{1,2}\.\d{3}\.\d{3})$/;

export const dniSchema = z
  .string({ required_error: 'El DNI es obligatorio' })
  .trim()
  .regex(DNI_REGEX, 'El DNI debe tener 7 u 8 dígitos numéricos');

export const ARGENTINA_PLATE_REGEX =
  /^(?:[A-Z]{2}\s?\d{3}\s?[A-Z]{2}|[A-Z]\s?\d{3}\s?[A-Z]{3}|[A-Z]{3}\s?\d{3})$/i;

export const vehiclePlateSchema = z
  .string({ required_error: 'La patente es obligatoria' })
  .trim()
  .regex(ARGENTINA_PLATE_REGEX, 'Formato de patente argentina inválido (ej: AB 123 CD o A 123 BCD)');

export const courierOnboardingConsentsSchema = z.object({
  tos: z.literal(true, {
    errorMap: () => ({ message: 'Debés aceptar los Términos y Condiciones' }),
  }),
  privacy: z.literal(true, {
    errorMap: () => ({ message: 'Debés aceptar la Política de Privacidad' }),
  }),
  courierContract: z.literal(true, {
    errorMap: () => ({ message: 'Debés aceptar el Contrato de Repartidor Independiente' }),
  }),
});

export type CourierOnboardingConsentsInput = z.infer<typeof courierOnboardingConsentsSchema>;

export const courierOnboardingDocumentsSchema = z.object({
  dni_front: z.string({ required_error: 'El frente del DNI es obligatorio' }).min(1, 'El frente del DNI es obligatorio'),
  dni_back: z.string({ required_error: 'El dorso del DNI es obligatorio' }).min(1, 'El dorso del DNI es obligatorio'),
  selfie: z.string({ required_error: 'La selfie de verificación es obligatoria' }).min(1, 'La selfie de verificación es obligatoria'),
  avatar: z.string({ required_error: 'La foto de perfil (avatar) es obligatoria' }).min(1, 'La foto de perfil (avatar) es obligatoria'),
  license: z.string().min(1).optional(),
  insurance: z.string().min(1).optional(),
});

export type CourierOnboardingDocumentsInput = z.infer<typeof courierOnboardingDocumentsSchema>;

export const courierOnboardingSchema = z
  .object({
    dni: dniSchema,
    vehicleType: vehicleTypeSchema,
    vehiclePlate: z.string().trim().optional().nullable(),
    documents: courierOnboardingDocumentsSchema,
    consents: courierOnboardingConsentsSchema,
  })
  .superRefine((data, ctx) => {
    if (data.vehicleType === 'moto' || data.vehicleType === 'car') {
      if (!data.vehiclePlate || data.vehiclePlate.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La patente es obligatoria para motos y autos',
          path: ['vehiclePlate'],
        });
      } else if (!ARGENTINA_PLATE_REGEX.test(data.vehiclePlate.trim())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Formato de patente argentina inválido (ej: AB 123 CD o A 123 BCD)',
          path: ['vehiclePlate'],
        });
      }
    }
  });

export type CourierOnboardingInput = z.infer<typeof courierOnboardingSchema>;
