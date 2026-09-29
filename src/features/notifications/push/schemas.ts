import { z } from 'zod';

// PR120-H16: el endpoint pendiente de baja viene de localStorage (frontera no confiable).
export const PendingUnsubEndpointSchema = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'endpoint must be https' });
