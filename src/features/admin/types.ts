export type AdminApplicantTab = 'pending' | 'approved' | 'rejected' | 'suspended';

export type CourierDocLevel = 0 | 1 | 2;

export interface ApplicantListItem {
  readonly id: string;
  readonly fullName: string;
  readonly dniHash: string;
  readonly phone: string;
  readonly vehicleType: string;
  readonly status: AdminApplicantTab;
  readonly docLevel: CourierDocLevel;
  readonly createdAt: string;
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
  readonly documentType: 'dni_front' | 'dni_back' | 'selfie' | 'driver_license' | 'vehicle_insurance';
  readonly storagePath: string;
  readonly verified: boolean;
  readonly verifiedAt: string | null;
  readonly rejectionReason: string | null;
}

export interface ApplicantDetail {
  readonly id: string;
  readonly fullName: string;
  readonly dniHash: string;
  readonly phone: string;
  readonly vehicleType: string;
  readonly vehiclePlate: string | null;
  readonly status: AdminApplicantTab;
  readonly rejectionReason: string | null;
  readonly suspensionReason: string | null;
  readonly createdAt: string;
  readonly documents: readonly ApplicantDocumentDetail[];
}

export interface ViewDocumentResult {
  readonly signedUrl: string;
  readonly expiresInSeconds: number;
}
