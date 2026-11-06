import dynamic from 'next/dynamic';
import type { IdentityFormProps } from './components/identity-form';
import type { VehicleFormProps } from './components/vehicle-form';

export * from './schemas';
export * from './copy';
export { StepIndicator, type StepIndicatorProps } from './components/step-indicator';
export { StatusView, type StatusViewProps } from './components/status-view';
export type { CourierDocumentMetadata } from './queries';
export {
  CourierProfileView,
  getDocumentStatusPresentation,
  type CourierProfileData,
} from './components/courier-profile-view';
export {
  DocumentReplacementCard,
  type DocumentReplacementCardProps,
} from './components/document-replacement-card';
export {
  DocumentUploadCard,
  type DocumentUploadCardProps,
} from './components/document-upload-card';
// CC-042: cambio del vehículo activo (lo usa también el feed).
export { setActiveCourierVehicleAction } from './actions';
export {
  CourierVehiclesManager,
  type CourierVehiclesManagerProps,
} from './components/courier-vehicles-manager';

export const IdentityForm = dynamic<IdentityFormProps>(
  () => import('./components/identity-form').then((mod) => mod.IdentityForm)
);
export type { IdentityFormProps };

export const VehicleForm = dynamic<VehicleFormProps>(
  () => import('./components/vehicle-form').then((mod) => mod.VehicleForm)
);
export type { VehicleFormProps };
