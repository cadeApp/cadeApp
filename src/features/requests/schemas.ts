import { z } from 'zod';
import {
  aguilaresLatSchema,
  aguilaresLngSchema,
  packageTypeSchema,
  recipientPaymentMethodSchema,
} from '@/domain/schemas';

export const dropSchema = z
  .object({
    dropoffZoneId: z.string().uuid('Seleccioná un barrio de entrega válido'),
    dropoffAddress: z
      .string()
      .trim()
      .min(1, 'La dirección de entrega es obligatoria')
      .max(200, 'La dirección de entrega es demasiado larga'),
    dropoffLat: aguilaresLatSchema.nullable().optional(),
    dropoffLng: aguilaresLngSchema.nullable().optional(),
    recipientName: z
      .string()
      .trim()
      .min(1, 'El nombre del destinatario es obligatorio')
      .max(100, 'El nombre es demasiado largo'),
    recipientPhone: z
      .string()
      .trim()
      .min(8, 'El teléfono del destinatario es obligatorio')
      .max(30, 'El teléfono es demasiado largo'),
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
      .positive('El monto para el cambio debe ser mayor a 0')
      .nullable()
      .optional(),
    notes: z
      .string()
      .trim()
      .max(500, 'Las indicaciones no pueden superar los 500 caracteres')
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
      .string()
      .trim()
      .min(1, 'La dirección de retiro es obligatoria')
      .max(200, 'La dirección de retiro es demasiado larga'),
    pickupLat: aguilaresLatSchema.nullable().optional(),
    pickupLng: aguilaresLngSchema.nullable().optional(),
    fixedPriceArs: z
      .number()
      .int('El precio del envío debe ser un número entero')
      .positive('El precio del envío debe ser mayor a 0')
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

export const cancelMerchantRequestSchema = z.object({
  requestId: z.string().uuid('Identificador de solicitud inválido'),
  reason: z
    .string()
    .trim()
    .min(1, 'El motivo es obligatorio')
    .max(500, 'El motivo es demasiado largo'),
});

export type CancelMerchantRequestInput = z.infer<typeof cancelMerchantRequestSchema>;
