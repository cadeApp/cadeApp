import { z } from 'zod';
import {
  aguilaresLatSchema,
  aguilaresLngSchema,
  packageTypeSchema,
  recipientPaymentMethodSchema,
} from '@/domain/schemas';
import { isValidArgentinePhone } from '@/lib/whatsapp';

const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/;
const HAS_ALPHANUMERIC_REGEX = /[a-zA-Z0-9áéíóúÁÉÍÓÚüÜñÑ]/;
const HAS_LETTERS_REGEX = /[a-zA-ZáéíóúÁÉÍÓÚüÜñÑ]/;

export const dropSchema = z
  .object({
    dropoffZoneId: z.string().uuid('Seleccioná un barrio de entrega válido'),
    dropoffAddress: z
      .string({ required_error: 'La dirección de entrega es obligatoria' })
      .trim()
      .min(1, 'La dirección de entrega es obligatoria')
      .max(200, 'La dirección de entrega es demasiado larga')
      .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
        message: 'La dirección de entrega contiene caracteres de control no permitidos',
      })
      .refine((val) => !/[<>]/.test(val), {
        message: 'La dirección de entrega no puede contener etiquetas HTML o scripts',
      })
      .refine((val) => HAS_ALPHANUMERIC_REGEX.test(val), {
        message: 'La dirección de entrega debe contener al menos el nombre de la calle o número',
      }),
    dropoffLat: aguilaresLatSchema.nullable().optional(),
    dropoffLng: aguilaresLngSchema.nullable().optional(),
    recipientName: z
      .string({ required_error: 'El nombre del destinatario es obligatorio' })
      .trim()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(100, 'El nombre es demasiado largo')
      .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
        message: 'El nombre contiene caracteres de control no permitidos',
      })
      .refine((val) => !/[<>]/.test(val), {
        message: 'El nombre no puede contener etiquetas HTML o scripts',
      })
      .refine((val) => HAS_LETTERS_REGEX.test(val), {
        message: 'El nombre debe contener letras y no puede ser solo números o símbolos',
      }),
    recipientPhone: z
      .string({ required_error: 'El teléfono del destinatario es obligatorio' })
      .trim()
      .min(1, 'El teléfono del destinatario es obligatorio')
      .max(30, 'El teléfono es demasiado largo')
      .refine((val) => isValidArgentinePhone(val), {
        message: 'El teléfono debe ser un número argentino válido (10 dígitos nacionales)',
      }),
    recipientConsentDeclared: z.literal(true, {
      errorMap: () => ({
        message: 'Debés declarar que contás con la autorización del destinatario.',
      }),
    }),
    packageType: packageTypeSchema,
    recipientPaymentMethod: recipientPaymentMethodSchema,
    needsChange: z.boolean(),
    cashChangeAmount: z
      .number()
      .int('El monto de cambio debe ser un número entero')
      .finite('El monto de cambio debe ser un número finito')
      .positive('El monto para el cambio debe ser mayor a 0')
      .max(10_000_000, 'El monto para el cambio no puede superar los $10.000.000')
      .nullable()
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, 'Las indicaciones no pueden superar los 500 caracteres')
      .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
        message: 'Las indicaciones no pueden contener caracteres de control',
      })
      .nullable()
      .optional(),
  })
  .refine((data) => (data.dropoffLat == null) === (data.dropoffLng == null), {
    message: 'Las coordenadas de entrega deben enviarse juntas o ambas nulas.',
    path: ['dropoffLat'],
  })
  .refine(
    (data) => {
      if (data.recipientPaymentMethod !== 'cash' && data.needsChange) {
        return false;
      }
      return true;
    },
    {
      message: 'Solo los pagos en efectivo pueden requerir cambio.',
      path: ['needsChange'],
    }
  )
  .refine(
    (data) => {
      if (data.recipientPaymentMethod === 'cash' && data.needsChange) {
        return typeof data.cashChangeAmount === 'number' && data.cashChangeAmount > 0;
      }
      return true;
    },
    {
      message: 'Ingresá con cuánto dinero en efectivo va a pagar el destinatario.',
      path: ['cashChangeAmount'],
    }
  )
  .transform((data) => ({
    ...data,
    cashChangeAmount:
      data.recipientPaymentMethod === 'cash' && data.needsChange
        ? (data.cashChangeAmount ?? null)
        : null,
    notes: data.notes?.trim() ? data.notes.trim() : null,
  }));

export type DropInput = z.input<typeof dropSchema>;
export type DropOutput = z.output<typeof dropSchema>;

export const baseCreateDeliveryRequestSchema = z
  .object({
    requestId: z.string().uuid('Identificador de solicitud inválido').optional(),
    pickupZoneId: z.string().uuid('Seleccioná un barrio de retiro válido'),
    pickupAddress: z
      .string({ required_error: 'La dirección de retiro es obligatoria' })
      .trim()
      .min(1, 'La dirección de retiro es obligatoria')
      .max(200, 'La dirección de retiro es demasiado larga')
      .refine((val) => !CONTROL_CHARS_REGEX.test(val), {
        message: 'La dirección de retiro contiene caracteres de control no permitidos',
      })
      .refine((val) => !/[<>]/.test(val), {
        message: 'La dirección de retiro no puede contener etiquetas HTML o scripts',
      })
      .refine((val) => HAS_ALPHANUMERIC_REGEX.test(val), {
        message: 'La dirección de retiro debe contener al menos el nombre de la calle o número',
      }),
    pickupLat: aguilaresLatSchema.nullable().optional(),
    pickupLng: aguilaresLngSchema.nullable().optional(),
    fixedPriceArs: z
      .number()
      .int('El precio del envío debe ser un número entero')
      .finite('El precio del envío debe ser un número finito')
      .positive('El precio del envío debe ser mayor a 0')
      .max(10_000_000, 'El precio del envío no puede superar los $10.000.000')
      .nullable()
      .optional(),
    autoAssign: z.boolean().optional().default(false),
    drops: z.array(dropSchema).min(1, 'Debés incluir al menos una entrega'),
  })
  .refine((data) => (data.pickupLat == null) === (data.pickupLng == null), {
    message: 'Las coordenadas de retiro deben enviarse juntas o ambas nulas.',
    path: ['pickupLat'],
  })
  .refine(
    (data) => {
      if (data.autoAssign && !data.fixedPriceArs) {
        return false;
      }
      return true;
    },
    {
      message: 'La asignación automática requiere ingresar un precio de envío.',
      path: ['autoAssign'],
    }
  )
  .transform((data) => ({
    ...data,
    fixedPriceArs: data.fixedPriceArs ?? null,
    autoAssign: data.fixedPriceArs != null ? Boolean(data.autoAssign) : false,
  }));

export type CreateDeliveryRequestInput = z.input<typeof baseCreateDeliveryRequestSchema>;
export type CreateDeliveryRequestOutput = z.output<typeof baseCreateDeliveryRequestSchema>;

export const createDeliveryRequestSchema: z.ZodType<
  CreateDeliveryRequestOutput,
  z.ZodTypeDef,
  CreateDeliveryRequestInput
> = z.preprocess((raw) => {
  if (
    raw &&
    typeof raw === 'object' &&
    (!('drops' in raw) || !Array.isArray((raw as Record<string, unknown>).drops)) &&
    ('dropoffZoneId' in raw || 'dropoffAddress' in raw)
  ) {
    const {
      dropoffZoneId,
      dropoffAddress,
      dropoffLat,
      dropoffLng,
      recipientName,
      recipientPhone,
      recipientConsentDeclared,
      packageType,
      recipientPaymentMethod,
      needsChange,
      cashChangeAmount,
      notes,
      ...rest
    } = raw as Record<string, unknown>;
    return {
      ...rest,
      drops: [
        {
          dropoffZoneId,
          dropoffAddress,
          dropoffLat,
          dropoffLng,
          recipientName,
          recipientPhone,
          recipientConsentDeclared,
          packageType,
          recipientPaymentMethod,
          needsChange,
          cashChangeAmount,
          notes,
        },
      ],
    };
  }
  return raw;
}, baseCreateDeliveryRequestSchema) as unknown as z.ZodType<
  CreateDeliveryRequestOutput,
  z.ZodTypeDef,
  CreateDeliveryRequestInput
>;
