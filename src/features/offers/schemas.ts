import { z } from 'zod';
import { uuidSchema } from '@/domain/rpc-contracts';
import { courierStatusSchema } from '@/domain/schemas';

export const submitOfferFormSchema = z.object({
  requestId: uuidSchema,
  amountArs: z
    .number({
      required_error: 'Ingresá el monto de tu oferta.',
      invalid_type_error: 'El monto debe ser un número entero.',
    })
    .int('El monto debe ser un número entero en pesos.')
    .min(1, 'El monto debe ser mayor a 0.'),
  etaMinutes: z
    .number({
      required_error: 'Seleccioná el tiempo estimado de llegada.',
      invalid_type_error: 'El tiempo estimado debe ser un número.',
    })
    .int()
    .min(1, 'El tiempo mínimo es 1 minuto.')
    .max(240, 'El tiempo máximo es 240 minutos (4 horas).'),
  message: z
    .string()
    .trim()
    .max(280, 'El mensaje no puede superar los 280 caracteres.')
    .nullable()
    .optional(),
});

export type SubmitOfferFormInput = z.infer<typeof submitOfferFormSchema>;

export const withdrawOfferFormSchema = z.object({
  offerId: uuidSchema,
});

export type WithdrawOfferFormInput = z.infer<typeof withdrawOfferFormSchema>;

export interface AvailableRequestItem {
  readonly id: string;
  readonly pickupZoneName: string;
  readonly dropoffZoneName: string;
  readonly approxDistanceKm: string;
  readonly packageType: 'small' | 'medium' | 'large';
  readonly recipientPaymentMethod: 'cash' | 'transfer';
  readonly needsChange: boolean;
  readonly cashChangeAmount: number | null;
  readonly notes: string | null;
  readonly publishedAt: string;
  readonly expiresAt: string | null;
  readonly hasMyOffer: boolean;
  readonly myOfferAmountArs: number | null;
}

export type CourierStatus = z.infer<typeof courierStatusSchema>;

export interface CourierStatusInfo {
  readonly status: CourierStatus;
  readonly available: boolean;
}

export interface CourierOfferItem {
  readonly offerId: string;
  readonly requestId: string;
  readonly pickupZoneName: string;
  readonly dropoffZoneName: string;
  readonly amountArs: number;
  readonly etaMinutes: number;
  readonly message: string | null;
  readonly status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  readonly createdAt: string;
  readonly decidedAt: string | null;
  readonly requestExpiresAt: string | null;
  readonly approxDistanceKm: string;
}
