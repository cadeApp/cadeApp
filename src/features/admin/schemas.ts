import { z } from 'zod';
import {
  adminGrantPublicationCreditsInputSchema,
  adminRegisterPlanPeriodInputSchema,
  adminSetSubscriptionInputSchema,
  adminUpdateSettingInputSchema,
  adminUpsertPublicationPlanInputSchema,
  civilDateSchema,
} from '@/domain';

export const adminApplicantTabSchema = z
  .enum(['pending', 'approved', 'rejected', 'suspended'])
  .catch('pending');

export type AdminApplicantTab = z.infer<typeof adminApplicantTabSchema>;

export const adminApplicantsCursorSchema = z.string().uuid().optional();

export const adminApplicantsSearchParamsSchema = z.object({
  tab: adminApplicantTabSchema,
  cursor: adminApplicantsCursorSchema.catch(undefined),
});

export function parseAdminApplicantsSearchParams(raw: {
  tab?: unknown;
  cursor?: unknown;
}): {
  tab: AdminApplicantTab;
  cursor?: string;
} {
  return adminApplicantsSearchParamsSchema.parse(raw);
}

export const adminMfaSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
  redirectTo: z.string().optional(),
});

export const viewCourierDocumentSchema = z.object({
  documentId: z.string().uuid(),
  courierId: z.string().uuid(),
});

export const decideCourierSchema = z.object({
  courierId: z.string().uuid(),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().min(1).max(500),
});

export const suspendCourierSchema = z.object({
  courierId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

// CC-034: reactivar un suspendido o reconsiderar un rechazado.
export const reinstateCourierSchema = z.object({
  courierId: z.string().uuid(),
  reason: z.string().trim().min(1).max(500),
});

export const verifyCourierDocumentSchema = z
  .object({
    documentId: z.string().uuid(),
    verified: z.boolean(),
    rejectionReason: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.verified && !value.rejectionReason?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rejectionReason'],
        message: 'Ingresá el motivo del rechazo.',
      });
    }
  });

export const rejectDocumentFormSchema = z.object({
  rejectionReason: z.string().trim().min(1, 'Ingresá el motivo del rechazo.').max(500),
});

export const decisionFormSchema = z.object({
  reason: z.string().trim().min(1, 'El motivo de la decisión es obligatorio.').max(500),
});

export const adminApplicantIdSchema = z.string().uuid();

// T-123: las mutaciones de A03/A04 reutilizan exactamente los schemas de entrada de las RPC.
export const setMerchantSubscriptionSchema = adminSetSubscriptionInputSchema;
export const updatePlatformSettingSchema = adminUpdateSettingInputSchema;

export const AUDIT_TARGET_TYPES = [
  'courier',
  'courier_document',
  'merchant',
  'platform_setting',
  'delivery_request',
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

export interface AdminAuditFilters {
  readonly cursor?: number;
  readonly actorId?: string;
  readonly action?: string;
  readonly targetType?: AuditTargetType;
}

const uuidParamSchema = z.string().uuid();
const auditCursorParamSchema = z
  .string()
  .regex(/^[1-9]\d{0,15}$/)
  .transform(Number)
  .pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER));
const auditActionParamSchema = z.string().regex(/^[a-z][a-z0-9_]{0,63}$/);
const auditEntityParamSchema = z.enum(AUDIT_TARGET_TYPES);

/**
 * Parsea un parámetro de URL con su schema; un valor inválido se descarta sin afectar al resto.
 */
function parseParam<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, raw: unknown): T | undefined {
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export function parseAdminMerchantsSearchParams(raw: { cursor?: unknown }): {
  cursor?: string;
} {
  const cursor = parseParam(uuidParamSchema, raw.cursor);
  return cursor === undefined ? {} : { cursor };
}

/** CC-029: `/admin/merchants/[merchantId]/credits?before=<id>` (cursor del libro) y el id del comercio. */
export function parseMerchantCreditsParams(raw: { merchantId?: unknown; before?: unknown }): {
  merchantId?: string;
  beforeId: number | null;
} {
  return {
    merchantId: parseParam(uuidParamSchema, raw.merchantId),
    beforeId: parseParam(auditCursorParamSchema, raw.before) ?? null,
  };
}

export function parseAdminAuditSearchParams(raw: {
  cursor?: unknown;
  actor?: unknown;
  action?: unknown;
  entity?: unknown;
}): AdminAuditFilters {
  const cursor = parseParam(auditCursorParamSchema, raw.cursor);
  const actorId = parseParam(uuidParamSchema, raw.actor);
  const action = parseParam(auditActionParamSchema, raw.action);
  const targetType = parseParam(auditEntityParamSchema, raw.entity);

  return {
    ...(cursor !== undefined ? { cursor } : {}),
    ...(actorId !== undefined ? { actorId } : {}),
    ...(action !== undefined ? { action } : {}),
    ...(targetType !== undefined ? { targetType } : {}),
  };
}

// A03: hoja «Editar plan». El modo define el estado; la fecha es civil (YYYY-MM-DD).
export const MERCHANT_PLAN_MODES = ['paid', 'pilot'] as const;
export type MerchantPlanMode = (typeof MERCHANT_PLAN_MODES)[number];

export const merchantPlanFormSchema = z.object({
  mode: z.enum(MERCHANT_PLAN_MODES),
  paidUntil: z
    .string()
    .min(1, 'Elegí una fecha.')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Ingresá una fecha válida.')
    .pipe(civilDateSchema),
});
export type MerchantPlanFormInput = z.infer<typeof merchantPlanFormSchema>;

// A04: un formulario por parámetro; los valores numéricos llegan como texto del input y se
// convierten al tipo del contrato al armar el payload de `admin_update_setting`.
const integerTextSchema = (min: number, message: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .refine((value) => Number.isSafeInteger(Number(value)) && Number(value) >= min, message);

export const minOfferFormSchema = z.object({
  value: integerTextSchema(1, 'Ingresá un monto entero mayor a 0.'),
});
export const requestTtlFormSchema = z.object({
  value: integerTextSchema(1, 'Ingresá una cantidad entera de minutos mayor a 0.'),
});
export const graceDaysFormSchema = z.object({
  value: integerTextSchema(0, 'Ingresá una cantidad entera de días (0 o más).'),
});
export const maxDropsFormSchema = z.object({
  value: integerTextSchema(1, 'Ingresá una cantidad entera de entregas mayor a 0.'),
});
export const termsVersionFormSchema = z.object({
  value: z.string().trim().min(1, 'Ingresá la versión de los términos.'),
});

// CC-029 (T-369): parámetros de créditos, arrastre y descuento (mismos rangos que `admin_update_setting`).
const boundedIntegerTextSchema = (min: number, max: number, message: string) =>
  integerTextSchema(min, message).refine((value) => Number(value) <= max, message);

export const dropsPerCreditFormSchema = z.object({
  value: boundedIntegerTextSchema(1, 1000, 'Ingresá una cantidad entera de entregas entre 1 y 1000.'),
});
export const percentFormSchema = z.object({
  value: boundedIntegerTextSchema(0, 100, 'Ingresá un porcentaje entero entre 0 y 100.'),
});
export const referencePriceFormSchema = z.object({
  value: boundedIntegerTextSchema(0, 100_000_000, 'Ingresá un monto entero en pesos (0 o más).'),
});

// CC-029: formularios de créditos y planes. El servidor vuelve a validar con el contrato de la RPC.
export const PUBLICATION_GRANT_SOURCES = ['purchase', 'adjustment'] as const;
export type PublicationGrantSource = (typeof PUBLICATION_GRANT_SOURCES)[number];

const noteFormSchema = z.string().trim().max(500, 'La nota puede tener hasta 500 caracteres.');

export const grantCreditsFormSchema = z.object({
  credits: boundedIntegerTextSchema(1, 10_000, 'Ingresá una cantidad entera de créditos entre 1 y 10.000.'),
  source: z.enum(PUBLICATION_GRANT_SOURCES),
  note: noteFormSchema,
});
export type GrantCreditsFormInput = z.infer<typeof grantCreditsFormSchema>;

export const registerPeriodFormSchema = z.object({
  planId: z.string().uuid('Elegí un plan del catálogo.'),
  isPurchase: z.boolean(),
  note: noteFormSchema,
});
export type RegisterPeriodFormInput = z.infer<typeof registerPeriodFormSchema>;

// CC-038: sin código; la base lo genera desde el nombre.
export const publicationPlanFormSchema = z
  .object({
    name: z.string().trim().min(2, 'Ingresá un nombre de al menos 2 caracteres.').max(80, 'Hasta 80 caracteres.'),
    kind: z.enum(['quota', 'unlimited']),
    monthlyCredits: z.string().trim(),
    referencePriceArs: z.string().trim(),
    active: z.boolean(),
    sort: boundedIntegerTextSchema(0, 1000, 'Ingresá un orden entero entre 0 y 1000.'),
  })
  .superRefine((data, ctx) => {
    const credits = Number(data.monthlyCredits);
    if (data.kind === 'quota' && !(/^\d+$/.test(data.monthlyCredits) && credits >= 1 && credits <= 100_000)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['monthlyCredits'],
        message: 'Un plan con créditos mensuales lleva entre 1 y 100.000 créditos por mes.',
      });
    }
    const price = Number(data.referencePriceArs);
    if (data.referencePriceArs !== '' && !(/^\d+$/.test(data.referencePriceArs) && price <= 100_000_000)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['referencePriceArs'],
        message: 'Ingresá un precio entero en pesos o dejalo vacío.',
      });
    }
  });
export type PublicationPlanFormInput = z.infer<typeof publicationPlanFormSchema>;

export const upsertPublicationPlanSchema = adminUpsertPublicationPlanInputSchema;
export const grantPublicationCreditsSchema = adminGrantPublicationCreditsInputSchema;
export const registerPlanPeriodSchema = adminRegisterPlanPeriodInputSchema;

export type AdminMfaInput = z.infer<typeof adminMfaSchema>;
export type ViewCourierDocumentInput = z.infer<typeof viewCourierDocumentSchema>;
export type DecideCourierInput = z.infer<typeof decideCourierSchema>;
export type SuspendCourierInput = z.infer<typeof suspendCourierSchema>;
export type ReinstateCourierInput = z.infer<typeof reinstateCourierSchema>;
export type VerifyCourierDocumentInput = z.infer<typeof verifyCourierDocumentSchema>;
export type RejectDocumentFormInput = z.infer<typeof rejectDocumentFormSchema>;
export type DecisionFormInput = z.infer<typeof decisionFormSchema>;
export type SetMerchantSubscriptionInput = z.infer<typeof setMerchantSubscriptionSchema>;
export type UpdatePlatformSettingInput = z.infer<typeof updatePlatformSettingSchema>;
