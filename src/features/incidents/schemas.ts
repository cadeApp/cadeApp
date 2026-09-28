import { z } from 'zod';
import {
  adminResolveIncidentInputSchema,
  incidentKindSchema,
  incidentsCursorSchema,
  reportIncidentInputSchema,
  type IncidentStatus,
  type IncidentsCursor,
} from '@/domain';

/**
 * C06/R07: formulario «Reportar un problema». Reutiliza los contratos canónicos de CC-012 (tipo, relato sin datos
 * de contacto, largo 5–1000) para que la UI y `reportIncidentAction` validen exactamente lo mismo que la RPC.
 */
export const reportIncidentFormSchema = z.object({
  requestId: reportIncidentInputSchema.shape.requestId,
  kind: incidentKindSchema,
  description: reportIncidentInputSchema.shape.description,
});
export type ReportIncidentFormInput = z.infer<typeof reportIncidentFormSchema>;

/**
 * A05 (D06-A): la única frontera de resolución es `{ incidentId, decision, reason }`. `strict()` rechaza cualquier
 * campo extra, en particular un `courierId` enviado por el cliente: Postgres deriva al repartidor desde el incidente.
 */
export const resolveIncidentSchema = adminResolveIncidentInputSchema.strict();
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>;

/** Campos que completa la persona en el Dialog de resolución; `incidentId` y `decision` los fija la pantalla. */
export const resolveIncidentFormSchema = resolveIncidentSchema.pick({ reason: true });
export type ResolveIncidentFormInput = z.infer<typeof resolveIncidentFormSchema>;

/** Pestañas de la bandeja A05: abiertos (`open`, `reviewing`) y cerrados (`resolved`, `dismissed`). */
export const INCIDENT_INBOX_TABS = ['open', 'closed'] as const;
export const incidentInboxTabSchema = z.enum(INCIDENT_INBOX_TABS);
export type IncidentInboxTab = z.infer<typeof incidentInboxTabSchema>;

export const INCIDENT_TAB_STATUSES = {
  open: ['open', 'reviewing'],
  closed: ['resolved', 'dismissed'],
} as const satisfies Record<IncidentInboxTab, readonly IncidentStatus[]>;

const CURSOR_SEPARATOR = '_';

/**
 * Cursor compuesto de la bandeja en la URL: `<createdAt>_<id>`. Conserva los microsegundos de `createdAt` tal como
 * los devuelve `admin_list_incidents`, así el keyset `created_at DESC, id DESC` no pierde ni repite empates.
 */
export const incidentsCursorParamSchema = z
  .string()
  .max(120)
  .transform((raw, ctx) => {
    const parts = raw.split(CURSOR_SEPARATOR);
    if (parts.length !== 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cursor inválido' });
      return z.NEVER;
    }
    const [createdAt, id] = parts;
    return { createdAt, id };
  })
  .pipe(incidentsCursorSchema);

export function serializeIncidentsCursor(cursor: IncidentsCursor): string {
  return `${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.id}`;
}

export const incidentsSearchParamsSchema = z.object({
  tab: incidentInboxTabSchema.catch('open'),
  cursor: incidentsCursorParamSchema.optional().catch(undefined),
});

export interface IncidentsSearchParams {
  readonly tab: IncidentInboxTab;
  readonly cursor?: IncidentsCursor;
}

/** Parsea `searchParams` de `/admin/incidents`; una pestaña o un cursor inválidos vuelven al valor por defecto. */
export function parseIncidentsSearchParams(raw: { tab?: unknown; cursor?: unknown }): IncidentsSearchParams {
  const { tab, cursor } = incidentsSearchParamsSchema.parse(raw);
  return cursor ? { tab, cursor } : { tab };
}

/** Link a una página de la bandeja conservando la pestaña; la pestaña por defecto no se escribe en la URL. */
export function incidentsInboxHref(tab: IncidentInboxTab, cursor?: IncidentsCursor): string {
  const params = new URLSearchParams();
  if (tab !== 'open') params.set('tab', tab);
  if (cursor) params.set('cursor', serializeIncidentsCursor(cursor));
  const query = params.toString();
  return query ? `/admin/incidents?${query}` : '/admin/incidents';
}
