'use client';

import React from 'react';
import { ErrorView } from '@/features/notifications';

export interface RootErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: RootErrorProps) {
  return <ErrorView error={error} reset={reset} />;
}
