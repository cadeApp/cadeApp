'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { loadErrorView } from '@/features/notifications';

const ErrorView = dynamic(loadErrorView);

export interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  return <ErrorView error={error} reset={reset} />;
}
