import type { MerchantSubscriptionStatus } from '@/domain';
import type {
  AdminApplicantTab,
  AdminMfaInput,
  ViewCourierDocumentInput,
  DecideCourierInput,
  SuspendCourierInput,
  VerifyCourierDocumentInput,
  RejectDocumentFormInput,
  DecisionFormInput,
} from './schemas';
export type {
  AdminApplicantTab,
  AdminMfaInput,
  ViewCourierDocumentInput,
  DecideCourierInput,
  SuspendCourierInput,
  VerifyCourierDocumentInput,
  RejectDocumentFormInput,
  DecisionFormInput,
} from './schemas';

export type CourierDocLevel = 0 | 1 | 2;

export interface ApplicantListItem {
  readonly id: string;
  readonly fullName: string;
  /** T-401: si el DNI está cargado; el hash nunca sale del servidor. */
  readonly hasDni: boolean;
  readonly phone: string;
  readonly vehicleType: 'walk' | 'bike' | 'moto' | 'car';
  readonly status: AdminApplicantTab;
  readonly docLevel: CourierDocLevel;
  readonly createdAt: string;
  readonly licenseStatus: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly insuranceStatus: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly documentsSummary: {
    readonly hasDniFront: boolean;
    readonly hasDniBack: boolean;
    readonly hasSelfie: boolean;
    readonly hasLicense: boolean;
    readonly hasInsurance: boolean;
  };
}

/** T-403: fila de la cola de postulantes, leída con `admin_list_applicants` (CC-044). */
export interface ApplicantQueueItem extends Omit<ApplicantListItem, 'vehicleType'> {
  readonly vehicleType: 'walk' | 'bike' | 'moto' | 'car' | null;
  /** CC-043: primer envío de la postulación; `null` (o ausente) en las previas al contrato: sin fecha conocida. */
  readonly submittedAt?: string | null;
}

export interface ApplicantDocumentDetail {
  readonly id: string;
  readonly documentType: 'dni_front' | 'dni_back' | 'selfie' | 'avatar' | 'license' | 'insurance';
  readonly storagePath: string;
  readonly status: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly uploadedAt: string;
  readonly isCurrent?: boolean;
  readonly rejectionCode?: string | null;
  /** CC-052 (D6-A): fecha de purga; un documento purgado no cuenta como verificado. */
  readonly purgedAt: string | null;
  /** CC-042: vehículo de la licencia o el seguro (se verifican por vehículo). */
  readonly vehicle?: { readonly vehicleType: 'walk' | 'bike' | 'moto' | 'car'; readonly plate: string | null } | null;
}

export interface ApplicantDetail {
  readonly id: string;
  readonly fullName: string;
  /** T-401: si el DNI está cargado; el hash nunca sale del servidor. */
  readonly hasDni: boolean;
  readonly phone: string;
  readonly vehicleType: 'walk' | 'bike' | 'moto' | 'car';
  readonly vehiclePlate: string | null;
  readonly status: AdminApplicantTab;
  readonly docLevel: CourierDocLevel;
  readonly licenseStatus: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly insuranceStatus: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly decidedAt: string | null;
  readonly decidedBy: string | null;
  readonly deactivatedAt: string | null;
  readonly createdAt: string;
  /** CC-043: primer envío completo de la postulación; `null` en las previas a CC-043 o sin envío. */
  readonly submittedAt?: string | null;
  /** CC-050 (PR711-H01): postulación enviada; sin envío no se aprueba ni se rechaza. */
  readonly applicationSubmitted: boolean;
  readonly documents: readonly ApplicantDocumentDetail[];
  /** T-404: consentimientos aceptados, leídos con la RLS del admin. */
  readonly consents?: readonly ApplicantConsent[];
  /** T-404: eventos reales del postulante, del más viejo al más nuevo (últimas 50 entradas). */
  readonly history?: readonly ApplicantHistoryEvent[];
}

export interface ApplicantConsent {
  readonly document: 'tos' | 'privacy' | 'courier_contract' | 'pilot_terms';
  readonly version: string;
  readonly acceptedAt: string;
}

export type ApplicantHistoryEvent =
  | { readonly kind: 'registered'; readonly id: string; readonly at: string }
  | { readonly kind: 'submitted'; readonly id: string; readonly at: string }
  | {
      readonly kind: 'audit';
      readonly id: string;
      readonly at: string;
      /** Etiqueta de T-400 (`auditActionLabel`). */
      readonly label: string;
      readonly detail: string | null;
      readonly reason: string | null;
      readonly actorName: string | null;
    };

/** T-387: cómo se muestra el documento firmado; lo decide el servidor por el path guardado. */
export type DocumentContentType = 'image' | 'pdf';

export interface ViewDocumentResult {
  readonly signedUrl: string;
  readonly expiresInSeconds: number;
  readonly contentType: DocumentContentType;
}

export interface AdminMerchantListItem {
  readonly id: string;
  readonly businessName: string;
  readonly ownerName: string;
  readonly phone: string;
  readonly pickupZoneName: string | null;
  readonly subscriptionStatus: MerchantSubscriptionStatus;
  readonly paidUntil: string | null;
  readonly deliveredCount: number;
  /** T-420: fecha de registro del comercio (`profiles.created_at`). */
  readonly createdAt: string | null;
  /** T-401: `business_name` vacío; `businessName` trae entonces el texto de respaldo. */
  readonly signupIncomplete: boolean;
}

export interface AdminMerchantsResult {
  readonly items: readonly AdminMerchantListItem[];
  readonly pageSize: number;
  readonly nextCursor: string | null;
  readonly hasNextPage: boolean;
}

/** T-405 (A03): cantidad exacta de comercios por estado del plan; `all` es el total sin filtro. */
export interface MerchantStatusCounts {
  readonly all: number;
  readonly pilot: number;
  readonly active: number;
  readonly expired: number;
  readonly cancelled: number;
}

export interface PlatformSettingsSnapshot {
  readonly minOfferArs: number;
  readonly requestTtlMinutes: number;
  readonly pilotActive: boolean;
  readonly pilotTermsVersion: string;
  readonly subscriptionGraceDays: number;
  readonly maxDropsPerRequest: number;
  /** CC-041 (T-415): minutos desde la última señal para contar a un repartidor como conectado. */
  readonly courierOnlineWindowMinutes: number;
  // CC-029 (T-369): créditos, arrastre y descuento. El precio de referencia puede no estar cargado todavía.
  readonly publicationDropsPerCredit: number;
  readonly carryoverBasePct: number;
  readonly carryoverStepPct: number;
  readonly carryoverCapPct: number;
  readonly launchDiscountPct: number;
  readonly looseCreditReferencePriceArs: number | null;
}

/** CC-029: fila del catálogo de planes (solo lectura en la UI admin). */
export interface PublicationPlanItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 'quota' | 'unlimited';
  readonly monthlyCredits: number | null;
  readonly referencePriceArs: number | null;
  readonly active: boolean;
  readonly sort: number;
}

/** CC-029 addendum D01-B: posición de la última fila de una página del catálogo (orden `sort, id`). */
export interface PublicationPlansCursor {
  readonly sort: number;
  readonly id: string;
}

/** Una página del catálogo (`admin_list_publication_plans`, máximo 50 filas). */
export interface PublicationPlansPage {
  readonly items: readonly PublicationPlanItem[];
  readonly nextCursor: PublicationPlansCursor | null;
}

/** Página pedida del catálogo, tal como llega por la URL de `/admin/merchants/plans`. */
export interface PublicationPlansQuery {
  readonly activeOnly: boolean;
  readonly after: PublicationPlansCursor | null;
}

export interface AdminMerchantHeader {
  readonly id: string;
  readonly businessName: string;
}

export type AuditChangeValue = string | number | boolean | null;

/** T-400: un lado ausente significa que el campo no estaba en ese lado de `audit_log` (≠ valor `null`). */
export interface AuditChange {
  readonly field: string;
  readonly before?: AuditChangeValue;
  readonly after?: AuditChangeValue;
}

export interface AuditLogItem {
  readonly id: number;
  readonly createdAt: string;
  readonly actorName: string | null;
  readonly action: string;
  readonly targetType: string;
  /** Id corto (8 caracteres) o la clave del parámetro; nunca el id completo. */
  readonly targetRef: string;
  /** Nombre del afectado resuelto en el servidor; `null` si no se pudo resolver. */
  readonly targetName: string | null;
  readonly changes: readonly AuditChange[];
  /** Motivo escrito por el admin, solo en las acciones que lo admiten (T-400). */
  readonly reason: string | null;
}

export interface AuditLogResult {
  readonly items: readonly AuditLogItem[];
  readonly pageSize: number;
  readonly nextCursor: number | null;
  readonly hasNextPage: boolean;
  /** T-407: id de la primera fila visible, para «Anterior» (`?cursor=<id>&dir=prev`). */
  readonly prevCursor: number | null;
  readonly hasPrevPage: boolean;
}

export interface AuditActorOption {
  readonly id: string;
  readonly name: string;
}
