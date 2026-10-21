import { z } from 'zod';

// PR120-H16: el endpoint pendiente de baja viene de localStorage (frontera no confiable).
export const PendingUnsubEndpointSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'endpoint must be https' });

// T-382: respuesta de POST /api/push/subscriptions/status (frontera de red).
export const PushStatusResponseSchema = z.object({ active: z.boolean() });
