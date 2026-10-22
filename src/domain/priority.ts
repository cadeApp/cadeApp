import { type DocumentReviewStatus, type VehicleType } from './schemas';

export type DocLevel = 0 | 1 | 2;
export type VerifiedCourierBadge = 'license_verified' | 'insurance_verified';
export type DeclaredCourierBadge = 'vehicle_declared' | 'license_declared' | 'insurance_declared';
export type OfferSortOrder = 'doc_level' | 'price';

export interface SortableOfferItem {
  readonly id: string;
  readonly amountArs: number;
  readonly docLevel: DocLevel;
  readonly createdAt: string | Date;
}

export function computeDocLevel(
  licenseStatus: DocumentReviewStatus,
  insuranceStatus: DocumentReviewStatus
): DocLevel {
  const licensePoints = licenseStatus === 'verified' ? 1 : 0;
  const insurancePoints = insuranceStatus === 'verified' ? 1 : 0;
  return (licensePoints + insurancePoints) as DocLevel;
}

export function getCourierVerifiedBadges(
  licenseStatus: DocumentReviewStatus,
  insuranceStatus: DocumentReviewStatus
): VerifiedCourierBadge[] {
  const badges: VerifiedCourierBadge[] = [];
  if (licenseStatus === 'verified') {
    badges.push('license_verified');
  }
  if (insuranceStatus === 'verified') {
    badges.push('insurance_verified');
  }
  return badges;
}

export function getCourierDeclaredBadges(input: {
  readonly licenseStatus: DocumentReviewStatus;
  readonly insuranceStatus: DocumentReviewStatus;
  readonly vehicleType?: VehicleType | null;
}): DeclaredCourierBadge[] {
  const badges: DeclaredCourierBadge[] = [];
  if (input.vehicleType) {
    badges.push('vehicle_declared');
  }
  if (input.licenseStatus === 'submitted') {
    badges.push('license_declared');
  }
  if (input.insuranceStatus === 'submitted') {
    badges.push('insurance_declared');
  }
  return badges;
}

function toEpochMs(value: string | Date): number {
  return typeof value === 'string' ? Date.parse(value) : value.getTime();
}

export function sortOffersForMerchant<T extends SortableOfferItem>(
  offers: readonly T[],
  order: OfferSortOrder = 'doc_level'
): T[] {
  return [...offers].sort((a, b) => {
    if (order === 'price' && a.amountArs !== b.amountArs) {
      return a.amountArs - b.amountArs;
    }
    if (b.docLevel !== a.docLevel) {
      return b.docLevel - a.docLevel;
    }
    const timeDiff = toEpochMs(a.createdAt) - toEpochMs(b.createdAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    if (a.amountArs !== b.amountArs) {
      return a.amountArs - b.amountArs;
    }
    return a.id.localeCompare(b.id);
  });
}
