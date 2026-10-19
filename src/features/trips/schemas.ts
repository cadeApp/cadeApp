import { z } from 'zod';
import { isoTimestampSchema, uuidSchema } from '@/domain';

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

export const markDropDeliveredSchema = z.object({
  dropId: uuidSchema,
  requestId: uuidSchema,
});

export const markDropFailedSchema = z.object({
  dropId: uuidSchema,
  requestId: uuidSchema,
  reason: z.string().trim().min(1, 'El motivo es obligatorio').max(500),
});

// T-373: siguiente página del historial de cancelaciones (CC-032). El cursor sale tal cual de la página anterior.
export const loadCancellationHistoryPageSchema = z.object({
  requestId: uuidSchema,
  cursor: z
    .object({
      beforeCreatedAt: isoTimestampSchema,
      beforeId: uuidSchema,
    })
    .strict(),
});
