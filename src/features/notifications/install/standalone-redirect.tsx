'use client';

import React from 'react';

export interface StandaloneRedirectProps {
  to?: string;
  children?: React.ReactNode;
}

export function StandaloneRedirect({ children }: StandaloneRedirectProps) {
  // Stub inicial para fase RED
  return <>{children}</>;
}
