import { z } from 'zod';
import {
  aguilaresLatSchema,
  aguilaresLngSchema,
  packageTypeSchema,
  recipientPaymentMethodSchema,
} from '@/domain/schemas';

export const createDeliveryRequestSchema = z
  .object({
    pickupZoneId: z.string().uuid('Seleccioná un barrio de retiro válido'),
    pickupAddress: z
      .string()
      .trim()
      .min(1, 'La dirección de retiro es obligatoria')
      .max(200, 'La dirección de retiro es demasiado larga'),
    pickupLat: aguilaresLatSchema.nullable().optional(),
    pickupLng: aguilaresLngSchema.nullable().optional(),
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
  .refine((data) => (data.pickupLat == null) === (data.pickupLng == null), {
    message: 'Las coordenadas de retiro deben enviarse juntas o ambas nulas.',
    path: ['pickupLat'],
  })
  .refine((data) => (data.dropoffLat == null) === (data.dropoffLng == null), {
    message: 'Las coordenadas de entrega deben enviarse juntas o ambas nulas.',
    path: ['dropoffLat'],
  })
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
  }));

export type CreateDeliveryRequestInput = z.input<typeof createDeliveryRequestSchema>;
export type CreateDeliveryRequestOutput = z.output<typeof createDeliveryRequestSchema>;
