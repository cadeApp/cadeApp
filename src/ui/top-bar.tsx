import * as React from 'react';
import Link from 'next/link';
import { cn } from './cn';
import { BrandLogo } from './brand-logo';

export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  showLogo?: boolean;
  logoHref?: string;
}

/**
 * Barra superior marina de 56px (`h-14`, `#12182C` vía `bg-foreground text-background`)
 * según el sistema de diseño Stitch (D16), con contenedor interno `max-w-5xl mx-auto`.
 */
export function TopBar({
  title,
  subtitle,
  leftAction,
  rightAction,
  showLogo = true,
  logoHref = '/',
  className,
  ...props
}: TopBarProps) {
  return (
    <header
      className={cn('sticky top-0 z-40 w-full bg-foreground text-background shadow-sm', className)}
      {...props}
    >
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          {leftAction}
          {showLogo ? (
            <Link
              href={logoHref}
              aria-label="Ir al inicio de cadeApp"
              className="inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <BrandLogo size="md" variant="inverse" showWordmark={!title} />
            </Link>
          ) : null}
          {title ? (
            <div className="flex flex-col">
              <h1 className="font-display text-base font-bold leading-tight text-background">
                {title}
              </h1>
              {subtitle ? <span className="text-sm text-background/80">{subtitle}</span> : null}
            </div>
          ) : null}
        </div>
        {rightAction ? <div className="flex items-center gap-2">{rightAction}</div> : null}
      </div>
    </header>
  );
}
