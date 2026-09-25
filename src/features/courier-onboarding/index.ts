'use client';

import dynamic from 'next/dynamic';
import type { IdentityFormProps } from './components/identity-form';
import type { VehicleFormProps } from './components/vehicle-form';

export type * from './schemas';
export * from './copy';
export * from './upload-manager';
export type { IdentityFormProps, VehicleFormProps };
export * from './components/step-indicator';
export * from './components/status-view';
export * from './components/courier-profile-view';

export const IdentityForm = dynamic<IdentityFormProps>(
  () => import('./components/identity-form').then((mod) => mod.IdentityForm),
  { ssr: false }
);

export const VehicleForm = dynamic<VehicleFormProps>(
  () => import('./components/vehicle-form').then((mod) => mod.VehicleForm),
  { ssr: false }
);
