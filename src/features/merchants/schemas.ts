import { z } from 'zod';
import { aguilaresLatSchema, aguilaresLngSchema } from '@/domain/schemas';

export const merchantOnboardingSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(1, 'El nombre del negocio es obligatorio')
      .max(100, 'El nombre es demasiado largo'),
    phone: z
      .string()
      .trim()
      .min(1, 'El teléfono de contacto es obligatorio')
      .max(30, 'El teléfono es demasiado largo'),
    defaultPickupZoneId: z.string().uuid().nullable().optional(),
    defaultPickupAddress: z
      .string()
      .trim()
      .min(1, 'La dirección de retiro es obligatoria')
      .max(200, 'La dirección es demasiado larga'),
    defaultPickupLat: aguilaresLatSchema.nullable().optional(),
    defaultPickupLng: aguilaresLngSchema.nullable().optional(),
    notes: z.string().trim().max(500, 'Las notas son demasiado largas').nullable().optional(),
    acceptPilotTerms: z.literal(true, {
      errorMap: () => ({ message: 'Tenés que aceptar los Términos del piloto' }),
    }),
    pilotTermsVersion: z.string().trim().min(1),
  })
  .refine((data) => (data.defaultPickupLat == null) === (data.defaultPickupLng == null), {
    message: 'Las coordenadas de latitud y longitud deben enviarse juntas o ambas nulas.',
    path: ['defaultPickupLat'],
  });

export type MerchantOnboardingInput = z.infer<typeof merchantOnboardingSchema>;
