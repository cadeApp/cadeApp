import { type ActionResult, type DomainErrorCode, err, isDomainErrorCode, ok } from '../errors';
import { computeDocLevel } from '../priority';
import {
  COURIER_CANCELLATION_CATEGORY_LABELS,
  type CourierCancellationCategory,
  type RpcClientContract,
  type RpcErrorCode,
  type RpcInput,
  type RpcName,
  type RpcOutput,
  type PublicationBalance,
  RPC_CONTRACTS,
  validateOfferAmountAgainstFloor,
} from '../rpc-contracts';
import {
  type ConsentStatus,
  type CourierDocumentKind,
  type CourierStatus,
  type DeliveryRequestStatus,
  type DocumentRejectionCode,
  type DocumentReviewStatus,
  type IncidentKind,
  type IncidentStatus,
  type MerchantSubscriptionStatus,
  type OfferStatus,
  type PackageType,
  PLATFORM_SETTING_KEYS,
  type PlatformSettingKey,
  type ProfileRole,
  type RecipientPaymentMethod,
  type VehicleType,
  calculateHaversineRouteDistanceM,
  formatZoneToZoneDisplayLabel,
  isWithinAguilaresBounds,
} from '../schemas';
import {
  canCourierBeAccepted,
  canCourierSubmitOffer,
  canMerchantPublishRequest,
  getEffectiveRequestStatus,
  isRequestExpired,
  transitionOffer,
} from '../states';

export interface FakePlatformSettings {
  readonly minOfferArs: number;
  readonly maxOffersPerMin: number;
  readonly maxRequestPublicationsPerMin: number;
  readonly maxIncidentsPerMin: number;
  readonly requestTtlMinutes: number;
  readonly pilotActive: boolean;
  readonly pilotTermsVersion: string;
  readonly subscriptionGraceDays: number;
  readonly maxDropsPerRequest?: number;
  // CC-029 (T-369)
  readonly publicationDropsPerCredit?: number;
  readonly carryoverBasePct?: number;
  readonly carryoverStepPct?: number;
  readonly carryoverCapPct?: number;
  readonly launchDiscountPct?: number;
  readonly looseCreditReferencePriceArs?: number | null;
}

export interface FakeSeedDrop {
  readonly id?: string;
  readonly position?: number;
  readonly dropoffZoneId?: string;
  readonly dropoffZoneName?: string;
  readonly dropoffAddress?: string;
  readonly dropoffLat?: number | null;
  readonly dropoffLng?: number | null;
  readonly packageType?: PackageType;
  readonly recipientName?: string;
  readonly recipientPhone?: string;
  readonly recipientConsentDeclared?: boolean;
  readonly recipientPaymentMethod?: RecipientPaymentMethod;
  readonly needsChange?: boolean;
  readonly cashChangeAmount?: number | null;
  readonly notes?: string | null;
  readonly approxDistanceM?: number | null;
  readonly status?: 'pending' | 'delivered' | 'failed';
  readonly deliveredAt?: string | null;
  readonly failedReason?: string | null;
}

export interface FakeDropRecord {
  id: string;
  requestId: string;
  position: number;
  dropoffZoneId: string;
  dropoffZoneName: string;
  dropoffAddress: string;
  dropoffLat: number | null;
  dropoffLng: number | null;
  packageType: PackageType;
  recipientName: string;
  recipientPhone: string;
  recipientConsentDeclared: boolean;
  recipientPaymentMethod: RecipientPaymentMethod;
  needsChange: boolean;
  cashChangeAmount: number | null;
  notes: string | null;
  approxDistanceM: number | null;
  status: 'pending' | 'delivered' | 'failed';
  deliveredAt: string | null;
  failedReason: string | null;
}

export interface FakeActorContext {
  readonly userId: string;
  readonly role: ProfileRole | null;
  readonly consentStatus?: ConsentStatus;
  readonly aal: 'aal1' | 'aal2';
  readonly courierStatus: CourierStatus;
  readonly courierAvailable: boolean;
  readonly merchantSubscriptionStatus: MerchantSubscriptionStatus;
  readonly merchantPaidUntil: string | null;
}

export interface FakeSeedRequest {
  readonly requestId: string;
  readonly merchantId: string;
  readonly status: DeliveryRequestStatus;
  readonly expiresAt?: string | null;
  readonly matchedAt?: string | null;
  readonly deliveredAt?: string | null;
  readonly acceptedOfferId?: string | null;
  readonly assignedCourierId?: string | null;
  readonly pickupLat?: number | null;
  readonly pickupLng?: number | null;
  readonly dropoffLat?: number | null;
  readonly dropoffLng?: number | null;
  readonly pickupZoneName?: string;
  readonly dropoffZoneName?: string;
  readonly pickupAddress?: string;
  readonly dropoffAddress?: string;
  readonly recipientName?: string;
  readonly recipientPhone?: string;
  readonly recipientPaymentMethod?: RecipientPaymentMethod;
  readonly needsChange?: boolean;
  readonly cashChangeAmount?: number | null;
  readonly notes?: string | null;
  readonly createdAt?: string;
  readonly pickedUpAt?: string | null;
  readonly fixedPriceArs?: number | null;
  readonly autoAssign?: boolean;
  readonly drops?: readonly FakeSeedDrop[];
  readonly dropsCount?: number;
}

export interface FakeRequestRecord {
  readonly requestId: string;
  readonly merchantId: string;
  status: DeliveryRequestStatus;
  expiresAt: string | null;
  matchedAt: string | null;
  deliveredAt: string | null;
  acceptedOfferId: string | null;
  assignedCourierId: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  dropoffLat: number | null;
  dropoffLng: number | null;
  pickupZoneName: string;
  dropoffZoneName: string;
  pickupAddress: string;
  dropoffAddress: string;
  recipientName: string;
  recipientPhone: string;
  recipientPaymentMethod: RecipientPaymentMethod | null;
  needsChange: boolean;
  cashChangeAmount: number | null;
  notes: string | null;
  createdAt: string;
  pickedUpAt: string | null;
  fixedPriceArs: number | null;
  autoAssign: boolean;
  drops: FakeDropRecord[];
  dropsCount: number;
}

export interface FakeSeedOffer {
  readonly offerId: string;
  readonly requestId: string;
  readonly courierId: string;
  readonly amountArs: number;
  readonly status: OfferStatus;
}

export interface FakeOfferRecord {
  readonly offerId: string;
  readonly requestId: string;
  readonly courierId: string;
  readonly amountArs: number;
  status: OfferStatus;
}

export interface FakeSeedCourier {
  readonly courierId: string;
  readonly status: CourierStatus;
  readonly available: boolean;
  readonly licenseStatus?: DocumentReviewStatus;
  readonly insuranceStatus?: DocumentReviewStatus;
  readonly displayName?: string;
  readonly phone?: string | null;
  readonly vehicleType?: VehicleType | null;
  readonly vehiclePlate?: string | null;
}

export interface FakeCourierRecord {
  readonly courierId: string;
  status: CourierStatus;
  available: boolean;
  licenseStatus: DocumentReviewStatus;
  insuranceStatus: DocumentReviewStatus;
  displayName: string;
  phone: string | null;
  vehicleType: VehicleType | null;
  vehiclePlate: string | null;
}

export interface FakeSeedMerchant {
  readonly merchantId: string;
  readonly subscriptionStatus: MerchantSubscriptionStatus;
  readonly paidUntil?: string | null;
  readonly businessName?: string;
  readonly phone?: string | null;
  readonly defaultPickupAddress?: string | null;
  readonly defaultPickupZoneId?: string | null;
  readonly defaultPickupLat?: number | null;
  readonly defaultPickupLng?: number | null;
  readonly notes?: string | null;
}

export interface FakeMerchantRecord {
  readonly merchantId: string;
  subscriptionStatus: MerchantSubscriptionStatus;
  paidUntil: string | null;
  businessName: string;
  phone: string | null;
  defaultPickupAddress: string | null;
  defaultPickupZoneId: string | null;
  defaultPickupLat: number | null;
  defaultPickupLng: number | null;
  notes: string | null;
}

export interface FakeSeedDocument {
  readonly documentId: string;
  readonly courierId: string;
  readonly kind: CourierDocumentKind;
  readonly status: DocumentReviewStatus;
  readonly isCurrent?: boolean;
  readonly rejectionCode?: DocumentRejectionCode | null;
  readonly storagePath?: string;
  readonly purgeAfter?: string | null;
  readonly idempotencyKey?: string | null;
}

export interface FakeDocumentRecord {
  readonly documentId: string;
  readonly courierId: string;
  readonly kind: CourierDocumentKind;
  status: DocumentReviewStatus;
  isCurrent: boolean;
  rejectionCode: DocumentRejectionCode | null;
  storagePath: string;
  purgeAfter: string | null;
  idempotencyKey: string | null;
}

export interface FakeSeedIncident {
  readonly incidentId: string;
  readonly requestId: string;
  readonly reporterId: string;
  readonly reporterRole: ProfileRole;
  readonly reporterName?: string;
  readonly kind: IncidentKind;
  readonly description: string;
  readonly status?: IncidentStatus;
  readonly resolution?: string | null;
  readonly createdAt: string;
}

export interface FakeIncidentRecord {
  readonly incidentId: string;
  readonly requestId: string;
  readonly reporterId: string;
  readonly reporterRole: ProfileRole;
  readonly reporterName: string;
  readonly kind: IncidentKind;
  readonly description: string;
  status: IncidentStatus;
  resolution: string | null;
  readonly createdAt: string;
}

// CC-032: filas de `request_cancellation_reasons`. `actorId`/`offerId` en null replican el `on delete set null`.
export interface FakeSeedCancellationReason {
  readonly id: string;
  readonly requestId: string;
  readonly offerId: string | null;
  readonly actorId: string | null;
  readonly action: string;
  readonly reason: string;
  readonly createdAt: string;
}

export type FakeCancellationReasonRecord = FakeSeedCancellationReason;

// CC-029 (T-369): registros en memoria de créditos de publicación.
export interface FakePublicationPlanRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 'quota' | 'unlimited';
  readonly monthlyCredits: number | null;
  readonly referencePriceArs: number | null;
  readonly active: boolean;
  readonly sort: number;
}

export interface FakePlanPeriodRecord {
  readonly id: string;
  readonly merchantId: string;
  readonly planId: string;
  readonly planKind: 'quota' | 'unlimited';
  readonly monthlyCredits: number | null;
  readonly startsAtMs: number;
  readonly endsAtMs: number;
  readonly streak: number;
  readonly carryoverPct: number;
  readonly previousPeriodId: string | null;
  carryoverMaterialized: boolean;
  readonly operationKey: string;
  readonly isPurchase: boolean;
  readonly note: string | null;
  launchDiscountPct: number | null;
}

export interface FakeCreditLotRecord {
  readonly id: string;
  readonly merchantId: string;
  readonly kind: 'loose' | 'plan' | 'carryover';
  readonly periodId: string | null;
  readonly granted: number;
  readonly expiresAtMs: number | null;
  readonly source: 'purchase' | 'adjustment' | 'plan' | 'carryover' | 'refund_conversion';
  readonly operationKey: string | null;
  readonly refundChargeId: string | null;
  readonly refundSourceLotId: string | null;
  readonly note: string | null;
  readonly createdSeq: number;
}

export interface FakePublicationChargeRecord {
  readonly id: string;
  readonly requestId: string;
  readonly merchantId: string;
  readonly mode: 'credits' | 'unlimited' | 'legacy_paid';
  readonly cost: number;
  state: 'reserved' | 'consumed' | 'released';
  isCurrent: boolean;
  readonly periodId: string | null;
  readonly parts: Array<{ readonly lotId: string; readonly amount: number }>;
}

export interface FakeCreditMovementRecord {
  readonly id: number;
  readonly merchantId: string;
  readonly lotId: string | null;
  readonly chargeId: string | null;
  readonly requestId: string | null;
  readonly kind: 'grant' | 'reserve' | 'consume' | 'unconsume' | 'release' | 'convert';
  readonly amount: number;
  readonly actorId: string | null;
  readonly reason: string | null;
  readonly createdAtMs: number;
}

export interface FakeRpcOptions {
  readonly settings: FakePlatformSettings;
  readonly now?: () => Date;
  /** Solo para probar que el adaptador rechaza una salida RPC que viola su contrato. */
  readonly invalidOutputFor?: RpcName;
  readonly initialActor?: Partial<FakeActorContext>;
  readonly initialRequests?: readonly FakeSeedRequest[];
  readonly initialOffers?: readonly FakeSeedOffer[];
  readonly initialCouriers?: readonly FakeSeedCourier[];
  readonly initialMerchants?: readonly FakeSeedMerchant[];
  readonly initialDocuments?: readonly FakeSeedDocument[];
  readonly initialIncidents?: readonly FakeSeedIncident[];
  readonly initialCancellationReasons?: readonly FakeSeedCancellationReason[];
}

export interface FakeRpcClient extends RpcClientContract {
  readonly setForcedError: <K extends RpcName>(rpcName: K, code: RpcErrorCode<K> | null) => void;
  readonly setMinOfferArs: (minOfferArs: number) => void;
  readonly setActor: (patch: Partial<FakeActorContext>) => void;
  readonly seedRequest: (request: FakeSeedRequest) => void;
  readonly seedOffer: (offer: FakeSeedOffer) => void;
  readonly seedCourier: (courier: FakeSeedCourier) => void;
  readonly deleteCourier: (courierId: string) => void;
  readonly seedMerchant: (merchant: FakeSeedMerchant) => void;
  readonly deleteMerchant: (merchantId: string) => void;
  readonly seedDocument: (doc: FakeSeedDocument) => void;
  readonly getDocument: (documentId: string) => FakeDocumentRecord | undefined;
  readonly seedIncident: (incident: FakeSeedIncident) => void;
  readonly getIncident: (incidentId: string) => FakeIncidentRecord | undefined;
  /** CC-032: siembra una fila de `request_cancellation_reasons` (cualquier acción, para probar el filtro). */
  readonly seedCancellationReason: (row: FakeSeedCancellationReason) => void;
  readonly getCancellationReasons: (requestId: string) => readonly FakeCancellationReasonRecord[];
  readonly getRequest: (requestId: string) => FakeRequestRecord | undefined;
  /** CC-029: cargos de publicación de una solicitud (históricos incluidos), en orden de creación. */
  readonly getPublicationCharges: (requestId: string) => readonly FakePublicationChargeRecord[];
  readonly getOffer: (offerId: string) => FakeOfferRecord | undefined;
  readonly getCourier: (courierId: string) => FakeCourierRecord | undefined;
  readonly getSettings: () => FakePlatformSettings;
  readonly triggerErrorCode: (
    code: DomainErrorCode
  ) => Promise<ActionResult<never, DomainErrorCode>>;
}

const DEFAULT_ACTOR: FakeActorContext = {
  userId: '00000000-0000-4000-8000-000000000001',
  role: 'courier',
  consentStatus: 'active',
  aal: 'aal2',
  courierStatus: 'approved',
  courierAvailable: true,
  merchantSubscriptionStatus: 'pilot',
  merchantPaidUntil: null,
};

const ALLOWED_ROLES_BY_RPC: { readonly [K in RpcName]: readonly ProfileRole[] } = {
  update_my_merchant_profile: ['merchant'],
  reconcile_expired_requests: ['merchant'],
  create_and_publish_multi_drop: ['merchant'],
  publish_request: ['merchant'],
  cancel_request: ['merchant', 'admin'],
  submit_offer: ['courier'],
  take_request: ['courier'],
  withdraw_offer: ['courier'],
  accept_offer: ['merchant'],
  mark_picked_up: ['courier'],
  mark_delivered: ['courier'],
  mark_drop_delivered: ['courier'],
  mark_drop_failed: ['courier'],
  report_no_show: ['merchant'],
  courier_cancel_match: ['courier'],
  republish_request: ['merchant'],
  // CC-012 / D05-A: el admin nunca reporta incidentes.
  report_incident: ['merchant', 'courier'],
  set_availability: ['courier'],
  calculate_route_distance: ['merchant', 'courier', 'admin'],
  get_trip_details: ['merchant', 'courier'],
  get_request_offer_couriers: ['merchant'],
  get_merchant_request_private_fields: ['merchant'],
  replace_courier_document: ['courier'],
  admin_decide_courier: ['admin'],
  admin_suspend_courier: ['admin'],
  admin_reinstate_courier: ['admin'],
  admin_verify_document: ['admin'],
  admin_set_subscription: ['admin'],
  admin_update_setting: ['admin'],
  admin_resolve_incident: ['admin'],
  admin_list_incidents: ['admin'],
  admin_upsert_publication_plan: ['admin'],
  admin_grant_publication_credits: ['admin'],
  admin_register_plan_period: ['admin'],
  admin_get_merchant_publication_credits: ['admin'],
  admin_list_publication_plans: ['admin'],
  get_my_publication_balance: ['merchant'],
  get_request_cancellation_history: ['merchant', 'courier', 'admin'],
};

// CC-012 / D05-A: el comercio dueño reporta en matched, in_transit y delivered (≤ 24 h);
// el repartidor asignado solo en matched e in_transit.
const ACTIVE_INCIDENT_STATUSES: readonly DeliveryRequestStatus[] = ['matched', 'in_transit'];

const DEFAULT_INCIDENTS_PAGE_SIZE = 20;

const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/;

/**
 * CC-012: epoch en microsegundos de un timestamp ISO, sin pasar por `Date.parse` (que trunca a
 * milisegundos). Así el keyset del fake compara con la misma precisión que `timestamptz` en Postgres.
 */
export function isoTimestampToEpochMicros(iso: string): bigint {
  const match = ISO_TIMESTAMP_PATTERN.exec(iso);
  if (!match) {
    throw new Error(`Timestamp ISO inválido para el keyset: ${iso}`);
  }
  const [, year, month, day, hour, minute, second, fraction = '', zone, sign, offsetHour, offsetMinute] = match;
  const wholeSecondsMs = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
  const offsetMinutes =
    zone === 'Z' ? 0 : (sign === '-' ? -1 : 1) * (Number(offsetHour) * 60 + Number(offsetMinute));
  return (
    BigInt(wholeSecondsMs) * 1000n +
    BigInt(fraction.padEnd(6, '0')) -
    BigInt(offsetMinutes) * 60_000_000n
  );
}

function compareIncidentKeysetDesc(
  a: { readonly createdAt: string; readonly incidentId: string },
  b: { readonly createdAt: string; readonly incidentId: string }
): number {
  const aMicros = isoTimestampToEpochMicros(a.createdAt);
  const bMicros = isoTimestampToEpochMicros(b.createdAt);
  if (aMicros !== bMicros) return aMicros > bMicros ? -1 : 1;
  return a.incidentId < b.incidentId ? 1 : a.incidentId > b.incidentId ? -1 : 0;
}

const INCIDENT_WINDOW_MS = 24 * 3_600_000;

// CC-032 / 2-A: coincidencia exacta tras trim, minúsculas y sin tildes, como el `case` de la función SQL.
const COURIER_CANCELLATION_REASON_MATCHES: Readonly<Record<string, CourierCancellationCategory>> = {
  'tuve un imprevisto': 'unforeseen_issue',
  unforeseen_issue: 'unforeseen_issue',
  'problema con el vehiculo': 'vehicle_breakdown',
  vehicle_breakdown: 'vehicle_breakdown',
  'no puedo llegar al punto de retiro': 'pickup_issue',
  pickup_issue: 'pickup_issue',
  emergencia: 'personal_emergency',
  personal_emergency: 'personal_emergency',
};

function classifyCourierCancellationReason(reason: string): CourierCancellationCategory {
  const normalized = reason
    .trim()
    .toLowerCase()
    .replace(/[áéíóúü]/g, (ch) => ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u' })[ch] ?? ch);
  return Object.hasOwn(COURIER_CANCELLATION_REASON_MATCHES, normalized)
    ? (COURIER_CANCELLATION_REASON_MATCHES[normalized] ?? 'other')
    : 'other';
}

function assertValidFakeOptions(options: FakeRpcOptions | undefined): FakePlatformSettings {
  if (!options || typeof options !== 'object' || !options.settings) {
    throw new Error(
      'createFakeRpcClient requires explicit options.settings (minOfferArs, maxOffersPerMin, maxRequestPublicationsPerMin, maxIncidentsPerMin, requestTtlMinutes, pilotActive, pilotTermsVersion, subscriptionGraceDays)'
    );
  }
  const { settings } = options;
  if (
    !Number.isInteger(settings.minOfferArs) ||
    settings.minOfferArs < 1 ||
    !Number.isInteger(settings.maxOffersPerMin) ||
    settings.maxOffersPerMin < 1 ||
    !Number.isInteger(settings.maxRequestPublicationsPerMin) ||
    settings.maxRequestPublicationsPerMin < 1 ||
    !Number.isInteger(settings.maxIncidentsPerMin) ||
    settings.maxIncidentsPerMin < 1 ||
    !Number.isInteger(settings.requestTtlMinutes) ||
    settings.requestTtlMinutes < 1 ||
    typeof settings.pilotActive !== 'boolean' ||
    typeof settings.pilotTermsVersion !== 'string' ||
    settings.pilotTermsVersion.trim().length === 0 ||
    !Number.isInteger(settings.subscriptionGraceDays) ||
    settings.subscriptionGraceDays < 0 ||
    (settings.maxDropsPerRequest !== undefined &&
      (!Number.isInteger(settings.maxDropsPerRequest) || settings.maxDropsPerRequest < 1))
  ) {
    throw new Error('createFakeRpcClient received invalid options.settings values');
  }
  return {
    ...settings,
    maxDropsPerRequest: settings.maxDropsPerRequest ?? 5,
    publicationDropsPerCredit: settings.publicationDropsPerCredit ?? 2,
    carryoverBasePct: settings.carryoverBasePct ?? 5,
    carryoverStepPct: settings.carryoverStepPct ?? 5,
    carryoverCapPct: settings.carryoverCapPct ?? 35,
    launchDiscountPct: settings.launchDiscountPct ?? 0,
    looseCreditReferencePriceArs: settings.looseCreditReferencePriceArs ?? null,
  };
}

export function createFakeRpcClient(options: FakeRpcOptions): FakeRpcClient {
  let settings: FakePlatformSettings = assertValidFakeOptions(options);
  const forcedErrors = new Map<RpcName, DomainErrorCode>();
  const nowFn = options.now ?? (() => new Date('2026-09-22T15:00:00.000Z'));

  let actor: FakeActorContext = {
    ...DEFAULT_ACTOR,
    ...options.initialActor,
  };

  let offerSeq = 0;
  let dropSeq = 0;
  let incidentSeq = 0;

  const requests = new Map<string, FakeRequestRecord>();
  const offers = new Map<string, FakeOfferRecord>();
  const couriers = new Map<string, FakeCourierRecord>();
  const merchants = new Map<string, FakeMerchantRecord>();
  const documents = new Map<string, FakeDocumentRecord>();
  const incidents = new Map<string, FakeIncidentRecord>();
  const cancellationReasons: FakeCancellationReasonRecord[] = [];
  let cancellationReasonSeq = 0;
  const rateLimits = new Map<string, number>();
  const multiDropSnapshots = new Map<
    string,
    {
      readonly input: RpcInput<'create_and_publish_multi_drop'>;
      readonly publishedAt: string;
      readonly routeDistanceM: number | null;
    }
  >();
  const discountByOperation = new Map<string, number | null>();

  // ---------------------------------------------------------------------------
  // CC-029 (T-369): créditos de publicación y planes post-piloto. Réplica en memoria de la máquina de estados de
  // supabase/migrations/20261017090000_t369_publication_credits.sql. Con el piloto encendido no se crea ningún cargo.
  // ---------------------------------------------------------------------------
  const AR_OFFSET_MS = 3 * 3_600_000;
  const plans = new Map<string, FakePublicationPlanRecord>();
  const periods: FakePlanPeriodRecord[] = [];
  const lots: FakeCreditLotRecord[] = [];
  const charges: FakePublicationChargeRecord[] = [];
  const movements: FakeCreditMovementRecord[] = [];
  const launchDiscounts = new Map<string, number>();
  let creditSeq = 0;
  let movementSeq = 0;

  function nextCreditId(): string {
    creditSeq += 1;
    return `50000000-0000-4000-8000-${String(creditSeq).padStart(12, '0')}`;
  }

  function isoFromMs(ms: number): string {
    return new Date(ms).toISOString();
  }

  function argentinaDateString(ms: number): string {
    return new Date(ms - AR_OFFSET_MS).toISOString().slice(0, 10);
  }

  /** `(starts_at at time zone AR + interval '1 month') at time zone AR`, con el recorte de fin de mes de Postgres. */
  function addOneMonthArgentina(ms: number): number {
    const local = new Date(ms - AR_OFFSET_MS);
    const year = local.getUTCFullYear();
    const month = local.getUTCMonth() + 1;
    const targetYear = year + Math.floor(month / 12);
    const targetMonth = month % 12;
    const daysInTarget = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const day = Math.min(local.getUTCDate(), daysInTarget);
    return (
      Date.UTC(
        targetYear,
        targetMonth,
        day,
        local.getUTCHours(),
        local.getUTCMinutes(),
        local.getUTCSeconds(),
        local.getUTCMilliseconds()
      ) + AR_OFFSET_MS
    );
  }

  function legacyPaidActive(merchant: FakeMerchantRecord, ms: number): boolean {
    if (merchant.subscriptionStatus !== 'pilot' && merchant.subscriptionStatus !== 'active') return false;
    if (!merchant.paidUntil) return false;
    const [y, m, d] = merchant.paidUntil.slice(0, 10).split('-').map(Number);
    const lastDay = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + settings.subscriptionGraceDays));
    return lastDay.toISOString().slice(0, 10) >= argentinaDateString(ms);
  }

  /** Primer instante posterior a paid_until + gracia (23:59:59.999 de Argentina), o null sin derecho legacy. */
  function legacyEndMs(merchant: FakeMerchantRecord, paidUntil: string | null): number | null {
    if (merchant.subscriptionStatus !== 'pilot' && merchant.subscriptionStatus !== 'active') return null;
    if (!paidUntil) return null;
    const [y, m, d] = paidUntil.slice(0, 10).split('-').map(Number);
    return Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + settings.subscriptionGraceDays + 1) + AR_OFFSET_MS;
  }

  function lotUsed(lotId: string): number {
    let used = 0;
    for (const charge of charges) {
      if (charge.state === 'released') continue;
      for (const part of charge.parts) if (part.lotId === lotId) used += part.amount;
    }
    return used;
  }

  function lotUsable(lot: FakeCreditLotRecord, ms: number): boolean {
    if (lot.expiresAtMs !== null && lot.expiresAtMs <= ms) return false;
    if (lot.kind === 'loose') return true;
    const period = periods.find((p) => p.id === lot.periodId);
    return period !== undefined && period.startsAtMs <= ms;
  }

  function usableLots(merchantId: string, ms: number): Array<{ lot: FakeCreditLotRecord; available: number }> {
    return lots
      .filter((lot) => lot.merchantId === merchantId && lotUsable(lot, ms))
      .map((lot) => ({ lot, available: lot.granted - lotUsed(lot.id) }))
      .filter((entry) => entry.available > 0)
      .sort((a, b) => {
        const aLoose = a.lot.kind === 'loose' ? 1 : 0;
        const bLoose = b.lot.kind === 'loose' ? 1 : 0;
        if (aLoose !== bLoose) return aLoose - bLoose;
        const aExp = a.lot.expiresAtMs ?? Number.POSITIVE_INFINITY;
        const bExp = b.lot.expiresAtMs ?? Number.POSITIVE_INFINITY;
        if (aExp !== bExp) return aExp - bExp;
        return a.lot.createdSeq - b.lot.createdSeq;
      });
  }

  function lotUnusedAsOf(lot: FakeCreditLotRecord, cutoffMs: number): number {
    let net = 0;
    for (const movement of movements) {
      if (movement.lotId !== lot.id || movement.createdAtMs >= cutoffMs) continue;
      if (movement.kind === 'reserve') net += movement.amount;
      if (movement.kind === 'release') net -= movement.amount;
    }
    return Math.max(0, lot.granted - net);
  }

  function addMovement(movement: Omit<FakeCreditMovementRecord, 'id' | 'createdAtMs'>): void {
    movementSeq += 1;
    movements.push({ ...movement, id: movementSeq, createdAtMs: nowFn().getTime() });
  }

  function materializeCarryover(merchantId: string, ms: number): void {
    const pending = periods
      .filter((p) => p.merchantId === merchantId && p.startsAtMs <= ms && !p.carryoverMaterialized)
      .sort((a, b) => a.startsAtMs - b.startsAtMs);
    for (const period of pending) {
      let carry = 0;
      if (period.previousPeriodId !== null && period.carryoverPct > 0) {
        const previous = periods.find((p) => p.id === period.previousPeriodId);
        if (previous && previous.planKind === 'quota' && previous.monthlyCredits !== null) {
          const previousLot = lots.find((l) => l.periodId === previous.id && l.kind === 'plan');
          if (previousLot) {
            carry = Math.min(
              lotUnusedAsOf(previousLot, previous.endsAtMs),
              Math.floor((period.carryoverPct * previous.monthlyCredits) / 100)
            );
          }
        }
      }
      if (carry > 0 && !lots.some((l) => l.periodId === period.id && l.kind === 'carryover')) {
        creditSeq += 1;
        const lot: FakeCreditLotRecord = {
          id: nextCreditId(),
          merchantId,
          kind: 'carryover',
          periodId: period.id,
          granted: carry,
          expiresAtMs: period.endsAtMs,
          source: 'carryover',
          operationKey: null,
          refundChargeId: null,
          refundSourceLotId: null,
          note: null,
          createdSeq: creditSeq,
        };
        lots.push(lot);
        addMovement({ merchantId, lotId: lot.id, chargeId: null, requestId: null, kind: 'grant', amount: carry, actorId: null, reason: 'carryover' });
      }
      period.carryoverMaterialized = true;
    }
  }

  function currentCharge(requestId: string): FakePublicationChargeRecord | undefined {
    return charges.find((c) => c.requestId === requestId && c.isCurrent);
  }

  function snapshotCredits(): () => void {
    const savedLots = lots.map((l) => ({ ...l }));
    const savedCharges = charges.map((c) => ({ ...c, parts: c.parts.map((p) => ({ ...p })) }));
    const savedMovements = movements.slice();
    const savedPeriods = periods.map((p) => ({ ...p }));
    const savedSeq = { creditSeq, movementSeq };
    return () => {
      lots.splice(0, lots.length, ...savedLots);
      charges.splice(0, charges.length, ...savedCharges);
      movements.splice(0, movements.length, ...savedMovements);
      periods.splice(0, periods.length, ...savedPeriods);
      creditSeq = savedSeq.creditSeq;
      movementSeq = savedSeq.movementSeq;
    };
  }

  function releasePublication(requestId: string, actorId: string | null, reason: string): void {
    const charge = currentCharge(requestId);
    if (!charge) return;
    const ms = nowFn().getTime();
    for (const part of charge.parts) {
      addMovement({ merchantId: charge.merchantId, lotId: part.lotId, chargeId: charge.id, requestId, kind: 'release', amount: part.amount, actorId, reason });
      const lot = lots.find((l) => l.id === part.lotId);
      if (
        lot &&
        lot.expiresAtMs !== null &&
        lot.expiresAtMs <= ms &&
        !lots.some((l) => l.refundChargeId === charge.id && l.refundSourceLotId === lot.id)
      ) {
        creditSeq += 1;
        const refund: FakeCreditLotRecord = {
          id: nextCreditId(),
          merchantId: charge.merchantId,
          kind: 'loose',
          periodId: null,
          granted: part.amount,
          expiresAtMs: null,
          source: 'refund_conversion',
          operationKey: null,
          refundChargeId: charge.id,
          refundSourceLotId: lot.id,
          note: null,
          createdSeq: creditSeq,
        };
        lots.push(refund);
        addMovement({ merchantId: charge.merchantId, lotId: refund.id, chargeId: charge.id, requestId, kind: 'convert', amount: part.amount, actorId, reason });
      }
    }
    if (charge.mode !== 'credits') {
      addMovement({ merchantId: charge.merchantId, lotId: null, chargeId: charge.id, requestId, kind: 'release', amount: 0, actorId, reason });
    }
    charge.state = 'released';
    charge.isCurrent = false;
  }

  function consumePublication(requestId: string): void {
    const charge = currentCharge(requestId);
    if (!charge || charge.state !== 'reserved') return;
    charge.state = 'consumed';
    addMovement({ merchantId: charge.merchantId, lotId: null, chargeId: charge.id, requestId, kind: 'consume', amount: 0, actorId: actor.userId, reason: 'match' });
  }

  function unconsumePublication(requestId: string, reason: string): void {
    const charge = currentCharge(requestId);
    if (!charge || charge.state !== 'consumed') return;
    charge.state = 'reserved';
    addMovement({ merchantId: charge.merchantId, lotId: null, chargeId: charge.id, requestId, kind: 'unconsume', amount: 0, actorId: actor.userId, reason });
  }

  function retirePublicationCharge(requestId: string): void {
    const charge = currentCharge(requestId);
    if (!charge) return;
    if (charge.state === 'consumed') {
      charge.isCurrent = false;
    } else {
      releasePublication(requestId, actor.userId, 'republish');
    }
  }

  /** Reconciliación perezosa de las vencidas del comercio antes de reservar (CC-026 + CC-029). */
  function reconcileMerchantExpired(merchantId: string, now: Date): string[] {
    const expired: string[] = [];
    for (const request of requests.values()) {
      if (
        request.merchantId === merchantId &&
        request.status === 'published' &&
        request.acceptedOfferId === null &&
        isRequestExpired(request.status, request.expiresAt, now)
      ) {
        request.status = 'expired';
        expired.push(request.requestId);
      }
    }
    const expiredSet = new Set(expired);
    for (const offer of offers.values()) {
      if (expiredSet.has(offer.requestId) && offer.status === 'pending') offer.status = 'expired';
    }
    for (const requestId of expired) releasePublication(requestId, actor.userId, 'expired');
    return expired;
  }

  /** Elegibilidad por suscripción: con el piloto encendido, la regla de siempre; apagado, solo cancelled bloquea. */
  function publicationGate(
    merchant: FakeMerchantRecord,
    currentNow: Date
  ): ActionResult<true, DomainErrorCode> {
    if (settings.pilotActive) {
      return canMerchantPublishRequest({
        subscriptionStatus: merchant.subscriptionStatus,
        pilotActive: settings.pilotActive,
        paidUntil: merchant.paidUntil,
        graceDays: settings.subscriptionGraceDays,
        now: currentNow,
      });
    }
    return merchant.subscriptionStatus === 'cancelled' ? err('SUBSCRIPTION_INACTIVE') : ok(true);
  }

  function publicationCost(drops: number): number {
    return 1 + Math.max(0, drops - (settings.publicationDropsPerCredit ?? 2));
  }

  /** Reserva al publicar (D3/D5): legacy_paid → ilimitado vigente → créditos. Sin efecto con el piloto encendido. */
  function reservePublication(
    requestId: string,
    merchant: FakeMerchantRecord,
    drops: number,
    currentNow: Date
  ): ActionResult<true, 'PUBLICATION_CREDITS_EXHAUSTED'> {
    if (settings.pilotActive) return ok(true);
    const ms = currentNow.getTime();
    const current = currentCharge(requestId);
    if (current && current.state === 'reserved') return ok(true);
    const merchantId = merchant.merchantId;
    if (legacyPaidActive(merchant, ms)) {
      const charge: FakePublicationChargeRecord = { id: nextCreditId(), requestId, merchantId, mode: 'legacy_paid', cost: 0, state: 'reserved', isCurrent: true, periodId: null, parts: [] };
      charges.push(charge);
      addMovement({ merchantId, lotId: null, chargeId: charge.id, requestId, kind: 'reserve', amount: 0, actorId: actor.userId, reason: 'legacy_paid' });
      return ok(true);
    }
    const unlimited = periods
      .filter((p) => p.merchantId === merchantId && p.planKind === 'unlimited' && p.startsAtMs <= ms && ms < p.endsAtMs)
      .sort((a, b) => b.startsAtMs - a.startsAtMs)[0];
    if (unlimited) {
      const charge: FakePublicationChargeRecord = { id: nextCreditId(), requestId, merchantId, mode: 'unlimited', cost: 0, state: 'reserved', isCurrent: true, periodId: unlimited.id, parts: [] };
      charges.push(charge);
      addMovement({ merchantId, lotId: null, chargeId: charge.id, requestId, kind: 'reserve', amount: 0, actorId: actor.userId, reason: 'unlimited' });
      return ok(true);
    }
    materializeCarryover(merchantId, ms);
    const cost = publicationCost(drops);
    const usable = usableLots(merchantId, ms);
    const total = usable.reduce((sum, entry) => sum + entry.available, 0);
    if (total < cost) return err('PUBLICATION_CREDITS_EXHAUSTED');
    const charge: FakePublicationChargeRecord = { id: nextCreditId(), requestId, merchantId, mode: 'credits', cost, state: 'reserved', isCurrent: true, periodId: null, parts: [] };
    let remaining = cost;
    for (const entry of usable) {
      if (remaining === 0) break;
      const take = Math.min(remaining, entry.available);
      charge.parts.push({ lotId: entry.lot.id, amount: take });
      remaining -= take;
    }
    charges.push(charge);
    for (const part of charge.parts) {
      addMovement({ merchantId, lotId: part.lotId, chargeId: charge.id, requestId, kind: 'reserve', amount: part.amount, actorId: actor.userId, reason: 'publish' });
    }
    return ok(true);
  }

  function periodSummary(period: FakePlanPeriodRecord | undefined) {
    if (!period) return null;
    const plan = plans.get(period.planId);
    return {
      periodId: period.id,
      planId: period.planId,
      planName: plan?.name ?? period.planId,
      planKind: period.planKind,
      monthlyCredits: period.monthlyCredits,
      startsAt: isoFromMs(period.startsAtMs),
      endsAt: isoFromMs(period.endsAtMs),
      streak: period.streak,
      carryoverPct: period.carryoverPct,
    };
  }

  function publicationBalance(merchant: FakeMerchantRecord, currentNow: Date): PublicationBalance {
    const ms = currentNow.getTime();
    const merchantId = merchant.merchantId;
    materializeCarryover(merchantId, ms);
    const legacy = legacyPaidActive(merchant, ms);
    const unlimited = periods.some(
      (p) => p.merchantId === merchantId && p.planKind === 'unlimited' && p.startsAtMs <= ms && ms < p.endsAtMs
    );
    const available = usableLots(merchantId, ms).reduce((sum, entry) => sum + entry.available, 0);
    const reserved = charges
      .filter((c) => c.merchantId === merchantId && c.state === 'reserved')
      .reduce((sum, c) => sum + c.parts.reduce((s, p) => s + p.amount, 0), 0);
    const scheduled = lots
      .filter((l) => l.merchantId === merchantId && l.periodId !== null)
      .filter((l) => (periods.find((p) => p.id === l.periodId)?.startsAtMs ?? 0) > ms)
      .reduce((sum, l) => sum + l.granted, 0);
    let mode: PublicationBalance['mode'];
    let canPublish: boolean;
    if (settings.pilotActive) {
      mode = merchant.subscriptionStatus === 'pilot' ? 'pilot' : legacy ? 'legacy_paid' : 'credits';
      canPublish =
        merchant.subscriptionStatus !== 'expired' &&
        merchant.subscriptionStatus !== 'cancelled' &&
        (merchant.subscriptionStatus === 'pilot' || legacy);
    } else {
      mode = legacy ? 'legacy_paid' : unlimited ? 'unlimited' : 'credits';
      canPublish = merchant.subscriptionStatus !== 'cancelled' && (legacy || unlimited || available >= 1);
    }
    const merchantPeriods = periods.filter((p) => p.merchantId === merchantId);
    const current = merchantPeriods
      .filter((p) => p.startsAtMs <= ms && ms < p.endsAtMs)
      .sort((a, b) => b.startsAtMs - a.startsAtMs)[0];
    const next = merchantPeriods.filter((p) => p.startsAtMs > ms).sort((a, b) => a.startsAtMs - b.startsAtMs)[0];
    const lotSummaries = lots
      .filter((l) => l.merchantId === merchantId && (l.expiresAtMs === null || l.expiresAtMs > ms))
      .map((l) => ({ lot: l, available: l.granted - lotUsed(l.id) }))
      .filter((entry) => entry.available > 0)
      .sort((a, b) => {
        const aLoose = a.lot.kind === 'loose' ? 1 : 0;
        const bLoose = b.lot.kind === 'loose' ? 1 : 0;
        if (aLoose !== bLoose) return aLoose - bLoose;
        const aExp = a.lot.expiresAtMs ?? Number.POSITIVE_INFINITY;
        const bExp = b.lot.expiresAtMs ?? Number.POSITIVE_INFINITY;
        if (aExp !== bExp) return aExp - bExp;
        return a.lot.createdSeq - b.lot.createdSeq;
      })
      .map(({ lot, available: lotAvailable }) => {
        const period = periods.find((p) => p.id === lot.periodId);
        return {
          lotId: lot.id,
          kind: lot.kind,
          source: lot.source,
          granted: lot.granted,
          available: lotAvailable,
          startsAt: period ? isoFromMs(period.startsAtMs) : null,
          expiresAt: lot.expiresAtMs === null ? null : isoFromMs(lot.expiresAtMs),
          usable: lotUsable(lot, ms),
        };
      });
    return {
      merchantId,
      mode,
      canPublish,
      subscriptionStatus: merchant.subscriptionStatus,
      legacyPaidUntil: merchant.paidUntil ? merchant.paidUntil.slice(0, 10) : null,
      available,
      reserved,
      scheduled,
      currentPeriod: periodSummary(current),
      nextPeriod: periodSummary(next),
      lots: lotSummaries,
    };
  }

  /** D6 / 2-A: la primera compra consume el beneficio con el % vigente, aunque sea 0. */
  function applyLaunchDiscount(merchantId: string): number | null {
    if (launchDiscounts.has(merchantId)) return null;
    const pct = settings.launchDiscountPct ?? 0;
    launchDiscounts.set(merchantId, pct);
    return pct;
  }

  /**
   * H03: con un plan agendado al fin legacy (2-A), cambiar la gracia lo superpondría o dejaría un hueco. Se rechaza si
   * un comercio tiene derecho legacy relevante con la gracia vieja o la nueva y un período sin terminar.
   */
  function graceChangeConflicts(nextGraceDays: number): boolean {
    const ms = nowFn().getTime();
    const graceDays = Math.max(settings.subscriptionGraceDays, nextGraceDays);
    return [...merchants.values()].some((merchant) => {
      if (merchant.subscriptionStatus !== 'pilot' && merchant.subscriptionStatus !== 'active') return false;
      if (!merchant.paidUntil) return false;
      const [y, m, d] = merchant.paidUntil.slice(0, 10).split('-').map(Number);
      const endMs = Date.UTC(y ?? 0, (m ?? 1) - 1, (d ?? 1) + graceDays + 1) + AR_OFFSET_MS;
      return endMs > ms && periods.some((p) => p.merchantId === merchant.merchantId && p.endsAtMs > ms);
    });
  }

  /** Nota normalizada como la RPC: sin espacios alrededor y vacía = null. */
  function normalizeNote(note: string | null | undefined): string | null {
    const trimmed = note?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  }

  function getWindowBucketKey(subject: string, action: string, currentNow: Date): string {
    const minuteIso = new Date(Math.floor(currentNow.getTime() / 60_000) * 60_000).toISOString();
    return `${subject}:${action}:${minuteIso}`;
  }

  function getWindowRateCount(subject: string, action: string, currentNow: Date): number {
    return rateLimits.get(getWindowBucketKey(subject, action, currentNow)) ?? 0;
  }

  function incrementWindowRateCount(subject: string, action: string, currentNow: Date): number {
    const key = getWindowBucketKey(subject, action, currentNow);
    const next = (rateLimits.get(key) ?? 0) + 1;
    rateLimits.set(key, next);
    return next;
  }

  function consumeRequestRate(
    action: 'publish_request' | 'report_incident',
    limit: number,
    currentNow: Date
  ): ActionResult<true, 'RATE_LIMITED'> {
    if (getWindowRateCount(actor.userId, action, currentNow) >= limit) {
      return err('RATE_LIMITED');
    }
    incrementWindowRateCount(actor.userId, action, currentNow);
    return ok(true);
  }

  function nextUniqueOfferId(): string {
    while (true) {
      offerSeq += 1;
      const candidate = `00000000-0000-4000-8000-${String(offerSeq).padStart(12, '0')}`;
      if (!offers.has(candidate)) {
        return candidate;
      }
    }
  }

  function nextUniqueDropId(): string {
    while (true) {
      dropSeq += 1;
      const candidate = `40000000-0000-4000-8000-${String(dropSeq).padStart(12, '0')}`;
      const alreadyUsed = [...requests.values()].some((request) =>
        request.drops.some((drop) => drop.id === candidate)
      );
      if (!alreadyUsed) return candidate;
    }
  }

  function putRequest(r: FakeSeedRequest) {
    const drops: FakeDropRecord[] = (r.drops ?? []).map((d, index) => ({
      id: d.id ?? `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      requestId: r.requestId,
      position: d.position ?? index + 1,
      dropoffZoneId: d.dropoffZoneId ?? '00000000-0000-4000-8000-000000000099',
      dropoffZoneName: d.dropoffZoneName ?? 'Centro',
      dropoffAddress: d.dropoffAddress ?? 'Belgrano 1220',
      dropoffLat: d.dropoffLat ?? null,
      dropoffLng: d.dropoffLng ?? null,
      packageType: d.packageType ?? 'chico',
      recipientName: d.recipientName ?? 'Cliente',
      recipientPhone: d.recipientPhone ?? '3865123456',
      recipientConsentDeclared: d.recipientConsentDeclared ?? true,
      recipientPaymentMethod: d.recipientPaymentMethod ?? 'cash',
      needsChange: d.needsChange ?? false,
      cashChangeAmount: d.cashChangeAmount ?? null,
      notes: d.notes ?? null,
      approxDistanceM: d.approxDistanceM ?? null,
      status: d.status ?? 'pending',
      deliveredAt: d.deliveredAt ?? null,
      failedReason: d.failedReason ?? null,
    }));

    requests.set(r.requestId, {
      requestId: r.requestId,
      merchantId: r.merchantId,
      status: r.status,
      expiresAt: r.expiresAt ?? null,
      matchedAt: r.matchedAt ?? null,
      deliveredAt: r.deliveredAt ?? null,
      acceptedOfferId: r.acceptedOfferId ?? null,
      assignedCourierId: r.assignedCourierId ?? null,
      pickupLat: r.pickupLat ?? null,
      pickupLng: r.pickupLng ?? null,
      dropoffLat: r.dropoffLat ?? null,
      dropoffLng: r.dropoffLng ?? null,
      pickupZoneName: r.pickupZoneName ?? 'Centro',
      dropoffZoneName: r.dropoffZoneName ?? 'Villa Nueva',
      pickupAddress: r.pickupAddress ?? 'San Martín 450',
      dropoffAddress: r.dropoffAddress ?? 'Belgrano 1220',
      recipientName: r.recipientName ?? 'Cliente',
      recipientPhone: r.recipientPhone ?? '3865123456',
      recipientPaymentMethod: r.recipientPaymentMethod ?? 'cash',
      needsChange: r.needsChange ?? false,
      cashChangeAmount: r.cashChangeAmount ?? null,
      notes: r.notes ?? null,
      createdAt: r.createdAt ?? '2026-09-22T14:00:00.000Z',
      pickedUpAt: r.pickedUpAt ?? null,
      fixedPriceArs: r.fixedPriceArs ?? null,
      autoAssign: r.autoAssign ?? false,
      drops,
      dropsCount: r.dropsCount ?? (drops.length > 0 ? drops.length : 1),
    });
  }

  function putCourier(c: FakeSeedCourier) {
    const prev = couriers.get(c.courierId);
    couriers.set(c.courierId, {
      courierId: c.courierId,
      status: c.status,
      available: c.available,
      licenseStatus: c.licenseStatus ?? prev?.licenseStatus ?? 'none',
      insuranceStatus: c.insuranceStatus ?? prev?.insuranceStatus ?? 'none',
      displayName: c.displayName ?? prev?.displayName ?? 'Cadete',
      phone: c.phone ?? prev?.phone ?? '3865111111',
      // `null` es un valor explícito (onboarding incompleto); solo `undefined` toma el previo o el default.
      vehicleType: c.vehicleType === undefined ? (prev?.vehicleType ?? 'moto') : c.vehicleType,
      vehiclePlate: c.vehiclePlate ?? prev?.vehiclePlate ?? 'AA123BB',
    });
  }

  function putMerchant(m: FakeSeedMerchant) {
    const prev = merchants.get(m.merchantId);
    merchants.set(m.merchantId, {
      merchantId: m.merchantId,
      subscriptionStatus: m.subscriptionStatus,
      paidUntil: m.paidUntil ?? null,
      businessName: m.businessName ?? prev?.businessName ?? 'Comercio',
      phone: m.phone ?? prev?.phone ?? '3865222222',
      defaultPickupAddress: m.defaultPickupAddress ?? prev?.defaultPickupAddress ?? null,
      defaultPickupZoneId: m.defaultPickupZoneId ?? prev?.defaultPickupZoneId ?? null,
      defaultPickupLat: m.defaultPickupLat ?? prev?.defaultPickupLat ?? null,
      defaultPickupLng: m.defaultPickupLng ?? prev?.defaultPickupLng ?? null,
      notes: m.notes ?? prev?.notes ?? null,
    });
  }

  function putDocument(d: FakeSeedDocument) {
    const isCurrent = d.isCurrent !== false;
    if (isCurrent) {
      for (const existing of documents.values()) {
        if (existing.courierId === d.courierId && existing.kind === d.kind) {
          existing.isCurrent = false;
        }
      }
    }
    documents.set(d.documentId, {
      documentId: d.documentId,
      courierId: d.courierId,
      kind: d.kind,
      status: d.status,
      isCurrent,
      rejectionCode: d.rejectionCode ?? null,
      storagePath: d.storagePath ?? `courier/${d.courierId}/${d.kind}_default.jpg`,
      purgeAfter: d.purgeAfter ?? null,
      idempotencyKey: d.idempotencyKey ?? null,
    });
  }

  function putIncident(i: FakeSeedIncident) {
    incidents.set(i.incidentId, {
      incidentId: i.incidentId,
      requestId: i.requestId,
      reporterId: i.reporterId,
      reporterRole: i.reporterRole,
      reporterName: i.reporterName ?? '',
      kind: i.kind,
      description: i.description,
      status: i.status ?? 'open',
      resolution: i.resolution ?? null,
      createdAt: i.createdAt,
    });
  }

  function syncActorRecords(currentActor: FakeActorContext) {
    if (currentActor.role === 'courier') {
      putCourier({
        courierId: currentActor.userId,
        status: currentActor.courierStatus,
        available: currentActor.courierAvailable,
      });
    } else if (currentActor.role === 'merchant') {
      putMerchant({
        merchantId: currentActor.userId,
        subscriptionStatus: currentActor.merchantSubscriptionStatus,
        paidUntil: currentActor.merchantPaidUntil,
      });
    }
  }

  syncActorRecords(actor);
  (options.initialRequests ?? []).forEach(putRequest);
  (options.initialOffers ?? []).forEach((o) => offers.set(o.offerId, { ...o }));
  (options.initialCouriers ?? []).forEach(putCourier);
  (options.initialMerchants ?? []).forEach(putMerchant);
  (options.initialDocuments ?? []).forEach(putDocument);
  (options.initialIncidents ?? []).forEach(putIncident);
  (options.initialCancellationReasons ?? []).forEach((row) => cancellationReasons.push({ ...row }));

  function checkCourierEligibility(): ActionResult<
    FakeCourierRecord,
    'NOT_FOUND' | 'COURIER_SUSPENDED' | 'COURIER_NOT_APPROVED'
  > {
    const courier = couriers.get(actor.userId);
    if (!courier) return err('NOT_FOUND');
    if (courier.status === 'suspended') return err('COURIER_SUSPENDED');
    if (courier.status !== 'approved') return err('COURIER_NOT_APPROVED');
    return ok(courier);
  }

  async function executeRpc<K extends RpcName>(
    rpcName: K,
    rawInput: RpcInput<K>,
    requireAdminAal2: boolean,
    handler: (validInput: RpcInput<K>) => ActionResult<RpcOutput<K>, RpcErrorCode<K>>
  ): Promise<ActionResult<RpcOutput<K>, RpcErrorCode<K>>> {
    const forced = forcedErrors.get(rpcName);
    if (forced !== undefined) {
      forcedErrors.delete(rpcName);
      return err(forced as RpcErrorCode<K>);
    }
    if (!actor.userId || !actor.role) {
      return err('UNAUTHENTICATED' as RpcErrorCode<K>);
    }
    // CC-023 / CC-032: la RPC valida el id (y el cursor) antes del rol (misma precedencia que la función SQL).
    if (
      (rpcName === 'get_merchant_request_private_fields' ||
        rpcName === 'get_request_cancellation_history') &&
      !RPC_CONTRACTS[rpcName].inputSchema.safeParse(rawInput).success
    ) {
      return err('VALIDATION_ERROR' as RpcErrorCode<K>);
    }
    if (!ALLOWED_ROLES_BY_RPC[rpcName].includes(actor.role)) {
      return err('UNAUTHORIZED_ACTOR' as RpcErrorCode<K>);
    }
    // CC-007: RPC operativas de comercio/repartidor que exigen consentimiento activo antes de validar
    // parámetros. CC-012 conserva el gate en la función standalone `report_incident`. CC-021 lo extiende
    // a submit_offer y take_request.
    if (
      (rpcName === 'get_trip_details' ||
        rpcName === 'get_request_offer_couriers' ||
        rpcName === 'get_merchant_request_private_fields' ||
        rpcName === 'get_request_cancellation_history' ||
        rpcName === 'reconcile_expired_requests' ||
        rpcName === 'report_incident' ||
        rpcName === 'submit_offer' ||
        rpcName === 'take_request' ||
        rpcName === 'replace_courier_document') &&
      (actor.consentStatus ?? 'active') !== 'active'
    ) {
      return err('UNAUTHORIZED_ACTOR' as RpcErrorCode<K>);
    }
    if (requireAdminAal2 && actor.aal !== 'aal2') {
      return err('AAL2_REQUIRED' as RpcErrorCode<K>);
    }
    if (rpcName === 'admin_update_setting') {
      const candidate = rawInput as unknown as { readonly key?: unknown } | null;
      const rawKey = candidate && typeof candidate === 'object' ? candidate.key : undefined;
      if (
        typeof rawKey !== 'string' ||
        !PLATFORM_SETTING_KEYS.includes(rawKey as PlatformSettingKey)
      ) {
        return err('INVALID_SETTING_KEY' as RpcErrorCode<K>);
      }
      const settingParsed = RPC_CONTRACTS.admin_update_setting.inputSchema.safeParse(rawInput);
      if (!settingParsed.success) {
        return err('INVALID_SETTING_VALUE' as RpcErrorCode<K>);
      }
    }
    if (rpcName === 'submit_offer' || rpcName === 'take_request') {
      const courier = couriers.get(actor.userId);
      if (!courier) {
        return err('NOT_FOUND' as RpcErrorCode<K>);
      }
      const eligibility = canCourierSubmitOffer({
        status: courier.status,
        available: courier.available,
      });
      if (!eligibility.ok) {
        return err(eligibility.code as RpcErrorCode<K>);
      }
    }
    const parsed = RPC_CONTRACTS[rpcName].inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const firstMsg = parsed.error.issues[0]?.message;
      const mapped = isDomainErrorCode(firstMsg) ? firstMsg : 'VALIDATION_ERROR';
      return err(mapped as RpcErrorCode<K>);
    }
    const result = handler(parsed.data as RpcInput<K>);
    if (result.ok) {
      const output = options.invalidOutputFor === rpcName ? {} : result.data;
      const outParsed = RPC_CONTRACTS[rpcName].outputSchema.safeParse(output);
      if (!outParsed.success) {
        return err('VALIDATION_ERROR' as RpcErrorCode<K>);
      }
    }
    return result;
  }

  return {
    setForcedError(rpcName, code) {
      if (code === null) {
        forcedErrors.delete(rpcName);
        return;
      }
      const allowed = RPC_CONTRACTS[rpcName]?.errorCodes as readonly DomainErrorCode[] | undefined;
      if (!allowed || !allowed.includes(code)) {
        throw new Error(
          `Error code ${String(code)} is not in RPC_CONTRACTS.${String(rpcName)}.errorCodes`
        );
      }
      forcedErrors.set(rpcName, code);
    },

    setMinOfferArs(nextFloor) {
      if (!Number.isInteger(nextFloor) || nextFloor < 1) {
        throw new Error('minOfferArs must be a positive integer');
      }
      settings = { ...settings, minOfferArs: nextFloor };
    },

    setActor(patch) {
      actor = { ...actor, ...patch };
      syncActorRecords(actor);
    },

    seedRequest: putRequest,
    seedOffer: (o) => offers.set(o.offerId, { ...o }),
    seedCourier: putCourier,
    deleteCourier: (courierId) => {
      couriers.delete(courierId);
    },
    seedMerchant: putMerchant,
    deleteMerchant: (merchantId) => {
      merchants.delete(merchantId);
    },
    seedDocument: putDocument,
    getDocument: (documentId) => documents.get(documentId),
    seedIncident: putIncident,
    getIncident: (incidentId) => incidents.get(incidentId),
    seedCancellationReason: (row) => {
      cancellationReasons.push({ ...row });
    },
    getCancellationReasons: (requestId) =>
      cancellationReasons.filter((row) => row.requestId === requestId).map((row) => ({ ...row })),
    getRequest: (requestId) => requests.get(requestId),
    getPublicationCharges: (requestId) =>
      charges.filter((c) => c.requestId === requestId).map((c) => ({ ...c, parts: c.parts.map((p) => ({ ...p })) })),
    getOffer: (offerId) => offers.get(offerId),
    getCourier: (courierId) => couriers.get(courierId),
    getSettings: () => ({ ...settings }),
    triggerErrorCode: async (code) => err(code),

    update_my_merchant_profile: (rawInput) =>
      executeRpc('update_my_merchant_profile', rawInput, false, (input) => {
        const merchant = merchants.get(actor.userId);
        if (!merchant) {
          return err('NOT_FOUND');
        }

        if (input.businessName !== undefined) {
          merchant.businessName = input.businessName;
        }
        if (input.phone !== undefined) {
          merchant.phone = input.phone;
        }
        if (input.defaultPickupAddress !== undefined) {
          merchant.defaultPickupAddress = input.defaultPickupAddress;
        }
        if (input.defaultPickupZoneId !== undefined) {
          merchant.defaultPickupZoneId = input.defaultPickupZoneId;
        }
        if (input.defaultPickupLat !== undefined) {
          merchant.defaultPickupLat = input.defaultPickupLat;
        }
        if (input.defaultPickupLng !== undefined) {
          merchant.defaultPickupLng = input.defaultPickupLng;
        }
        if (input.notes !== undefined) {
          merchant.notes = input.notes;
        }

        return ok({
          profileId: merchant.merchantId,
          businessName: merchant.businessName,
          phone: merchant.phone ?? null,
          defaultPickupAddress: merchant.defaultPickupAddress ?? null,
          defaultPickupZoneId: merchant.defaultPickupZoneId ?? null,
          defaultPickupLat: merchant.defaultPickupLat ?? null,
          defaultPickupLng: merchant.defaultPickupLng ?? null,
          notes: merchant.notes ?? null,
        });
      }),

    reconcile_expired_requests: (rawInput) =>
      executeRpc('reconcile_expired_requests', rawInput, false, () => {
        const currentNow = nowFn();
        const eligible = [...requests.values()]
          .filter(
            (request) =>
              request.merchantId === actor.userId &&
              request.status === 'published' &&
              request.acceptedOfferId === null &&
              isRequestExpired(request.status, request.expiresAt, currentNow)
          )
          .sort((left, right) => {
            const leftExpiry = left.expiresAt ?? '';
            const rightExpiry = right.expiresAt ?? '';
            return leftExpiry.localeCompare(rightExpiry) || left.requestId.localeCompare(right.requestId);
          });
        const reconciled = eligible.slice(0, 50);
        const reconciledIds = new Set(reconciled.map((request) => request.requestId));

        for (const request of reconciled) {
          request.status = 'expired';
        }
        for (const offer of offers.values()) {
          if (reconciledIds.has(offer.requestId) && offer.status === 'pending') {
            offer.status = 'expired';
          }
        }

        for (const request of reconciled) {
          releasePublication(request.requestId, actor.userId, 'expired');
        }

        return ok({
          expiredRequestIds: reconciled.map((request) => request.requestId),
          expiredCount: reconciled.length,
          hasMore: eligible.length > reconciled.length,
        });
      }),

    create_and_publish_multi_drop: (rawInput) =>
      executeRpc('create_and_publish_multi_drop', rawInput, false, (input) => {
        const existing = requests.get(input.requestId);
        if (existing) {
          if (existing.merchantId !== actor.userId) return err('NOT_FOUND');

          const snapshot = multiDropSnapshots.get(input.requestId);
          if (!snapshot || JSON.stringify(snapshot.input) !== JSON.stringify(input)) {
            return err('VALIDATION_ERROR');
          }

          return ok({
            requestId: existing.requestId,
            status: existing.status,
            publishedAt: snapshot.publishedAt,
            expiresAt: existing.expiresAt ?? snapshot.publishedAt,
            routeDistanceM: snapshot.routeDistanceM,
            fixedPriceArs: existing.fixedPriceArs,
            autoAssign: existing.autoAssign,
            dropsCount: existing.dropsCount,
            idempotent: true,
          });
        }

        const currentNow = nowFn();
        const merchant = merchants.get(actor.userId);
        if (!merchant) return err('SUBSCRIPTION_INACTIVE');
        const subCheck = publicationGate(merchant, currentNow);
        if (!subCheck.ok) {
          return err(subCheck.code as RpcErrorCode<'create_and_publish_multi_drop'>);
        }

        const maxDrops = settings.maxDropsPerRequest ?? 5;
        if (input.drops.length > maxDrops) return err('DROP_LIMIT_EXCEEDED');
        if (input.fixedPriceArs !== null && input.fixedPriceArs < settings.minOfferArs) {
          return err('OFFER_BELOW_MINIMUM');
        }

        if (
          input.pickupLat !== null &&
          input.pickupLng !== null &&
          !isWithinAguilaresBounds(input.pickupLat, input.pickupLng)
        ) {
          return err('OUT_OF_BOUNDS_AGUILARES');
        }
        for (const drop of input.drops) {
          if (
            drop.dropoffLat !== null &&
            drop.dropoffLng !== null &&
            !isWithinAguilaresBounds(drop.dropoffLat, drop.dropoffLng)
          ) {
            return err('OUT_OF_BOUNDS_AGUILARES');
          }
        }

        // CC-029: reconciliar vencidas (piloto apagado) y reservar antes del tope por ventana, como request_cycle.
        if (!settings.pilotActive) reconcileMerchantExpired(actor.userId, currentNow);
        const restoreCredits = snapshotCredits();
        const reservation = reservePublication(input.requestId, merchant, input.drops.length, currentNow);
        if (!reservation.ok) return reservation;
        const rate = consumeRequestRate(
          'publish_request',
          settings.maxRequestPublicationsPerMin,
          currentNow
        );
        if (!rate.ok) {
          restoreCredits();
          return rate;
        }

        let currentLat = input.pickupLat;
        let currentLng = input.pickupLng;
        let routeDistanceM: number | null = null;
        let canCalculateRoute = currentLat !== null && currentLng !== null;
        let totalDistanceM = 0;
        const drops: FakeDropRecord[] = input.drops.map((drop, index) => {
          let approxDistanceM: number | null = null;
          if (
            canCalculateRoute &&
            currentLat !== null &&
            currentLng !== null &&
            drop.dropoffLat !== null &&
            drop.dropoffLng !== null
          ) {
            approxDistanceM = calculateHaversineRouteDistanceM(
              { lat: currentLat, lng: currentLng },
              { lat: drop.dropoffLat, lng: drop.dropoffLng }
            );
            totalDistanceM += approxDistanceM;
            currentLat = drop.dropoffLat;
            currentLng = drop.dropoffLng;
          } else {
            canCalculateRoute = false;
          }

          return {
            id: nextUniqueDropId(),
            requestId: input.requestId,
            position: index + 1,
            dropoffZoneId: drop.dropoffZoneId,
            dropoffZoneName: drop.dropoffZoneId,
            dropoffAddress: drop.dropoffAddress,
            dropoffLat: drop.dropoffLat,
            dropoffLng: drop.dropoffLng,
            packageType: drop.packageType,
            recipientName: drop.recipientName,
            recipientPhone: drop.recipientPhone,
            recipientConsentDeclared: drop.recipientConsentDeclared,
            recipientPaymentMethod: drop.recipientPaymentMethod,
            needsChange: drop.needsChange,
            cashChangeAmount: drop.cashChangeAmount,
            notes: drop.notes,
            approxDistanceM,
            status: 'pending',
            deliveredAt: null,
            failedReason: null,
          };
        });
        if (canCalculateRoute) routeDistanceM = totalDistanceM;

        const publishedAt = currentNow.toISOString();
        const expiresAt = new Date(
          currentNow.getTime() + settings.requestTtlMinutes * 60_000
        ).toISOString();
        requests.set(input.requestId, {
          requestId: input.requestId,
          merchantId: actor.userId,
          status: 'published',
          expiresAt,
          matchedAt: null,
          deliveredAt: null,
          acceptedOfferId: null,
          assignedCourierId: null,
          pickupLat: input.pickupLat,
          pickupLng: input.pickupLng,
          dropoffLat: null,
          dropoffLng: null,
          pickupZoneName: input.pickupZoneId,
          dropoffZoneName: '',
          pickupAddress: input.pickupAddress,
          dropoffAddress: '',
          recipientName: '',
          recipientPhone: '',
          recipientPaymentMethod: null,
          needsChange: false,
          cashChangeAmount: null,
          notes: null,
          createdAt: publishedAt,
          pickedUpAt: null,
          fixedPriceArs: input.fixedPriceArs,
          autoAssign: input.autoAssign,
          drops,
          dropsCount: drops.length,
        });
        multiDropSnapshots.set(input.requestId, {
          input,
          publishedAt,
          routeDistanceM,
        });

        return ok({
          requestId: input.requestId,
          status: 'published',
          publishedAt,
          expiresAt,
          routeDistanceM,
          fixedPriceArs: input.fixedPriceArs,
          autoAssign: input.autoAssign,
          dropsCount: drops.length,
          idempotent: false,
        });
      }),

    publish_request: (rawInput) =>
      executeRpc('publish_request', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        if (req.merchantId !== actor.userId) return err('UNAUTHORIZED_ACTOR');

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(req.status, req.expiresAt, currentNow);
        if (effectiveStatus !== 'draft') {
          return err('INVALID_STATE_TRANSITION');
        }

        const merchant = merchants.get(actor.userId);
        if (!merchant) return err('SUBSCRIPTION_INACTIVE');
        const subCheck = publicationGate(merchant, currentNow);
        if (!subCheck.ok) {
          return err(subCheck.code as RpcErrorCode<'publish_request'>);
        }

        // 1. Legacy bridge si la solicitud tiene 0 drops
        if (req.drops.length === 0) {
          if (
            !req.dropoffAddress ||
            !req.dropoffZoneName ||
            !req.recipientName ||
            !req.recipientPhone
          ) {
            return err('MISSING_REQUIRED_FIELDS');
          }

          const recipientPaymentMethod = req.recipientPaymentMethod ?? 'cash';
          if (recipientPaymentMethod === 'cash') {
            if (req.needsChange && (!req.cashChangeAmount || req.cashChangeAmount <= 0)) {
              return err('VALIDATION_ERROR');
            }
          }

          const drop1: FakeDropRecord = {
            id: `40000000-0000-4000-8000-${String(1).padStart(12, '0')}`,
            requestId: req.requestId,
            position: 1,
            dropoffZoneId: '00000000-0000-4000-8000-000000000099',
            dropoffZoneName: req.dropoffZoneName,
            dropoffAddress: req.dropoffAddress,
            dropoffLat: req.dropoffLat,
            dropoffLng: req.dropoffLng,
            packageType: 'chico',
            recipientName: req.recipientName,
            recipientPhone: req.recipientPhone,
            recipientConsentDeclared: true,
            recipientPaymentMethod,
            needsChange: recipientPaymentMethod === 'cash' ? req.needsChange : false,
            cashChangeAmount:
              recipientPaymentMethod === 'cash' && req.needsChange
                ? req.cashChangeAmount
                : null,
            notes: req.notes,
            approxDistanceM: null,
            status: 'pending',
            deliveredAt: null,
            failedReason: null,
          };
          req.drops = [drop1];
          req.dropsCount = 1;
        }

        if (req.drops.length === 0) {
          return err('MISSING_REQUIRED_FIELDS');
        }

        const maxDrops = settings.maxDropsPerRequest ?? 5;
        if (req.drops.length > maxDrops) {
          return err('DROP_LIMIT_EXCEEDED');
        }

        // Posiciones consecutivas desde 1
        const positions = req.drops.map((d) => d.position).sort((a, b) => a - b);
        const consecutive = positions.every((pos, idx) => pos === idx + 1);
        if (!consecutive) {
          return err('VALIDATION_ERROR');
        }

        // Validación de cada drop
        for (const drop of req.drops) {
          if (!drop.dropoffAddress || !drop.recipientName || !drop.recipientPhone) {
            return err('MISSING_REQUIRED_FIELDS');
          }
          if (drop.dropoffLat !== null && drop.dropoffLng !== null) {
            if (!isWithinAguilaresBounds(drop.dropoffLat, drop.dropoffLng)) {
              return err('OUT_OF_BOUNDS_AGUILARES');
            }
          }
          if (drop.recipientPaymentMethod !== 'cash' && drop.needsChange) {
            return err('VALIDATION_ERROR');
          }
          if (drop.recipientPaymentMethod === 'cash' && drop.needsChange) {
            if (drop.cashChangeAmount === null || drop.cashChangeAmount <= 0) {
              return err('VALIDATION_ERROR');
            }
          } else {
            if (drop.cashChangeAmount !== null) {
              return err('VALIDATION_ERROR');
            }
          }
        }

        if (req.pickupLat !== null && req.pickupLng !== null) {
          if (!isWithinAguilaresBounds(req.pickupLat, req.pickupLng)) {
            return err('OUT_OF_BOUNDS_AGUILARES');
          }
        }

        let routeDistanceM: number | null = null;
        if (req.drops.length === 1) {
          const drop = req.drops[0]!;
          if (
            req.pickupLat !== null &&
            req.pickupLng !== null &&
            drop.dropoffLat !== null &&
            drop.dropoffLng !== null
          ) {
            routeDistanceM = calculateHaversineRouteDistanceM(
              { lat: req.pickupLat, lng: req.pickupLng },
              { lat: drop.dropoffLat, lng: drop.dropoffLng }
            );
          }
        } else {
          let currentLat = req.pickupLat;
          let currentLng = req.pickupLng;
          let totalDist = 0;
          let canCalculateTotal = currentLat !== null && currentLng !== null;

          const sortedDrops = [...req.drops].sort((a, b) => a.position - b.position);
          for (const drop of sortedDrops) {
            if (
              canCalculateTotal &&
              currentLat !== null &&
              currentLng !== null &&
              drop.dropoffLat !== null &&
              drop.dropoffLng !== null
            ) {
              const segDist = calculateHaversineRouteDistanceM(
                { lat: currentLat, lng: currentLng },
                { lat: drop.dropoffLat, lng: drop.dropoffLng }
              );
              drop.approxDistanceM = segDist;
              totalDist += segDist;
              currentLat = drop.dropoffLat;
              currentLng = drop.dropoffLng;
            } else {
              canCalculateTotal = false;
              drop.approxDistanceM = null;
            }
          }
          routeDistanceM = canCalculateTotal ? totalDist : null;
        }

        req.dropsCount = req.drops.length;

        if (
          req.fixedPriceArs !== null &&
          req.fixedPriceArs !== undefined &&
          req.fixedPriceArs < settings.minOfferArs
        ) {
          return err('OFFER_BELOW_MINIMUM');
        }

        // CC-029: reserva antes del tope por ventana, como request_cycle.
        if (!settings.pilotActive) reconcileMerchantExpired(actor.userId, currentNow);
        const restoreCredits = snapshotCredits();
        const reservation = reservePublication(req.requestId, merchant, Math.max(1, req.dropsCount), currentNow);
        if (!reservation.ok) return reservation;
        const rate = consumeRequestRate(
          'publish_request',
          settings.maxRequestPublicationsPerMin,
          currentNow
        );
        if (!rate.ok) {
          restoreCredits();
          return rate;
        }
        const publishedAt = currentNow.toISOString();
        const expiresAt = new Date(
          currentNow.getTime() + settings.requestTtlMinutes * 60_000
        ).toISOString();
        req.status = 'published';
        req.expiresAt = expiresAt;

        return ok({
          requestId: input.requestId,
          status: 'published',
          publishedAt,
          expiresAt,
          routeDistanceM,
          fixedPriceArs: req.fixedPriceArs ?? null,
          autoAssign: req.autoAssign ?? false,
          dropsCount: req.dropsCount,
        });
      }),

    cancel_request: (rawInput) =>
      executeRpc('cancel_request', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        if (actor.role === 'merchant' && req.merchantId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        const currentNow = nowFn();
        if (req.status === 'published' && isRequestExpired(req.status, req.expiresAt, currentNow)) {
          return err('REQUEST_EXPIRED');
        }
        const effectiveStatus = getEffectiveRequestStatus(req.status, req.expiresAt, currentNow);
        const validForActor =
          (actor.role === 'merchant' &&
            (effectiveStatus === 'published' || effectiveStatus === 'matched')) ||
          (actor.role === 'admin' && effectiveStatus === 'in_transit');
        if (!validForActor) {
          return err('INVALID_STATE_TRANSITION');
        }
        if (actor.role === 'admin' && actor.aal !== 'aal2') {
          return err('AAL2_REQUIRED');
        }
        if (
          (effectiveStatus === 'matched' || effectiveStatus === 'in_transit') &&
          (!input.reason || input.reason.trim().length === 0)
        ) {
          return err('REASON_REQUIRED');
        }

        if (actor.role === 'admin' && effectiveStatus === 'in_transit') {
          const hasIncident = Array.from(incidents.values()).some(
            (i) => i.requestId === req.requestId
          );
          if (!hasIncident) {
            return err('INVALID_STATE_TRANSITION');
          }
        }

        if (effectiveStatus === 'published') {
          for (const offer of offers.values()) {
            if (offer.requestId === req.requestId && offer.status === 'pending') {
              offer.status = 'expired';
            }
          }
        } else if (req.acceptedOfferId) {
          const accepted = offers.get(req.acceptedOfferId);
          if (accepted) accepted.status = 'cancelled';
        }

        if (req.status === 'published') releasePublication(req.requestId, actor.userId, 'cancel_request');
        req.status = 'cancelled';
        return ok({
          requestId: input.requestId,
          status: 'cancelled',
          cancelledAt: currentNow.toISOString(),
        });
      }),

    submit_offer: (rawInput) =>
      executeRpc('submit_offer', rawInput, false, (input) => {
        const floorCheck = validateOfferAmountAgainstFloor(input.amountArs, settings.minOfferArs);
        if (!floorCheck.ok) {
          return err(floorCheck.code as RpcErrorCode<'submit_offer'>);
        }

        const currentNow = nowFn();

        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');

        if (isRequestExpired(req.status, req.expiresAt, currentNow)) {
          return err('REQUEST_EXPIRED');
        }
        if (req.status !== 'published') {
          return err('INVALID_STATE_TRANSITION');
        }

        if (req.fixedPriceArs !== null && req.fixedPriceArs !== undefined) {
          return err('FIXED_PRICE_REQUEST');
        }

        for (const existing of offers.values()) {
          if (
            existing.requestId === input.requestId &&
            existing.courierId === actor.userId &&
            (existing.status === 'pending' || existing.status === 'accepted')
          ) {
            return err('DUPLICATE_ACTIVE_OFFER');
          }
        }

        const courier = couriers.get(actor.userId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status === 'suspended') return err('COURIER_SUSPENDED');
        if (courier.status !== 'approved') return err('COURIER_NOT_APPROVED');
        if (!courier.available) return err('COURIER_UNAVAILABLE');

        if (
          getWindowRateCount(actor.userId, 'submit_offer', currentNow) + 1 >
          settings.maxOffersPerMin
        ) {
          return err('RATE_LIMITED');
        }

        incrementWindowRateCount(actor.userId, 'submit_offer', currentNow);

        const offerId = nextUniqueOfferId();
        offers.set(offerId, {
          offerId,
          requestId: input.requestId,
          courierId: actor.userId,
          amountArs: input.amountArs,
          status: 'pending',
        });

        return ok({
          offerId,
          requestId: input.requestId,
          status: 'pending',
          amountArs: input.amountArs,
          totalAmountArs: input.amountArs * (req.dropsCount ?? 1),
          createdAt: currentNow.toISOString(),
        });
      }),

    take_request: (rawInput) =>
      executeRpc('take_request', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');

        const currentNow = nowFn();

        // 5. Idempotencia (§5)
        if (req.fixedPriceArs !== null && req.fixedPriceArs !== undefined) {
          if (req.status === 'matched') {
            const acceptedOffer = req.acceptedOfferId ? offers.get(req.acceptedOfferId) : null;
            if (acceptedOffer && acceptedOffer.courierId === actor.userId) {
              return ok({
                offerId: acceptedOffer.offerId,
                requestId: req.requestId,
                amountArs: req.fixedPriceArs,
                totalAmountArs: req.fixedPriceArs * (req.dropsCount ?? 1),
                offerStatus: 'accepted' as const,
                requestStatus: 'matched' as const,
                matchedAt: req.matchedAt,
                idempotent: true,
              });
            }
          } else if (req.status === 'published') {
            for (const existing of offers.values()) {
              if (
                existing.requestId === req.requestId &&
                existing.courierId === actor.userId &&
                existing.status === 'pending'
              ) {
                return ok({
                  offerId: existing.offerId,
                  requestId: req.requestId,
                  amountArs: req.fixedPriceArs,
                  totalAmountArs: req.fixedPriceArs * (req.dropsCount ?? 1),
                  offerStatus: 'pending' as const,
                  requestStatus: 'published' as const,
                  matchedAt: null,
                  idempotent: true,
                });
              }
            }
          }
        } else {
          if (req.status === 'matched') {
            const acceptedOffer = req.acceptedOfferId ? offers.get(req.acceptedOfferId) : null;
            if (acceptedOffer && acceptedOffer.courierId === actor.userId) {
              return err('NO_FIXED_PRICE');
            }
          } else if (req.status === 'published') {
            for (const existing of offers.values()) {
              if (
                existing.requestId === req.requestId &&
                existing.courierId === actor.userId &&
                existing.status === 'pending'
              ) {
                return err('NO_FIXED_PRICE');
              }
            }
          }
        }

        // 6. Estado de la solicitud
        if (req.status === 'matched') {
          return err('ALREADY_MATCHED');
        }
        if (isRequestExpired(req.status, req.expiresAt, currentNow)) {
          return err('REQUEST_EXPIRED');
        }
        if (req.status !== 'published') {
          return err('INVALID_STATE_TRANSITION');
        }

        // 7. Sin precio fijo
        if (req.fixedPriceArs === null || req.fixedPriceArs === undefined) {
          return err('NO_FIXED_PRICE');
        }

        // 8. Piso vigente
        if (req.fixedPriceArs < settings.minOfferArs) {
          return err('OFFER_BELOW_MINIMUM');
        }

        // 9. Oferta activa duplicada
        for (const existing of offers.values()) {
          if (
            existing.requestId === input.requestId &&
            existing.courierId === actor.userId &&
            (existing.status === 'pending' || existing.status === 'accepted')
          ) {
            return err('DUPLICATE_ACTIVE_OFFER');
          }
        }

        // 10. Lock del repartidor y nueva validación
        const courier = couriers.get(actor.userId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status === 'suspended') return err('COURIER_SUSPENDED');
        if (courier.status !== 'approved') return err('COURIER_NOT_APPROVED');
        if (!courier.available) return err('COURIER_UNAVAILABLE');

        // 11. Rate limit (comparte ventana con submit_offer)
        if (
          getWindowRateCount(actor.userId, 'submit_offer', currentNow) + 1 >
          settings.maxOffersPerMin
        ) {
          return err('RATE_LIMITED');
        }

        incrementWindowRateCount(actor.userId, 'submit_offer', currentNow);

        // 12. Mutación
        const offerId = nextUniqueOfferId();
        const amountArs = req.fixedPriceArs;

        if (req.autoAssign) {
          offers.set(offerId, {
            offerId,
            requestId: input.requestId,
            courierId: actor.userId,
            amountArs,
            status: 'accepted',
          });
          for (const sibling of offers.values()) {
            if (
              sibling.requestId === req.requestId &&
              sibling.offerId !== offerId &&
              sibling.status === 'pending'
            ) {
              sibling.status = 'rejected';
            }
          }
          const matchedAt = currentNow.toISOString();
          req.status = 'matched';
          req.acceptedOfferId = offerId;
          consumePublication(req.requestId);
          req.assignedCourierId = actor.userId;
          req.matchedAt = matchedAt;

          return ok({
            offerId,
            requestId: input.requestId,
            amountArs,
            totalAmountArs: amountArs * (req.dropsCount ?? 1),
            offerStatus: 'accepted' as const,
            requestStatus: 'matched' as const,
            matchedAt,
            idempotent: false,
          });
        }

        offers.set(offerId, {
          offerId,
          requestId: input.requestId,
          courierId: actor.userId,
          amountArs,
          status: 'pending',
        });

        return ok({
          offerId,
          requestId: input.requestId,
          amountArs,
          totalAmountArs: amountArs * (req.dropsCount ?? 1),
          offerStatus: 'pending' as const,
          requestStatus: 'published' as const,
          matchedAt: null,
          idempotent: false,
        });
      }),

    withdraw_offer: (rawInput) =>
      executeRpc('withdraw_offer', rawInput, false, (input) => {
        const offer = offers.get(input.offerId);
        if (!offer) return err('NOT_FOUND');
        if (offer.courierId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }
        const transition = transitionOffer(offer.status, 'withdrawn', 'courier');
        if (!transition.ok) return err('OFFER_NOT_PENDING');

        const currentNow = nowFn();
        if (
          getWindowRateCount(actor.userId, 'withdraw_offer', currentNow) + 1 >
          settings.maxOffersPerMin
        ) {
          return err('RATE_LIMITED');
        }

        incrementWindowRateCount(actor.userId, 'withdraw_offer', currentNow);
        offer.status = 'withdrawn';
        return ok({
          offerId: input.offerId,
          status: 'withdrawn',
          decidedAt: currentNow.toISOString(),
        });
      }),

    accept_offer: (rawInput) =>
      executeRpc('accept_offer', rawInput, false, (input) => {
        const offer = offers.get(input.offerId);
        if (!offer) return err('NOT_FOUND');

        const req = requests.get(offer.requestId);
        const offerCourier = couriers.get(offer.courierId);
        if (!req || !offerCourier) return err('NOT_FOUND');

        if (req.merchantId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        const currentNow = nowFn();
        if (req.status === 'matched' && req.acceptedOfferId === input.offerId) {
          return ok({
            requestId: offer.requestId,
            acceptedOfferId: input.offerId,
            status: 'matched',
            matchedAt: req.matchedAt ?? currentNow.toISOString(),
            idempotent: true,
            totalAmountArs: offer.amountArs * (req.dropsCount ?? 1),
          });
        }
        if (req.status === 'matched') {
          return err('ALREADY_MATCHED');
        }
        if (isRequestExpired(req.status, req.expiresAt, currentNow)) {
          return err('REQUEST_EXPIRED');
        }
        if (req.status !== 'published') {
          return err('INVALID_STATE_TRANSITION');
        }
        if (offer.status !== 'pending') {
          return err('OFFER_NOT_PENDING');
        }

        const courierCheck = canCourierBeAccepted({ status: offerCourier.status });
        if (!courierCheck.ok) {
          return err(courierCheck.code as RpcErrorCode<'accept_offer'>);
        }

        const matchedIso = currentNow.toISOString();
        offer.status = 'accepted';
        for (const sibling of offers.values()) {
          if (
            sibling.requestId === offer.requestId &&
            sibling.offerId !== offer.offerId &&
            sibling.status === 'pending'
          ) {
            sibling.status = 'rejected';
          }
        }

        req.status = 'matched';
        req.acceptedOfferId = input.offerId;
        consumePublication(req.requestId);
        req.assignedCourierId = offer.courierId;
        req.matchedAt = matchedIso;

        return ok({
          requestId: offer.requestId,
          acceptedOfferId: input.offerId,
          status: 'matched',
          matchedAt: matchedIso,
          idempotent: false,
          totalAmountArs: offer.amountArs * (req.dropsCount ?? 1),
        });
      }),

    mark_picked_up: (rawInput) =>
      executeRpc('mark_picked_up', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        const eligibility = checkCourierEligibility();
        if (!eligibility.ok) return eligibility;
        if (req.assignedCourierId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(req.status, req.expiresAt, currentNow);
        if (effectiveStatus !== 'matched') {
          return err('INVALID_STATE_TRANSITION');
        }

        req.status = 'in_transit';
        return ok({
          requestId: input.requestId,
          status: 'in_transit',
          pickedUpAt: currentNow.toISOString(),
        });
      }),

    mark_delivered: (rawInput) =>
      executeRpc('mark_delivered', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        const eligibility = checkCourierEligibility();
        if (!eligibility.ok) return eligibility;
        if (req.assignedCourierId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        if (req.dropsCount > 1 || req.drops.length > 1) {
          return err('INVALID_STATE_TRANSITION');
        }

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(req.status, req.expiresAt, currentNow);
        if (effectiveStatus !== 'in_transit') {
          return err('INVALID_STATE_TRANSITION');
        }

        const deliveredAt = currentNow.toISOString();
        req.status = 'delivered';
        req.deliveredAt = deliveredAt;
        if (req.drops[0]) {
          req.drops[0].status = 'delivered';
          req.drops[0].deliveredAt = deliveredAt;
        }
        return ok({
          requestId: input.requestId,
          status: 'delivered',
          deliveredAt,
        });
      }),

    mark_drop_delivered: (rawInput) =>
      executeRpc('mark_drop_delivered', rawInput, false, (input) => {
        const eligibility = checkCourierEligibility();
        if (!eligibility.ok) return eligibility;

        let targetReq: FakeRequestRecord | undefined;
        let targetDrop: FakeDropRecord | undefined;

        for (const r of requests.values()) {
          const d = r.drops.find((drop) => drop.id === input.dropId);
          if (d) {
            targetReq = r;
            targetDrop = d;
            break;
          }
        }

        if (!targetReq || !targetDrop) return err('NOT_FOUND');
        if (targetReq.assignedCourierId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        if (targetDrop.status === 'delivered') {
          return ok({
            dropId: input.dropId,
            requestId: targetReq.requestId,
            status: 'delivered',
            requestStatus: targetReq.status,
            deliveredAt: targetDrop.deliveredAt ?? nowFn().toISOString(),
            idempotent: true,
          });
        }

        if (targetDrop.status === 'failed') {
          return err('INVALID_STATE_TRANSITION');
        }

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(
          targetReq.status,
          targetReq.expiresAt,
          currentNow
        );
        if (effectiveStatus !== 'in_transit') {
          return err('INVALID_STATE_TRANSITION');
        }
        if (targetDrop.status !== 'pending') {
          return err('INVALID_STATE_TRANSITION');
        }

        const deliveredAt = currentNow.toISOString();
        targetDrop.status = 'delivered';
        targetDrop.deliveredAt = deliveredAt;

        const anyPending = targetReq.drops.some((d) => d.status === 'pending');
        if (!anyPending) {
          targetReq.status = 'delivered';
          targetReq.deliveredAt = deliveredAt;
        }

        return ok({
          dropId: input.dropId,
          requestId: targetReq.requestId,
          status: 'delivered',
          requestStatus: targetReq.status,
          deliveredAt,
          idempotent: false,
        });
      }),

    mark_drop_failed: (rawInput) =>
      executeRpc('mark_drop_failed', rawInput, false, (input) => {
        if (!input.reason || input.reason.trim().length === 0) {
          return err('REASON_REQUIRED');
        }

        const eligibility = checkCourierEligibility();
        if (!eligibility.ok) return eligibility;

        let targetReq: FakeRequestRecord | undefined;
        let targetDrop: FakeDropRecord | undefined;

        for (const r of requests.values()) {
          const d = r.drops.find((drop) => drop.id === input.dropId);
          if (d) {
            targetReq = r;
            targetDrop = d;
            break;
          }
        }

        if (!targetReq || !targetDrop) return err('NOT_FOUND');
        if (targetReq.assignedCourierId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        if (targetDrop.status === 'failed') {
          return ok({
            dropId: input.dropId,
            requestId: targetReq.requestId,
            status: 'failed',
            requestStatus: targetReq.status,
            failedReason: targetDrop.failedReason ?? input.reason,
            idempotent: true,
          });
        }

        if (targetDrop.status === 'delivered') {
          return err('INVALID_STATE_TRANSITION');
        }

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(
          targetReq.status,
          targetReq.expiresAt,
          currentNow
        );
        if (effectiveStatus !== 'in_transit') {
          return err('INVALID_STATE_TRANSITION');
        }
        if (targetDrop.status !== 'pending') {
          return err('INVALID_STATE_TRANSITION');
        }

        targetDrop.status = 'failed';
        targetDrop.failedReason = input.reason;

        const anyPending = targetReq.drops.some((d) => d.status === 'pending');
        if (!anyPending) {
          targetReq.status = 'delivered';
          targetReq.deliveredAt = currentNow.toISOString();
        }

        return ok({
          dropId: input.dropId,
          requestId: targetReq.requestId,
          status: 'failed',
          requestStatus: targetReq.status,
          failedReason: input.reason,
          idempotent: false,
        });
      }),

    report_no_show: (rawInput) =>
      executeRpc('report_no_show', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        if (req.merchantId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(req.status, req.expiresAt, currentNow);
        if (effectiveStatus !== 'matched') {
          return err('INVALID_STATE_TRANSITION');
        }

        const cancelledOfferId = req.acceptedOfferId;
        const acceptedOffer = cancelledOfferId ? offers.get(cancelledOfferId) : undefined;
        if (!cancelledOfferId || !acceptedOffer || acceptedOffer.status !== 'accepted') {
          return err('INVALID_STATE_TRANSITION');
        }

        const nextStatus = input.republish === false ? 'cancelled' : 'published';
        if (nextStatus === 'published') {
          const merchant = merchants.get(actor.userId);
          if (!merchant) return err('SUBSCRIPTION_INACTIVE');
          const subCheck = publicationGate(merchant, currentNow);
          if (!subCheck.ok) {
            return err(subCheck.code as RpcErrorCode<'report_no_show'>);
          }
        }

        acceptedOffer.status = 'cancelled';
        const expiresAt =
          nextStatus === 'published'
            ? new Date(currentNow.getTime() + settings.requestTtlMinutes * 60_000).toISOString()
            : null;

        if (nextStatus === 'cancelled') {
          releasePublication(req.requestId, actor.userId, 'report_no_show');
        } else {
          unconsumePublication(req.requestId, 'report_no_show');
        }
        req.status = nextStatus;
        req.acceptedOfferId = null;
        req.assignedCourierId = null;
        req.expiresAt = expiresAt;

        return ok({
          requestId: input.requestId,
          status: nextStatus,
          cancelledOfferId,
          expiresAt,
        });
      }),

    courier_cancel_match: (rawInput) =>
      executeRpc('courier_cancel_match', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        const eligibility = checkCourierEligibility();
        if (!eligibility.ok) return eligibility;
        if (req.assignedCourierId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(req.status, req.expiresAt, currentNow);
        if (effectiveStatus !== 'matched') {
          return err('INVALID_STATE_TRANSITION');
        }

        const cancelledOfferId = req.acceptedOfferId;
        const acceptedOffer = cancelledOfferId ? offers.get(cancelledOfferId) : undefined;
        if (!cancelledOfferId || !acceptedOffer || acceptedOffer.status !== 'accepted') {
          return err('INVALID_STATE_TRANSITION');
        }
        acceptedOffer.status = 'cancelled';

        // Misma fila que inserta app_private.request_cycle en request_cancellation_reasons (CC-032 la proyecta).
        cancellationReasonSeq += 1;
        cancellationReasons.push({
          id: `32000000-0000-4000-8000-${String(cancellationReasonSeq).padStart(12, '0')}`,
          requestId: req.requestId,
          offerId: cancelledOfferId,
          actorId: actor.userId,
          action: 'courier_cancel_match',
          reason: input.reason.trim(),
          createdAt: currentNow.toISOString(),
        });

        const expiresAt = new Date(
          currentNow.getTime() + settings.requestTtlMinutes * 60_000
        ).toISOString();
        unconsumePublication(req.requestId, 'courier_cancel_match');
        req.status = 'published';
        req.acceptedOfferId = null;
        req.assignedCourierId = null;
        req.expiresAt = expiresAt;

        return ok({
          requestId: input.requestId,
          status: 'published',
          cancelledOfferId,
          expiresAt,
        });
      }),

    republish_request: (rawInput) =>
      executeRpc('republish_request', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        if (req.merchantId !== actor.userId) {
          return err('UNAUTHORIZED_ACTOR');
        }

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(req.status, req.expiresAt, currentNow);
        if (
          effectiveStatus !== 'matched' &&
          effectiveStatus !== 'expired' &&
          effectiveStatus !== 'cancelled'
        ) {
          return err('INVALID_STATE_TRANSITION');
        }
        if (effectiveStatus === 'matched' && (!input.reason || input.reason.trim().length === 0)) {
          return err('REASON_REQUIRED');
        }

        const merchant = merchants.get(actor.userId);
        if (!merchant) return err('SUBSCRIPTION_INACTIVE');
        const subCheck = publicationGate(merchant, currentNow);
        if (!subCheck.ok) {
          return err(subCheck.code as RpcErrorCode<'republish_request'>);
        }

        // CC-029: retirar el cargo corriente (consumido → histórico; reservado → liberado) y reservar uno nuevo.
        if (!settings.pilotActive) reconcileMerchantExpired(actor.userId, currentNow);
        const restoreCredits = snapshotCredits();
        retirePublicationCharge(req.requestId);
        const reservation = reservePublication(req.requestId, merchant, Math.max(1, req.dropsCount), currentNow);
        if (!reservation.ok) {
          restoreCredits();
          return reservation;
        }
        const rate = consumeRequestRate(
          'publish_request',
          settings.maxRequestPublicationsPerMin,
          currentNow
        );
        if (!rate.ok) {
          restoreCredits();
          return rate;
        }
        if (effectiveStatus === 'matched' && req.acceptedOfferId) {
          const acceptedOffer = offers.get(req.acceptedOfferId);
          if (acceptedOffer) acceptedOffer.status = 'cancelled';
        }
        for (const offer of offers.values()) {
          if (offer.requestId === req.requestId && offer.status === 'pending') {
            offer.status = 'expired';
          }
        }

        const publishedAt = currentNow.toISOString();
        const expiresAt = new Date(
          currentNow.getTime() + settings.requestTtlMinutes * 60_000
        ).toISOString();
        req.status = 'published';
        req.acceptedOfferId = null;
        req.assignedCourierId = null;
        req.expiresAt = expiresAt;

        return ok({
          requestId: input.requestId,
          status: 'published',
          publishedAt,
          expiresAt,
        });
      }),

    report_incident: (rawInput) =>
      executeRpc('report_incident', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');

        if (actor.role === 'merchant') {
          if (req.merchantId !== actor.userId) return err('UNAUTHORIZED_ACTOR');
        } else {
          // Igual que Postgres: el repartidor es el de la oferta delivery_requests.accepted_offer_id,
          // que tiene que existir, pertenecer a la solicitud y estar accepted. Recién después se evalúa
          // su elegibilidad.
          const offer = req.acceptedOfferId ? offers.get(req.acceptedOfferId) : undefined;
          if (
            !offer ||
            offer.requestId !== req.requestId ||
            offer.status !== 'accepted' ||
            offer.courierId !== actor.userId
          ) {
            return err('UNAUTHORIZED_ACTOR');
          }
          const eligibility = checkCourierEligibility();
          if (!eligibility.ok) return eligibility;
        }

        const currentNow = nowFn();
        const effectiveStatus = getEffectiveRequestStatus(req.status, req.expiresAt, currentNow);
        if (effectiveStatus === 'delivered' && actor.role === 'merchant') {
          const deliveredMs = req.deliveredAt ? Date.parse(req.deliveredAt) : Number.NaN;
          if (
            Number.isNaN(deliveredMs) ||
            currentNow.getTime() - deliveredMs > INCIDENT_WINDOW_MS
          ) {
            return err('INCIDENT_WINDOW_EXPIRED');
          }
        } else if (!ACTIVE_INCIDENT_STATUSES.includes(effectiveStatus)) {
          return err('INVALID_STATE_TRANSITION');
        }

        const rate = consumeRequestRate('report_incident', settings.maxIncidentsPerMin, currentNow);
        if (!rate.ok) return rate;
        incidentSeq += 1;
        const incidentId = `00000000-0000-4000-8000-${String(10_000 + incidentSeq).padStart(12, '0')}`;
        const createdAt = currentNow.toISOString();
        putIncident({
          incidentId,
          requestId: input.requestId,
          reporterId: actor.userId,
          reporterRole: actor.role === 'merchant' ? 'merchant' : 'courier',
          reporterName:
            actor.role === 'merchant'
              ? (merchants.get(actor.userId)?.businessName ?? '')
              : (couriers.get(actor.userId)?.displayName ?? ''),
          kind: input.kind,
          description: input.description,
          createdAt,
        });
        return ok({
          incidentId,
          requestId: input.requestId,
          status: 'open',
          createdAt,
        });
      }),

    set_availability: (rawInput) =>
      executeRpc('set_availability', rawInput, false, (input) => {
        const courier = couriers.get(actor.userId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status === 'suspended') return err('COURIER_SUSPENDED');
        if (courier.status !== 'approved') return err('COURIER_NOT_APPROVED');

        courier.available = input.available;
        actor = { ...actor, courierAvailable: input.available };
        return ok({
          courierId: actor.userId,
          available: input.available,
        });
      }),

    get_trip_details: (rawInput) =>
      executeRpc('get_trip_details', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req) return err('NOT_FOUND');
        if (!['matched', 'in_transit', 'delivered'].includes(req.status)) {
          return err('INVALID_STATE_TRANSITION');
        }
        const offer = req.acceptedOfferId ? offers.get(req.acceptedOfferId) : undefined;
        if (!offer || offer.status !== 'accepted' || offer.requestId !== req.requestId) {
          return err('INVALID_STATE_TRANSITION');
        }
        if (
          (actor.role === 'merchant' && req.merchantId !== actor.userId) ||
          (actor.role === 'courier' && offer.courierId !== actor.userId)
        ) {
          return err('UNAUTHORIZED_ACTOR');
        }
        const merchant = merchants.get(req.merchantId);
        const courier = couriers.get(offer.courierId);
        if (!merchant || !courier) {
          return err('NOT_FOUND');
        }
        const drops = req.drops.length > 0
          ? [...req.drops].sort((a, b) => a.position - b.position)
          : [
              {
                id: `40000000-0000-4000-8000-${req.requestId.slice(-12)}`,
                requestId: req.requestId,
                position: 1,
                dropoffZoneId: '00000000-0000-4000-8000-000000000099',
                dropoffZoneName: req.dropoffZoneName,
                dropoffAddress: req.dropoffAddress,
                dropoffLat: req.dropoffLat,
                dropoffLng: req.dropoffLng,
                packageType: 'chico' as const,
                recipientName: req.recipientName,
                recipientPhone: req.recipientPhone,
                recipientConsentDeclared: true,
                recipientPaymentMethod: req.recipientPaymentMethod ?? 'cash',
                needsChange: req.needsChange,
                cashChangeAmount: req.cashChangeAmount,
                notes: req.notes,
                approxDistanceM: null,
                status: 'pending' as const,
                deliveredAt: null,
                failedReason: null,
              },
            ];

        const mappedDrops = drops.map((d) => ({
          id: d.id,
          position: d.position,
          dropoffZoneName: d.dropoffZoneName,
          dropoffAddress: d.dropoffAddress,
          recipientName: d.recipientName,
          recipientPhone: d.recipientPhone,
          deliveryNotes: d.notes ?? null,
          cashChangeAmount: d.cashChangeAmount ?? null,
          packageType: d.packageType ?? 'chico',
          recipientPaymentMethod: d.recipientPaymentMethod,
          needsChange: d.needsChange,
          approxDistanceM: d.approxDistanceM ?? null,
          status: d.status,
          deliveredAt: d.deliveredAt ?? null,
          failedReason: d.failedReason ?? null,
          dropoffLat: d.dropoffLat ?? null,
          dropoffLng: d.dropoffLng ?? null,
        }));

        const firstDrop = mappedDrops[0];
        if (!firstDrop) {
          return err('NOT_FOUND');
        }

        return ok({
          requestId: req.requestId,
          code: `REQ-${req.requestId.slice(0, 8).toUpperCase()}`,
          status: req.status as 'matched' | 'in_transit' | 'delivered',
          merchantId: req.merchantId,
          merchantName: merchant.businessName,
          merchantPhone: merchant.phone,
          courierId: offer.courierId,
          courierName: courier.displayName,
          courierPhone: courier.phone,
          vehicleType: courier.vehicleType,
          vehiclePlate: courier.vehiclePlate,
          amountArs: offer.amountArs,
          pickupAddress: req.pickupAddress,
          pickupZoneName: req.pickupZoneName,
          dropoffAddress: firstDrop.dropoffAddress,
          dropoffZoneName: firstDrop.dropoffZoneName,
          deliveryNotes: firstDrop.deliveryNotes,
          recipientName: firstDrop.recipientName,
          recipientPhone: firstDrop.recipientPhone,
          recipientPaymentMethod: firstDrop.recipientPaymentMethod,
          needsChange: firstDrop.needsChange,
          cashChangeAmount: firstDrop.cashChangeAmount,
          createdAt: req.createdAt,
          matchedAt: req.matchedAt,
          pickedUpAt: req.pickedUpAt,
          deliveredAt: req.deliveredAt,
          dropsCount: mappedDrops.length,
          drops: mappedDrops,
        });
      }),

    get_request_offer_couriers: (rawInput) =>
      executeRpc('get_request_offer_couriers', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req || req.merchantId !== actor.userId) return err('NOT_FOUND');
        const courierIds = new Set(
          [...offers.values()].filter((o) => o.requestId === req.requestId).map((o) => o.courierId)
        );
        return ok({
          requestId: req.requestId,
          couriers: [...courierIds].sort().flatMap((courierId) => {
            const courier = couriers.get(courierId);
            if (!courier) return [];
            return [
              {
                courierId,
                displayName: courier.displayName,
                vehicleType: courier.vehicleType,
                licenseStatus: courier.licenseStatus,
                insuranceStatus: courier.insuranceStatus,
                docLevel: computeDocLevel(courier.licenseStatus, courier.insuranceStatus),
              },
            ];
          }),
        });
      }),

    get_merchant_request_private_fields: (rawInput) =>
      executeRpc('get_merchant_request_private_fields', rawInput, false, (input) => {
        const req = requests.get(input.requestId);
        if (!req || req.merchantId !== actor.userId) return err('NOT_FOUND');
        return ok({
          requestId: req.requestId,
          notes: req.notes,
          cashChangeAmount: req.cashChangeAmount,
        });
      }),

    // CC-032: mismo filtro (acción y actor antes de paginar), orden (created_at, id) desc y cursor de la última fila
    // devuelta que la función SQL.
    get_request_cancellation_history: (rawInput) =>
      executeRpc('get_request_cancellation_history', rawInput, false, (input) => {
        const isAdmin = actor.role === 'admin';
        const ownCancellations = (row: FakeCancellationReasonRecord) =>
          row.requestId === input.requestId &&
          row.action === 'courier_cancel_match' &&
          row.actorId === actor.userId;
        const req = requests.get(input.requestId);
        if (isAdmin) {
          if (!req) return err('NOT_FOUND');
        } else if (actor.role === 'merchant') {
          if (!req || req.merchantId !== actor.userId) return err('NOT_FOUND');
        } else if (!cancellationReasons.some(ownCancellations)) {
          return err('NOT_FOUND');
        }

        const limit = input.limit ?? 50;
        const cursor = input.cursor ?? null;
        const toKey = (row: FakeCancellationReasonRecord) => ({ createdAt: row.createdAt, incidentId: row.id });
        const cursorKey = cursor ? { createdAt: cursor.beforeCreatedAt, incidentId: cursor.beforeId } : null;
        const rows = cancellationReasons
          .filter((row) => row.requestId === input.requestId && row.action === 'courier_cancel_match')
          .filter((row) => actor.role !== 'courier' || row.actorId === actor.userId)
          .sort((a, b) => compareIncidentKeysetDesc(toKey(a), toKey(b)))
          .filter((row) => !cursorKey || compareIncidentKeysetDesc(toKey(row), cursorKey) > 0)
          .slice(0, limit + 1);
        const page = rows.slice(0, limit);
        const last = page[page.length - 1];
        const hasMore = rows.length > limit;

        return ok({
          version: '1.0' as const,
          requestId: input.requestId,
          events: page.map((row) => {
            const category = classifyCourierCancellationReason(row.reason);
            const courier = row.actorId ? couriers.get(row.actorId) : undefined;
            return {
              id: row.id,
              action: 'courier_cancel_match' as const,
              actionLabel: 'Cancelado por el repartidor' as const,
              category,
              categoryLabel: COURIER_CANCELLATION_CATEGORY_LABELS[category],
              createdAt: row.createdAt,
              actor: courier
                ? {
                    id: courier.courierId,
                    role: 'courier' as const,
                    displayName: courier.displayName.trim() || 'Repartidor',
                  }
                : null,
              offerId: row.offerId,
              rawReason: isAdmin ? row.reason : null,
            };
          }),
          pagination: {
            limit,
            hasMore,
            nextCursor: hasMore && last ? { beforeCreatedAt: last.createdAt, beforeId: last.id } : null,
          },
        });
      }),

    replace_courier_document: (rawInput) =>
      executeRpc('replace_courier_document', rawInput, false, (input) => {
        const courier = couriers.get(actor.userId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status === 'rejected' || courier.status === 'suspended') {
          return err('UNAUTHORIZED_ACTOR');
        }

        const prefix = `courier/${actor.userId}/${input.kind}_`;
        if (!input.storagePath.startsWith(prefix) || input.storagePath.includes('..')) {
          return err('VALIDATION_ERROR');
        }

        if (input.idempotencyKey) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(input.idempotencyKey)) {
            return err('VALIDATION_ERROR');
          }

          for (const d of documents.values()) {
            if (d.courierId === actor.userId && d.kind === input.kind && d.idempotencyKey === input.idempotencyKey) {
              if (d.storagePath !== input.storagePath) {
                return err('VALIDATION_ERROR');
              }
              return ok({
                documentId: d.documentId,
                kind: d.kind,
                status: d.status,
                replacedDocumentId: null,
                isCurrent: d.isCurrent,
                idempotent: true,
              });
            }
          }
        }

        let currentDoc: FakeDocumentRecord | undefined;
        for (const d of documents.values()) {
          if (d.courierId === actor.userId && d.kind === input.kind && d.isCurrent) {
            currentDoc = d;
            break;
          }
        }

        if (!currentDoc) {
          return err('NOT_FOUND');
        }

        if (currentDoc.status === 'submitted' && currentDoc.storagePath === input.storagePath) {
          return ok({
            documentId: currentDoc.documentId,
            kind: currentDoc.kind,
            status: currentDoc.status,
            replacedDocumentId: null,
            isCurrent: true,
            idempotent: true,
          });
        }

        if (currentDoc.status !== 'rejected') {
          return err('INVALID_STATE_TRANSITION');
        }

        currentDoc.isCurrent = false;
        currentDoc.purgeAfter = new Date(nowFn().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const newDocId = crypto.randomUUID();
        const newDoc: FakeDocumentRecord = {
          documentId: newDocId,
          courierId: actor.userId,
          kind: input.kind,
          status: 'submitted',
          isCurrent: true,
          rejectionCode: null,
          storagePath: input.storagePath,
          purgeAfter: null,
          idempotencyKey: input.idempotencyKey ?? null,
        };
        documents.set(newDocId, newDoc);

        if (input.kind === 'license') {
          courier.licenseStatus = 'submitted';
        } else if (input.kind === 'insurance') {
          courier.insuranceStatus = 'submitted';
        }

        return ok({
          documentId: newDocId,
          kind: input.kind,
          status: 'submitted',
          replacedDocumentId: currentDoc.documentId,
          isCurrent: true,
          idempotent: false,
        });
      }),

    calculate_route_distance: (rawInput) =>
      executeRpc('calculate_route_distance', rawInput, false, (input) => {
        if (
          input.pickupLat != null &&
          input.pickupLng != null &&
          input.dropoffLat != null &&
          input.dropoffLng != null
        ) {
          const routeDistanceM = calculateHaversineRouteDistanceM(
            { lat: input.pickupLat, lng: input.pickupLng },
            { lat: input.dropoffLat, lng: input.dropoffLng }
          );
          if (input.pickupZoneName && input.dropoffZoneName) {
            return ok({
              routeDistanceM,
              displayLabel: formatZoneToZoneDisplayLabel(
                input.pickupZoneName,
                input.dropoffZoneName
              ),
            });
          }
          return ok({ routeDistanceM });
        }

        return ok({
          routeDistanceM: null,
          displayLabel: formatZoneToZoneDisplayLabel(input.pickupZoneName, input.dropoffZoneName),
        });
      }),

    admin_decide_courier: (rawInput) =>
      executeRpc('admin_decide_courier', rawInput, true, (input) => {
        if (input.decision === 'rejected' && (!input.reason || input.reason.trim().length === 0)) {
          return err('REASON_REQUIRED');
        }
        const courier = couriers.get(input.courierId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status !== 'pending') return err('INVALID_STATE_TRANSITION');
        courier.status = input.decision;
        return ok({
          courierId: input.courierId,
          status: input.decision,
          decidedAt: nowFn().toISOString(),
        });
      }),

    admin_suspend_courier: (rawInput) =>
      executeRpc('admin_suspend_courier', rawInput, true, (input) => {
        if (!input.reason || input.reason.trim().length === 0) {
          return err('REASON_REQUIRED');
        }
        const courier = couriers.get(input.courierId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status === 'suspended') return err('INVALID_STATE_TRANSITION');

        courier.status = 'suspended';
        courier.available = false;

        let withdrawnOffersCount = 0;
        for (const offer of offers.values()) {
          if (offer.courierId === input.courierId && offer.status === 'pending') {
            offer.status = 'withdrawn';
            withdrawnOffersCount += 1;
          }
        }

        return ok({
          courierId: input.courierId,
          status: 'suspended',
          withdrawnOffersCount,
          deactivatedAt: nowFn().toISOString(),
        });
      }),

    admin_reinstate_courier: (rawInput) =>
      executeRpc('admin_reinstate_courier', rawInput, true, (input) => {
        if (input.reason.trim().length === 0) return err('REASON_REQUIRED');
        const courier = couriers.get(input.courierId);
        if (!courier) return err('NOT_FOUND');
        if (courier.status === 'approved') {
          return ok({
            courierId: input.courierId,
            previousStatus: 'approved',
            status: 'approved',
            idempotent: true,
          });
        }
        if (courier.status === 'pending' || courier.vehicleType === null) {
          return err('INVALID_STATE_TRANSITION');
        }
        const previousStatus = courier.status;
        courier.status = 'approved';
        return ok({ courierId: input.courierId, previousStatus, status: 'approved', idempotent: false });
      }),

    admin_verify_document: (rawInput) =>
      executeRpc('admin_verify_document', rawInput, true, (input) => {
        if (input.decision === 'rejected' && (!input.reason || input.reason.trim().length === 0)) {
          return err('REASON_REQUIRED');
        }
        const doc = documents.get(input.documentId);
        if (!doc) return err('NOT_FOUND');
        if (!doc.isCurrent) {
          return err('INVALID_STATE_TRANSITION');
        }
        if (doc.status !== 'submitted') {
          return err('INVALID_STATE_TRANSITION');
        }
        const courier = couriers.get(doc.courierId);
        if (!courier) return err('NOT_FOUND');

        const rejectionCode = input.decision === 'rejected' ? (input.rejectionCode ?? 'other_safe') : null;
        doc.status = input.decision;
        doc.rejectionCode = rejectionCode;
        if (doc.kind === 'license') courier.licenseStatus = input.decision;
        if (doc.kind === 'insurance') courier.insuranceStatus = input.decision;
        const docLevel = computeDocLevel(courier.licenseStatus, courier.insuranceStatus);

        return ok({
          documentId: input.documentId,
          courierId: doc.courierId,
          kind: doc.kind,
          status: doc.status,
          rejectionCode,
          docLevel,
        });
      }),

    admin_set_subscription: (rawInput) =>
      executeRpc('admin_set_subscription', rawInput, true, (input) => {
        const merchant = merchants.get(input.merchantId);
        if (!merchant) return err('NOT_FOUND');

        const nextLegacyEnd = legacyEndMs(
          { ...merchant, subscriptionStatus: input.subscriptionStatus },
          input.paidUntil ?? null
        );
        const nowMs = nowFn().getTime();
        if (
          nextLegacyEnd !== null &&
          periods.some((p) => p.merchantId === input.merchantId && p.endsAtMs > nowMs && p.startsAtMs < nextLegacyEnd)
        ) {
          return err('INVALID_STATE_TRANSITION');
        }

        merchant.subscriptionStatus = input.subscriptionStatus;
        merchant.paidUntil = input.paidUntil ?? null;

        return ok({
          merchantId: input.merchantId,
          subscriptionStatus: merchant.subscriptionStatus,
          paidUntil: merchant.paidUntil,
        });
      }),

    admin_update_setting: (rawInput) =>
      executeRpc('admin_update_setting', rawInput, true, (input) => {
        if (
          (input.key === 'carryover_base_pct' && input.value > (settings.carryoverCapPct ?? 35)) ||
          (input.key === 'carryover_cap_pct' && input.value < (settings.carryoverBasePct ?? 5))
        ) {
          return err('INVALID_SETTING_VALUE');
        }
        switch (input.key) {
          case 'min_offer_ars':
            settings = { ...settings, minOfferArs: input.value };
            break;
          case 'request_ttl_minutes':
            settings = { ...settings, requestTtlMinutes: input.value };
            break;
          case 'pilot_active':
            settings = { ...settings, pilotActive: input.value };
            break;
          case 'pilot_terms_version':
            settings = { ...settings, pilotTermsVersion: input.value };
            break;
          case 'subscription_grace_days':
            if (input.value !== settings.subscriptionGraceDays && graceChangeConflicts(input.value)) {
              return err('INVALID_SETTING_VALUE');
            }
            settings = { ...settings, subscriptionGraceDays: input.value };
            break;
          case 'max_drops_per_request':
            settings = { ...settings, maxDropsPerRequest: input.value };
            break;
          case 'publication_drops_per_credit':
            settings = { ...settings, publicationDropsPerCredit: input.value };
            break;
          case 'carryover_base_pct':
            settings = { ...settings, carryoverBasePct: input.value };
            break;
          case 'carryover_step_pct':
            settings = { ...settings, carryoverStepPct: input.value };
            break;
          case 'carryover_cap_pct':
            settings = { ...settings, carryoverCapPct: input.value };
            break;
          case 'launch_discount_pct':
            settings = { ...settings, launchDiscountPct: input.value };
            break;
          case 'loose_credit_reference_price_ars':
            settings = { ...settings, looseCreditReferencePriceArs: input.value };
            break;
        }
        return ok(input);
      }),

    // CC-029 (T-369): catálogo, acreditación, períodos y lecturas de créditos de publicación.
    admin_upsert_publication_plan: (rawInput) =>
      executeRpc('admin_upsert_publication_plan', rawInput, true, (input) => {
        const duplicate = [...plans.values()].find((p) => p.code === input.code && p.id !== input.planId);
        if (duplicate) return err('VALIDATION_ERROR');
        let plan: FakePublicationPlanRecord;
        if (input.planId === null) {
          plan = { id: nextCreditId(), code: input.code, name: input.name, kind: input.kind, monthlyCredits: input.monthlyCredits, referencePriceArs: input.referencePriceArs, active: input.active, sort: input.sort };
          plans.set(plan.id, plan);
        } else {
          const existing = plans.get(input.planId);
          if (!existing) return err('NOT_FOUND');
          if (
            (existing.kind !== input.kind || existing.monthlyCredits !== input.monthlyCredits) &&
            periods.some((p) => p.planId === existing.id)
          ) {
            return err('PLAN_IN_USE');
          }
          plan = { ...existing, code: input.code, name: input.name, kind: input.kind, monthlyCredits: input.monthlyCredits, referencePriceArs: input.referencePriceArs, active: input.active, sort: input.sort };
          plans.set(plan.id, plan);
        }
        return ok({
          planId: plan.id,
          code: plan.code,
          name: plan.name,
          kind: plan.kind,
          monthlyCredits: plan.monthlyCredits,
          referencePriceArs: plan.referencePriceArs,
          active: plan.active,
          sort: plan.sort,
        });
      }),

    admin_grant_publication_credits: (rawInput) =>
      executeRpc('admin_grant_publication_credits', rawInput, true, (input) => {
        if (!merchants.has(input.merchantId)) return err('NOT_FOUND');
        const note = normalizeNote(input.note);
        const existing = lots.find((l) => l.operationKey === input.operationKey);
        if (existing) {
          if (
            existing.merchantId !== input.merchantId ||
            existing.granted !== input.credits ||
            existing.source !== input.source ||
            existing.note !== note
          ) {
            return err('IDEMPOTENCY_CONFLICT');
          }
          return ok({
            lotId: existing.id,
            merchantId: existing.merchantId,
            credits: existing.granted,
            source: input.source,
            launchDiscountPct: discountByOperation.get(input.operationKey) ?? null,
            idempotent: true,
          });
        }
        creditSeq += 1;
        const lot: FakeCreditLotRecord = {
          id: nextCreditId(),
          merchantId: input.merchantId,
          kind: 'loose',
          periodId: null,
          granted: input.credits,
          expiresAtMs: null,
          source: input.source,
          operationKey: input.operationKey,
          refundChargeId: null,
          refundSourceLotId: null,
          note,
          createdSeq: creditSeq,
        };
        lots.push(lot);
        addMovement({ merchantId: input.merchantId, lotId: lot.id, chargeId: null, requestId: null, kind: 'grant', amount: input.credits, actorId: actor.userId, reason: input.source });
        const discount = input.source === 'purchase' ? applyLaunchDiscount(input.merchantId) : null;
        discountByOperation.set(input.operationKey, discount);
        return ok({
          lotId: lot.id,
          merchantId: input.merchantId,
          credits: input.credits,
          source: input.source,
          launchDiscountPct: discount,
          idempotent: false,
        });
      }),

    admin_register_plan_period: (rawInput) =>
      executeRpc('admin_register_plan_period', rawInput, true, (input) => {
        const merchant = merchants.get(input.merchantId);
        if (!merchant) return err('NOT_FOUND');
        const note = normalizeNote(input.note);
        const existing = periods.find((p) => p.operationKey === input.operationKey);
        if (existing) {
          if (
            existing.merchantId !== input.merchantId ||
            existing.planId !== input.planId ||
            existing.isPurchase !== input.isPurchase ||
            existing.note !== note
          ) {
            return err('IDEMPOTENCY_CONFLICT');
          }
          return ok({
            periodId: existing.id,
            merchantId: existing.merchantId,
            planId: existing.planId,
            startsAt: isoFromMs(existing.startsAtMs),
            endsAt: isoFromMs(existing.endsAtMs),
            streak: existing.streak,
            carryoverPct: existing.carryoverPct,
            launchDiscountPct: existing.launchDiscountPct,
            idempotent: true,
          });
        }
        const plan = plans.get(input.planId);
        if (!plan) return err('NOT_FOUND');
        if (!plan.active) return err('PLAN_INACTIVE');

        const ms = nowFn().getTime();
        const graceMs = settings.subscriptionGraceDays * 86_400_000;
        const last = periods
          .filter((p) => p.merchantId === input.merchantId)
          .sort((a, b) => b.endsAtMs - a.endsAtMs)[0];
        let startsAtMs: number;
        let streak: number;
        let previousPeriodId: string | null;
        if (last && last.endsAtMs > ms) {
          startsAtMs = last.endsAtMs;
          streak = last.streak + 1;
          previousPeriodId = last.id;
        } else if (last && ms <= last.endsAtMs + graceMs) {
          startsAtMs = ms;
          streak = last.streak + 1;
          previousPeriodId = last.id;
        } else {
          const legacyEnd = legacyPaidActive(merchant, ms) ? legacyEndMs(merchant, merchant.paidUntil) : null;
          startsAtMs = Math.max(ms, legacyEnd ?? ms);
          streak = 1;
          previousPeriodId = null;
        }
        const carryoverPct =
          streak >= 2
            ? Math.min(
                (settings.carryoverBasePct ?? 5) + (settings.carryoverStepPct ?? 5) * (streak - 2),
                settings.carryoverCapPct ?? 35
              )
            : 0;
        const period: FakePlanPeriodRecord = {
          id: nextCreditId(),
          merchantId: input.merchantId,
          planId: plan.id,
          planKind: plan.kind,
          monthlyCredits: plan.monthlyCredits,
          startsAtMs,
          endsAtMs: addOneMonthArgentina(startsAtMs),
          streak,
          carryoverPct,
          previousPeriodId,
          carryoverMaterialized: false,
          operationKey: input.operationKey,
          isPurchase: input.isPurchase,
          note,
          launchDiscountPct: null,
        };
        periods.push(period);
        if (plan.kind === 'quota' && plan.monthlyCredits !== null) {
          creditSeq += 1;
          const lot: FakeCreditLotRecord = {
            id: nextCreditId(),
            merchantId: input.merchantId,
            kind: 'plan',
            periodId: period.id,
            granted: plan.monthlyCredits,
            expiresAtMs: period.endsAtMs,
            source: 'plan',
            operationKey: null,
            refundChargeId: null,
            refundSourceLotId: null,
            note: null,
            createdSeq: creditSeq,
          };
          lots.push(lot);
          addMovement({ merchantId: input.merchantId, lotId: lot.id, chargeId: null, requestId: null, kind: 'grant', amount: plan.monthlyCredits, actorId: actor.userId, reason: 'plan' });
        }
        period.launchDiscountPct = input.isPurchase ? applyLaunchDiscount(input.merchantId) : null;
        return ok({
          periodId: period.id,
          merchantId: input.merchantId,
          planId: plan.id,
          startsAt: isoFromMs(period.startsAtMs),
          endsAt: isoFromMs(period.endsAtMs),
          streak,
          carryoverPct,
          launchDiscountPct: period.launchDiscountPct,
          idempotent: false,
        });
      }),

    admin_get_merchant_publication_credits: (rawInput) =>
      executeRpc('admin_get_merchant_publication_credits', rawInput, true, (input) => {
        const merchant = merchants.get(input.merchantId);
        if (!merchant) return err('NOT_FOUND');
        const currentNow = nowFn();
        reconcileMerchantExpired(input.merchantId, currentNow);
        const limit = input.limit ?? 50;
        const page = movements
          .filter((m) => m.merchantId === input.merchantId && (input.beforeId == null || m.id < input.beforeId))
          .sort((a, b) => b.id - a.id)
          .slice(0, limit);
        return ok({
          balance: publicationBalance(merchant, currentNow),
          movements: page.map((m) => ({
            id: m.id,
            kind: m.kind,
            amount: m.amount,
            lotId: m.lotId,
            chargeId: m.chargeId,
            requestId: m.requestId,
            actorId: m.actorId,
            reason: m.reason,
            createdAt: isoFromMs(m.createdAtMs),
          })),
          nextCursor: page.length === limit ? (page[page.length - 1]?.id ?? null) : null,
        });
      }),

    // CC-029 addendum D01-B: mismo orden (sort, id) y cursor de la última fila devuelta que la RPC SQL.
    admin_list_publication_plans: (rawInput) =>
      executeRpc('admin_list_publication_plans', rawInput, true, (input) => {
        const limit = input.limit ?? 50;
        const afterSort = input.afterSort ?? null;
        const afterId = input.afterId ?? null;
        const rows = [...plans.values()]
          .filter((plan) => !(input.activeOnly ?? false) || plan.active)
          .filter(
            (plan) =>
              afterSort === null ||
              afterId === null ||
              plan.sort > afterSort ||
              (plan.sort === afterSort && plan.id > afterId)
          )
          .sort((a, b) => a.sort - b.sort || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
          .slice(0, limit + 1);
        const items = rows.slice(0, limit);
        const last = items[items.length - 1];
        return ok({
          items: items.map((plan) => ({ ...plan })),
          nextCursor: rows.length > limit && last ? { sort: last.sort, id: last.id } : null,
        });
      }),

    get_my_publication_balance: (rawInput) =>
      executeRpc('get_my_publication_balance', rawInput, false, () => {
        const merchant = merchants.get(actor.userId);
        if (!merchant) return err('UNAUTHORIZED_ACTOR');
        const currentNow = nowFn();
        reconcileMerchantExpired(actor.userId, currentNow);
        return ok(publicationBalance(merchant, currentNow));
      }),

    // CC-012 / D06-A: la suspensión preventiva deriva el repartidor desde la oferta accepted de la
    // solicitud del incidente. Todas las comprobaciones ocurren antes de mutar (atomicidad).
    admin_resolve_incident: (rawInput) =>
      executeRpc('admin_resolve_incident', rawInput, true, (input) => {
        const incident = incidents.get(input.incidentId);
        if (!incident) return err('NOT_FOUND');
        if (incident.status !== 'open' && incident.status !== 'reviewing') {
          return err('INVALID_STATE_TRANSITION');
        }

        let suspendedCourier: FakeCourierRecord | null = null;
        if (input.decision === 'preventive_suspension') {
          const acceptedOffer = [...offers.values()].find(
            (offer) => offer.requestId === incident.requestId && offer.status === 'accepted'
          );
          if (!acceptedOffer) return err('INVALID_STATE_TRANSITION');
          const courier = couriers.get(acceptedOffer.courierId);
          if (!courier) return err('NOT_FOUND');
          if (courier.status === 'suspended') return err('INVALID_STATE_TRANSITION');
          suspendedCourier = courier;
        }

        let withdrawnOffersCount = 0;
        if (suspendedCourier) {
          suspendedCourier.status = 'suspended';
          suspendedCourier.available = false;
          for (const offer of offers.values()) {
            if (offer.courierId === suspendedCourier.courierId && offer.status === 'pending') {
              offer.status = 'withdrawn';
              withdrawnOffersCount += 1;
            }
          }
        }

        const status = input.decision === 'no_action' ? 'dismissed' : 'resolved';
        incident.status = status;
        incident.resolution = `${input.decision}: ${input.reason}`;

        return ok({
          incidentId: incident.incidentId,
          status,
          decision: input.decision,
          courierId: suspendedCourier ? suspendedCourier.courierId : null,
          withdrawnOffersCount,
        });
      }),

    // CC-012: keyset estable ORDER BY created_at DESC, id DESC, igual que la función SQL.
    admin_list_incidents: (rawInput) =>
      executeRpc('admin_list_incidents', rawInput, true, (input) => {
        const limit = input.limit ?? DEFAULT_INCIDENTS_PAGE_SIZE;
        const cursor = input.cursor ?? null;
        const cursorKey = cursor ? { createdAt: cursor.createdAt, incidentId: cursor.id } : null;

        // created_at DESC, id DESC con precisión de microsegundos; página siguiente:
        // created_at < c.createdAt OR (created_at = c.createdAt AND id < c.id).
        const ordered = [...incidents.values()]
          .filter((incident) => input.statuses.includes(incident.status))
          .sort(compareIncidentKeysetDesc)
          .filter((incident) => !cursorKey || compareIncidentKeysetDesc(incident, cursorKey) > 0);

        const page = ordered.slice(0, limit);
        const last = page[page.length - 1];
        return ok({
          items: page.map((incident) => ({
            id: incident.incidentId,
            requestId: incident.requestId,
            kind: incident.kind,
            description: incident.description,
            status: incident.status,
            resolution: incident.resolution,
            createdAt: incident.createdAt,
            reporterId: incident.reporterId,
            reporterRole: incident.reporterRole,
            reporterName: incident.reporterName,
          })),
          nextCursor: ordered.length > limit && last ? { createdAt: last.createdAt, id: last.incidentId } : null,
        });
      }),
  };
}
