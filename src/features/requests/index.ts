'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import type { CreateRequestFormProps } from './components/create-request-form';
import type { RequestOffersListProps } from './components/request-offers-list';
import { CreateRequestSkeleton } from './components/create-request-skeleton';
import { RequestOffersSkeleton } from './components/request-offers-skeleton';

export type * from './schemas';
export * from './types';
export * from './copy';
export type { CreateRequestFormProps, RequestOffersListProps };
export { CreateRequestSkeleton, RequestOffersSkeleton };
export * from './components/merchant-requests-list';
export * from './components/merchant-requests-skeleton';
export * from './components/merchant-history-view';

export const CreateRequestForm = dynamic<CreateRequestFormProps>(
  () => import('./components/create-request-form').then((mod) => mod.CreateRequestForm),
  {
    ssr: false,
    loading: () => React.createElement(CreateRequestSkeleton),
  }
);

export const RequestOffersList = dynamic<RequestOffersListProps>(
  () => import('./components/request-offers-list').then((mod) => mod.RequestOffersList),
  {
    ssr: false,
    loading: () => React.createElement(RequestOffersSkeleton),
  }
);
