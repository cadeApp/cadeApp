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
  readonly dniHash: string;
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

export interface ApplicantDocumentDetail {
  readonly id: string;
  readonly documentType: 'dni_front' | 'dni_back' | 'selfie' | 'avatar' | 'license' | 'insurance';
  readonly storagePath: string;
  readonly status: 'none' | 'submitted' | 'verified' | 'rejected';
  readonly uploadedAt: string;
  readonly isCurrent?: boolean;
  readonly rejectionCode?: string | null;
}

export interface ApplicantDetail {
  readonly id: string;
  readonly fullName: string;
  readonly dniHash: string;
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
  readonly documents: readonly ApplicantDocumentDetail[];
}

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
}

export interface AdminMerchantsResult {
  readonly items: readonly AdminMerchantListItem[];
  readonly pageSize: number;
  readonly nextCursor: string | null;
  readonly hasNextPage: boolean;
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

export interface AuditChange {
  readonly field: string;
  readonly before: AuditChangeValue;
  readonly after: AuditChangeValue;
}

export interface AuditLogItem {
  readonly id: number;
  readonly createdAt: string;
  readonly actorName: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetRef: string;
  readonly changes: readonly AuditChange[];
  readonly hasReason: boolean;
}

export interface AuditLogResult {
  readonly items: readonly AuditLogItem[];
  readonly pageSize: number;
  readonly nextCursor: number | null;
  readonly hasNextPage: boolean;
}

export interface AuditActorOption {
  readonly id: string;
  readonly name: string;
}
