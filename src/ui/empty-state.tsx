'use client';

import * as React from 'react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/button';
import { AnimatedBox } from '@/ui/motion';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLElement> {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <AnimatedBox
      preset="fadeIn"
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 text-center shadow-card',
        className
      )}
      {...props}
    >
      {icon ? (
        <div
          className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-primary-dark"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-base font-bold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <div className="mt-4 w-full max-w-xs">
          <Button type="button" variant="default" size="lg" onClick={onAction} className="w-full">
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </AnimatedBox>
  );
}
