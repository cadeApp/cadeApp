import * as React from 'react';
import { cn } from './cn';
import { BrandLogo } from './brand-logo';

export interface TopBarProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  showLogo?: boolean;
}

/**
 * Barra superior marina de 56px (`h-14`, `#12182C` vía `bg-foreground text-background`)
 * según el sistema de diseño Stitch (D16).
 */
export function TopBar({
  title,
  subtitle,
  leftAction,
  rightAction,
  showLogo = true,
  className,
  ...props
}: TopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 w-full items-center justify-between bg-foreground px-4 text-background',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-3">
        {leftAction}
        {showLogo ? <BrandLogo size="sm" variant="inverse" showWordmark={!title} /> : null}
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
    </header>
  );
}
