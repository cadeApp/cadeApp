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

export interface ViewDocumentResult {
  readonly signedUrl: string;
  readonly expiresInSeconds: number;
}
