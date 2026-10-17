import 'server-only';
import { createClient } from '@/server/supabase/server';
import type { Database } from '@/types/database.types';
import { getSafeRejectionMessage } from './copy';

export type CourierDocumentKind = Database['public']['Enums']['courier_document_kind'];
export type DocumentReviewStatus = Database['public']['Enums']['document_review_status'];

export interface CourierDocumentMetadata {
  readonly kind: CourierDocumentKind;
  readonly status: DocumentReviewStatus;
  readonly rejectionCode?: string | null;
  readonly rejectionMessage?: string | null;
}

export interface CourierDocumentRow {
  readonly kind: CourierDocumentKind;
  readonly status: DocumentReviewStatus;
  readonly rejection_code?: string | null;
  readonly is_current?: boolean;
  readonly uploaded_at: string;
}

export async function getCourierDocumentsStatus(
  courierId: string
): Promise<CourierDocumentMetadata[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('courier_documents')
    .select('kind, status, rejection_code, uploaded_at, is_current')
    .eq('courier_id', courierId)
    .eq('is_current', true)
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`Error al consultar documentos del repartidor: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as readonly CourierDocumentRow[];
  const seenKinds = new Set<CourierDocumentKind>();
  const documents: CourierDocumentMetadata[] = [];

  for (const row of rows) {
    if (!seenKinds.has(row.kind)) {
      seenKinds.add(row.kind);
      const isRejected = row.status === 'rejected';
      documents.push({
        kind: row.kind,
        status: row.status,
        rejectionCode: isRejected ? row.rejection_code ?? null : null,
        rejectionMessage: isRejected ? getSafeRejectionMessage(row.rejection_code) : null,
      });
    }
  }

  return documents;
}

