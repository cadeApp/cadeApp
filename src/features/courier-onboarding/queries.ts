import 'server-only';
import { createClient } from '@/server/supabase/server';
import { createAdminClient } from '@/server/supabase/admin';
import type { Database } from '@/types/database.types';
import { getSafeRejectionMessage } from './copy';

export const COURIER_AVATAR_SIGNED_URL_TTL_SECONDS = 300;

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

export interface GetCourierAvatarUrlOptions {
  /** Cliente Supabase de sesión opcional */
  readonly client?: Awaited<ReturnType<typeof createClient>>;
}

/**
 * T-367: Obtiene la URL firmada del avatar verificado del repartidor desde el bucket privado courier-docs.
 *
 * Invariantes y reglas de seguridad:
 * 1. El repartidor debe estar en estado 'approved' en la tabla `couriers`.
 * 2. Solo el propio repartidor (o un administrador) puede solicitarla; acceso cruzado de terceros es bloqueado.
 * 3. El documento debe ser de tipo 'avatar', con status = 'verified', purged_at is null y vigente (is_current !== false).
 * 4. Jamás retorna ni utiliza DNI, selfie, licencia ni seguro como avatar o fallback.
 * 5. La ruta debe ser canónica dentro del directorio privado del repartidor (`courier/<courierId>/...`) sin '..'.
 * 6. Genera URL firmada server-side con TTL de 300 segundos sin exponer service-role en cliente ni volver público el bucket.
 * 7. Si no hay avatar, está pendiente/rechazado o falla Storage, retorna null de forma segura sin romper la vista.
 */
export async function getCourierApprovedAvatarUrl(
  courierId: string,
  options?: GetCourierAvatarUrlOptions
): Promise<string | null> {
  if (!courierId || typeof courierId !== 'string') {
    return null;
  }

  const supabase = options?.client ?? (await createClient());

  // 1. Verificación de autenticación de sesión
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // 2. Control de autorización: solo el propio repartidor o un admin
  const isOwner = user.id === courierId;
  if (!isOwner) {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle<{ role: string }>();

    if (profileError || !profile || profile.role !== 'admin') {
      return null;
    }
  }

  // 3. Verificación de estado del repartidor (debe estar habilitado/aprobado)
  const { data: courier, error: courierError } = await supabase
    .from('couriers')
    .select('status')
    .eq('profile_id', courierId)
    .maybeSingle<{ status: string }>();

  if (courierError || !courier || courier.status !== 'approved') {
    return null;
  }

  // 4. Consulta del avatar verificado vigente
  const { data: avatarDoc, error: docError } = await supabase
    .from('courier_documents')
    .select('kind, status, storage_path, is_current')
    .eq('courier_id', courierId)
    .eq('kind', 'avatar')
    .eq('status', 'verified')
    .is('purged_at', null)
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle<{
      kind: string;
      status: string;
      storage_path: string;
      is_current?: boolean | null;
    }>();

  if (docError || !avatarDoc) {
    return null;
  }

  // Invariante estricto: únicamente kind = 'avatar' y status = 'verified'
  if (avatarDoc.kind !== 'avatar' || avatarDoc.status !== 'verified') {
    return null;
  }

  // No proyectar versiones históricas
  if (avatarDoc.is_current === false) {
    return null;
  }

  // 5. Validación de prefijo y contención de ruta (sin path traversal)
  const expectedPrefix = `courier/${courierId}/`;
  if (
    !avatarDoc.storage_path ||
    !avatarDoc.storage_path.startsWith(expectedPrefix) ||
    avatarDoc.storage_path.includes('..')
  ) {
    return null;
  }

  // 6. Generación de URL firmada desde el bucket privado courier-docs
  try {
    const admin = createAdminClient();
    const { data: signed, error: signedError } = await admin.storage
      .from('courier-docs')
      .createSignedUrl(avatarDoc.storage_path, COURIER_AVATAR_SIGNED_URL_TTL_SECONDS);

    if (signedError || !signed?.signedUrl) {
      return null;
    }

    return signed.signedUrl;
  } catch {
    return null;
  }
}


