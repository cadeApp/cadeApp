import { z } from 'zod';

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

export type AdminMfaInput = z.infer<typeof adminMfaSchema>;
export type ViewCourierDocumentInput = z.infer<typeof viewCourierDocumentSchema>;
export type DecideCourierInput = z.infer<typeof decideCourierSchema>;
export type SuspendCourierInput = z.infer<typeof suspendCourierSchema>;
export type VerifyCourierDocumentInput = z.infer<typeof verifyCourierDocumentSchema>;
export type RejectDocumentFormInput = z.infer<typeof rejectDocumentFormSchema>;
export type DecisionFormInput = z.infer<typeof decisionFormSchema>;
