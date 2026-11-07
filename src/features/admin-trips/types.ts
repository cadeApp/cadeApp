import { z } from 'zod';
import {
  deliveryRequestStatusSchema,
  incidentKindSchema,
  incidentStatusSchema,
  isoTimestampSchema,
  profileRoleSchema,
  uuidSchema,
  type AdminTripsCursor,
  type RpcOutput,
} from '@/domain';

/** Ítem de la lista de `/admin/trips` tal como lo devuelve `admin_list_trips` (CC-037). */
export type AdminTripListItem = RpcOutput<'admin_list_trips'>['items'][number];

export interface AdminTripsListResult {
  readonly items: readonly AdminTripListItem[];
  readonly pageSize: number;
  readonly nextCursor: AdminTripsCursor | null;
}

const partySchema = z
  .object({
    id: uuidSchema,
    name: z.string(),
    phone: z.string().nullable(),
  })
  .strict();

export const adminTripDropSchema = z
  .object({
    position: z.number().int().min(1),
    zoneName: z.string(),
    status: z.enum(['pending', 'delivered', 'failed']),
    deliveredAt: isoTimestampSchema.nullable(),
    failedReason: z.string().nullable(),
  })
  .strict();
export type AdminTripDrop = z.infer<typeof adminTripDropSchema>;

/** Eventos de `request_cancellation_reasons` que se muestran en la cronología. */
export const ADMIN_TRIP_EVENT_ACTIONS = ['courier_cancel_match', 'report_no_show', 'cancel_request'] as const;

export const adminTripEventSchema = z
  .object({
    id: uuidSchema,
    action: z.enum(ADMIN_TRIP_EVENT_ACTIONS),
    reason: z.string(),
    createdAt: isoTimestampSchema,
    actorName: z.string().nullable(),
    actorRole: profileRoleSchema.nullable(),
  })
  .strict();
export type AdminTripEvent = z.infer<typeof adminTripEventSchema>;

export const adminTripIncidentSchema = z
  .object({
    id: uuidSchema,
    kind: incidentKindSchema,
    status: incidentStatusSchema,
    createdAt: isoTimestampSchema,
  })
  .strict();
export type AdminTripIncident = z.infer<typeof adminTripIncidentSchema>;

/**
 * Detalle de `/admin/trips/[id]`, leído por la RLS del admin. Estricto y sin ningún dato del destinatario: ni
 * dirección, ni nombre, ni teléfono, ni pin, ni indicaciones, ni monto de cambio.
 */
export const adminTripDetailSchema = z
  .object({
    id: uuidSchema,
    code: z.string().regex(/^REQ-[0-9A-F]{8}$/),
    status: deliveryRequestStatusSchema,
    createdAt: isoTimestampSchema,
    merchant: partySchema,
    courier: partySchema.nullable(),
    timeline: z
      .object({
        publishedAt: isoTimestampSchema.nullable(),
        matchedAt: isoTimestampSchema.nullable(),
        pickedUpAt: isoTimestampSchema.nullable(),
        deliveredAt: isoTimestampSchema.nullable(),
        cancelledAt: isoTimestampSchema.nullable(),
      })
      .strict(),
    drops: z.array(adminTripDropSchema),
    events: z.array(adminTripEventSchema),
    incidents: z.array(adminTripIncidentSchema),
  })
  .strict();
export type AdminTripDetail = z.infer<typeof adminTripDetailSchema>;
