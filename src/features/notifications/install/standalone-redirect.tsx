'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isStandalone } from './is-standalone';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export interface StandaloneRedirectProps {
  to?: string;
  children?: React.ReactNode;
}

export const loadIosInstallGuideSheet = () =>
  import('./ios-install-guide-sheet').then((module) => ({
    default: module.IosInstallGuideSheet,
  }));


export function StandaloneRedirect({ to = '/login', children }: StandaloneRedirectProps) {
  const router = useRouter();
  const [standalone, setStandalone] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (isStandalone()) {
      setStandalone(true);
      router.replace(to);
    }
  }, [router, to]);

  if (standalone) {
    return null;
  }

  return (
    <div className="[@media(display-mode:standalone)]:hidden contents">
      {children}
    </div>
  );
}
