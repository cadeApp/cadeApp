'use client';

import React from 'react';

export interface StandaloneBackLinkProps {
  href: string;
  standaloneMode: 'hide' | 'login';
  className?: string;
  'aria-label'?: string;
  children: React.ReactNode;
}

export function StandaloneBackLink({
  href,
  className,
  'aria-label': ariaLabel,
  children,
}: StandaloneBackLinkProps) {
  // Stub inicial para fase RED: siempre devuelve enlace hacia href
  return (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  );
}
