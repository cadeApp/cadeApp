import { z } from 'zod';
import {
  adminAnnouncementsCursorSchema,
  announcementAudienceSchema,
  announcementCtaSchema,
  isAnnouncementCtaAllowed,
  type AdminAnnouncementsCursor,
  type AnnouncementCta,
} from '@/domain';
import { ANNOUNCEMENTS_COPY } from './copy';

const V = ANNOUNCEMENTS_COPY.admin.validation;

/** Pantalla de cada acción del banner: solo rutas de la app (CC-040). */
export const ANNOUNCEMENT_CTA_HREFS = {
  merchant_plan: '/merchant/plan',
  merchant_new_request: '/merchant/requests/new',
  courier_feed: '/courier/feed',
} as const satisfies Record<Exclude<AnnouncementCta, 'none'>, string>;

/** Formulario del admin: los días llegan como texto del input y se validan como entero de 1 a 30. */
export const announcementFormSchema = z
  .object({
    audience: announcementAudienceSchema,
    title: z.string().trim().min(1, V.title).max(60, V.title),
    body: z.string().trim().min(1, V.body).max(140, V.body),
    cta: announcementCtaSchema,
    visibleDays: z
      .string()
      .trim()
      .regex(/^\d{1,2}$/, V.days)
      .refine((value) => Number(value) >= 1 && Number(value) <= 30, V.days),
  })
  .refine((data) => isAnnouncementCtaAllowed(data.audience, data.cta), { message: V.cta, path: ['cta'] });
export type AnnouncementFormInput = z.infer<typeof announcementFormSchema>;

const CURSOR_SEPARATOR = '_';

/** Cursor en la URL: `<createdAt>_<id>`, con los microsegundos de `admin_list_announcements`. */
export const adminAnnouncementsCursorParamSchema = z
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
  .pipe(adminAnnouncementsCursorSchema);

/** Parsea `searchParams` de `/admin/announcements`; un cursor inválido vuelve a la primera página. */
export function parseAdminAnnouncementsSearchParams(raw: { cursor?: unknown }): { cursor?: AdminAnnouncementsCursor } {
  const parsed = adminAnnouncementsCursorParamSchema.optional().catch(undefined).parse(raw.cursor);
  return parsed ? { cursor: parsed } : {};
}

export function adminAnnouncementsHref(cursor?: AdminAnnouncementsCursor | null): string {
  if (!cursor) return '/admin/announcements';
  const params = new URLSearchParams({ cursor: `${cursor.createdAt}${CURSOR_SEPARATOR}${cursor.id}` });
  return `/admin/announcements?${params.toString()}`;
}
