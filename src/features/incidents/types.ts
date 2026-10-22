import { z } from 'zod';
import {
  incidentKindSchema,
  incidentStatusSchema,
  isoTimestampSchema,
  profileRoleSchema,
  uuidSchema,
  type IncidentsCursor,
  type RpcOutput,
} from '@/domain';

/** Ítem de la bandeja A05 tal como lo devuelve `admin_list_incidents` (CC-012). */
export type IncidentListItem = RpcOutput<'admin_list_incidents'>['items'][number];

export interface IncidentsQueueResult {
  readonly items: readonly IncidentListItem[];
  readonly pageSize: number;
  /** Cursor compuesto `{ createdAt, id }` de la página siguiente; `null` si no hay más. */
  readonly nextCursor: IncidentsCursor | null;
}

/** Parte del viaje (comercio o repartidor) para mediación manual. Nunca datos del destinatario. */
export const incidentPartySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  phone: z.string().nullable(),
});
export type IncidentParty = z.infer<typeof incidentPartySchema>;

export const incidentTimelineSchema = z.object({
  publishedAt: isoTimestampSchema.nullable(),
  matchedAt: isoTimestampSchema.nullable(),
  pickedUpAt: isoTimestampSchema.nullable(),
  deliveredAt: isoTimestampSchema.nullable(),
  cancelledAt: isoTimestampSchema.nullable(),
});
export type IncidentTimeline = z.infer<typeof incidentTimelineSchema>;

/** A05: detalle que ve el admin. Se parsea en `getIncidentDetail`; no tiene campos del destinatario. */
export const incidentDetailSchema = z
  .object({
    id: uuidSchema,
    requestId: uuidSchema,
    kind: incidentKindSchema,
    description: z.string(),
    status: incidentStatusSchema,
    resolution: z.string().nullable(),
    createdAt: isoTimestampSchema,
    reporterRole: profileRoleSchema,
    reporterName: z.string(),
    merchant: incidentPartySchema,
    courier: incidentPartySchema.nullable(),
    courierSuspended: z.boolean(),
    timeline: incidentTimelineSchema,
  })
  .strict();
export type IncidentDetail = z.infer<typeof incidentDetailSchema>;
