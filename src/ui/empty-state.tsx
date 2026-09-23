import * as React from 'react';
import { cn } from './cn';
import { Button } from './button';

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Estado vacío (`EmptyState`) con el motivo de línea ondulada en teal (`#09BABD`)
 * del sistema de diseño Stitch (D16).
 */
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
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-8 text-center',
        className
      )}
      {...props}
    >
      {icon ? (
        <div
          aria-hidden="true"
          className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary-dark"
        >
          {icon}
        </div>
      ) : null}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 120 12"
        fill="none"
        aria-hidden="true"
        className="mb-3 h-3 w-28"
      >
        <path
          d="M2 6C20 1 40 11 60 6C80 1 100 11 118 6"
          stroke="#09BABD"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {actionLabel && onAction ? (
        <div className="mt-4 w-full max-w-xs">
          <Button className="w-full" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
