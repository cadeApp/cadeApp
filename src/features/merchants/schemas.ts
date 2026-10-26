import { z } from 'zod';
import { aguilaresLatSchema, aguilaresLngSchema } from '@/domain/schemas';

import { extractValidArgentineTenDigits, isValidArgentinePhone } from '@/lib/whatsapp';
import { requiredError } from '@/lib/zod-messages';

const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/;
const NOTES_CONTROL_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
const HAS_ALPHANUMERIC_REGEX = /[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]/;

const merchantBaseFields = {
  businessName: z
    .string(requiredError('El nombre del negocio es obligatorio'))
    .trim()
    .min(1, 'El nombre del negocio es obligatorio')
    .max(100, 'El nombre es demasiado largo')
    .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
      message: 'El nombre contiene caracteres de control no permitidos',
    })
    .refine((val) => !/[<>]/.test(val), {
      message: 'El nombre no puede contener etiquetas HTML o scripts',
    })
    .refine((val) => HAS_ALPHANUMERIC_REGEX.test(val), {
      message: 'El nombre debe contener al menos una letra o número',
    }),
  phone: z
    .string(requiredError('El teléfono de contacto es obligatorio'))
    .trim()
    .min(1, 'El teléfono de contacto es obligatorio')
    .max(30, 'El teléfono es demasiado largo')
    .refine((val) => isValidArgentinePhone(val), {
      message: 'El teléfono debe ser un número argentino válido (10 dígitos nacionales)',
    })
    .transform((val) => extractValidArgentineTenDigits(val)),
  defaultPickupZoneId: z.string().guid().nullable().optional(),
  defaultPickupAddress: z
    .string(requiredError('La dirección de retiro es obligatoria'))
    .trim()
    .min(1, 'La dirección de retiro es obligatoria')
    .max(200, 'La dirección es demasiado larga')
    .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
      message: 'La dirección contiene caracteres de control no permitidos',
    })
    .refine((val) => !/[<>]/.test(val), {
      message: 'La dirección no puede contener etiquetas HTML o scripts',
    })
    .refine((val) => HAS_ALPHANUMERIC_REGEX.test(val), {
      message: 'La dirección debe contener al menos el nombre de la calle o número',
    }),
  defaultPickupLat: aguilaresLatSchema.nullable().optional(),
  defaultPickupLng: aguilaresLngSchema.nullable().optional(),
  notes: z
    .string()
    .trim()
    .max(500, 'Las notas son demasiado largas')
    .refine((val) => !NOTES_CONTROL_REGEX.test(val), {
      message: 'Las notas contienen caracteres de control no permitidos',
    })
    .nullable()
    .optional(),
};

export const merchantOnboardingSchema = z
  .object({
    ...merchantBaseFields,
    acceptPilotTerms: z.literal(true, {
      error: 'Tenés que aceptar los Términos del piloto',
    }),
    pilotTermsVersion: z.string().trim().min(1),
  })
  .refine((data) => (data.defaultPickupLat == null) === (data.defaultPickupLng == null), {
    message: 'Las coordenadas de latitud y longitud deben enviarse juntas o ambas nulas.',
    path: ['defaultPickupLat'],
  });

export type MerchantOnboardingInput = z.infer<typeof merchantOnboardingSchema>;

export const merchantEditFormSchema = z
  .object({
    ...merchantBaseFields,
    acceptPilotTerms: z.boolean().optional(),
    pilotTermsVersion: z.string().optional(),
  })
  .refine((data) => (data.defaultPickupLat == null) === (data.defaultPickupLng == null), {
    message: 'Las coordenadas de latitud y longitud deben enviarse juntas o ambas nulas.',
    path: ['defaultPickupLat'],
  });

export type MerchantEditFormInput = z.infer<typeof merchantEditFormSchema>;

export const merchantUpdateSchema = z
  .object({
    businessName: z
      .string()
      .trim()
      .min(1, 'El nombre del negocio es obligatorio')
      .max(100, 'El nombre es demasiado largo')
      .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
        message: 'El nombre contiene caracteres de control no permitidos',
      })
      .refine((val) => !/[<>]/.test(val), {
        message: 'El nombre no puede contener etiquetas HTML o scripts',
      })
      .refine((val) => HAS_ALPHANUMERIC_REGEX.test(val), {
        message: 'El nombre debe contener al menos una letra o número',
      })
      .optional(),
    phone: z
      .string()
      .trim()
      .min(1, 'El teléfono de contacto es obligatorio')
      .max(30, 'El teléfono es demasiado largo')
      .refine((val) => isValidArgentinePhone(val), {
        message: 'El teléfono debe ser un número argentino válido (10 dígitos nacionales)',
      })
      .transform((val) => extractValidArgentineTenDigits(val))
      .optional(),
    defaultPickupZoneId: z.string().guid().nullable().optional(),
    defaultPickupAddress: z
      .string()
      .trim()
      .min(1, 'La dirección de retiro es obligatoria')
      .max(200, 'La dirección es demasiado larga')
      .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
        message: 'La dirección contiene caracteres de control no permitidos',
      })
      .refine((val) => !/[<>]/.test(val), {
        message: 'La dirección no puede contener etiquetas HTML o scripts',
      })
      .refine((val) => HAS_ALPHANUMERIC_REGEX.test(val), {
        message: 'La dirección debe contener al menos el nombre de la calle o número',
      })
      .optional(),
    defaultPickupLat: aguilaresLatSchema.nullable().optional(),
    defaultPickupLng: aguilaresLngSchema.nullable().optional(),
    notes: z
      .string()
      .trim()
      .max(500, 'Las notas son demasiado largas')
      .refine((val) => !NOTES_CONTROL_REGEX.test(val), {
        message: 'Las notas contienen caracteres de control no permitidos',
      })
      .nullable()
      .optional(),
  })
  .refine(
    (data) => (data.defaultPickupLat === undefined) === (data.defaultPickupLng === undefined),
    {
      message: 'Las coordenadas de latitud y longitud deben enviarse juntas.',
      path: ['defaultPickupLat'],
    }
  )
  .refine(
    (data) => (data.defaultPickupLat == null) === (data.defaultPickupLng == null),
    {
      message: 'Las coordenadas de latitud y longitud deben ser ambas numéricas o ambas nulas.',
      path: ['defaultPickupLat'],
    }
  );

export type MerchantUpdateInput = z.infer<typeof merchantUpdateSchema>;
