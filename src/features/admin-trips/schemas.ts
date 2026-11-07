import { z } from 'zod';
import { adminTripsCursorSchema, adminTripsFilterSchema, type AdminTripsCursor, type AdminTripsFilter } from '@/domain';

/** Pestañas de `/admin/trips`: «Con problemas» (por defecto) y «Todos». */
export const ADMIN_TRIPS_TABS = ['problems', 'all'] as const satisfies readonly AdminTripsFilter[];

const CURSOR_SEPARATOR = '_';

/**
 * Cursor compuesto en la URL: `<createdAt>_<id>`, con los microsegundos tal como los devuelve `admin_list_trips`,
 * para que el keyset `created_at DESC, id DESC` no pierda ni repita empates.
 */
export const adminTripsCursorParamSchema = z
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
  .pipe(adminTripsCursorSchema);

export function serializeAdminTripsCursor(cursor: AdminTripsCursor): string {
  return `${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.id}`;
}

const adminTripsSearchParamsSchema = z.object({
  filter: adminTripsFilterSchema.catch('problems'),
  cursor: adminTripsCursorParamSchema.optional().catch(undefined),
});

export interface AdminTripsSearchParams {
  readonly filter: AdminTripsFilter;
  readonly cursor?: AdminTripsCursor;
}

/** Parsea `searchParams` de `/admin/trips`; un filtro o un cursor inválidos vuelven al valor por defecto. */
export function parseAdminTripsSearchParams(raw: { filter?: unknown; cursor?: unknown }): AdminTripsSearchParams {
  const { filter, cursor } = adminTripsSearchParamsSchema.parse(raw);
  return cursor ? { filter, cursor } : { filter };
}

export function adminTripsHref(filter: AdminTripsFilter, cursor?: AdminTripsCursor | null): string {
  const params = new URLSearchParams();
  if (filter !== 'problems') params.set('filter', filter);
  if (cursor) params.set('cursor', serializeAdminTripsCursor(cursor));
  const query = params.toString();
  return query ? `/admin/trips?${query}` : '/admin/trips';
}
