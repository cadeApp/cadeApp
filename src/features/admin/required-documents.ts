import type { ApplicantDocumentDetail } from './types';

const REQUIRED_KINDS = ['dni_front', 'dni_back', 'selfie', 'avatar'] as const;

/**
 * CC-052 (D6-A): misma regla que `app_private.courier_required_documents_verified`. Exactamente un vigente por cada
 * obligatorio, verificado y sin purgar. Solo refleja: la RPC sigue siendo la única barrera.
 */
export function requiredDocumentsVerified(documents: readonly ApplicantDocumentDetail[]): boolean {
  return REQUIRED_KINDS.every((kind) => {
    const current = documents.filter((d) => d.documentType === kind && d.isCurrent !== false);
    return current.length === 1 && current[0]?.status === 'verified' && current[0].purgedAt === null;
  });
}
