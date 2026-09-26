import { z } from 'zod';
import { uuidSchema } from '@/domain';

export const tripActionBaseSchema = z.object({
  requestId: uuidSchema,
});

export const courierCancelTripSchema = z.object({
  requestId: uuidSchema,
  reason: z.string().trim().min(1, 'El motivo es obligatorio').max(500),
});

export const merchantReportNoShowSchema = z.object({
  requestId: uuidSchema,
  republish: z.boolean().default(true),
});

export const merchantCancelTripSchema = z.object({
  requestId: uuidSchema,
  reason: z.string().trim().min(1, 'El motivo es obligatorio').max(500),
});

export const republishTripSchema = z.object({
  requestId: uuidSchema,
  reason: z.string().trim().max(500).nullable().optional(),
});
