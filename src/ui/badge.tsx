import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from './cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-sans text-sm font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        published: 'border-transparent bg-primary text-primary-foreground',
        with_offers: 'border-primary-dark bg-card text-primary-dark',
        matched: 'border-transparent bg-secondary text-secondary-foreground',
        in_transit: 'badge-warning',
        delivered: 'badge-success',
        expired: 'border-border bg-muted text-muted-foreground',
        cancelled: 'badge-danger',
        verified: 'badge-success',
        declared: 'border-border bg-card text-muted-foreground',
        secondary: 'border-transparent bg-secondary text-secondary-foreground',
        outline: 'border-border bg-card text-foreground',
        destructive: 'badge-danger',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

/**
 * Insignia con forma de píldora (`rounded-full`) y piso tipográfico de 14px (`text-sm`),
 * cubriendo todos los estados de solicitud y niveles de verificación de Stitch (S00).
 */
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
