'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { isStandalone } from './is-standalone';

export interface StandaloneBackLinkProps {
  href: string;
  standaloneMode: 'hide' | 'login';
  className?: string;
  'aria-label'?: string;
  children: React.ReactNode;
}

export function StandaloneBackLink({
  href,
  standaloneMode,
  className,
  'aria-label': ariaLabel,
  children,
}: StandaloneBackLinkProps) {
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setStandalone(true);
    }
  }, []);

  if (standalone && standaloneMode === 'hide') {
    return null;
  }

  const effectiveHref = standalone && standaloneMode === 'login' ? '/login' : href;
  const standaloneCss = standaloneMode === 'hide' ? ' [@media(display-mode:standalone)]:hidden' : '';

  return (
    <Link
      href={effectiveHref}
      aria-label={ariaLabel}
      className={className ? `${className}${standaloneCss}` : standaloneCss.trim()}
    >
      {children}
    </Link>
  );
}
