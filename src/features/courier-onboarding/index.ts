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

export const IdentityForm = dynamic<IdentityFormProps>(
  () => import('./components/identity-form').then((mod) => mod.IdentityForm)
);
export type { IdentityFormProps };

export const VehicleForm = dynamic<VehicleFormProps>(
  () => import('./components/vehicle-form').then((mod) => mod.VehicleForm)
);
export type { VehicleFormProps };
