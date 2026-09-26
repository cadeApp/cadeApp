import { z } from 'zod';

export const adminApplicantTabSchema = z
  .enum(['pending', 'approved', 'rejected', 'suspended'])
  .catch('pending');

export type AdminApplicantTab = z.infer<typeof adminApplicantTabSchema>;

export const adminApplicantsPageSchema = z
  .preprocess((val) => {
    if (typeof val === 'string' && /^\d+$/.test(val.trim())) {
      return Number(val.trim());
    }
    if (typeof val === 'number') {
      return val;
    }
    return undefined;
  }, z.number().int().positive())
  .catch(1);

export const adminApplicantsSearchParamsSchema = z.object({
  tab: adminApplicantTabSchema,
  page: adminApplicantsPageSchema,
});

export function parseAdminApplicantsSearchParams(raw: {
  tab?: unknown;
  page?: unknown;
}): {
  tab: AdminApplicantTab;
  page: number;
} {
  return adminApplicantsSearchParamsSchema.parse(raw);
}
