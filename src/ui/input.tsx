import * as React from 'react';
import { cn } from './cn';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

/**
 * Campo de texto base de `src/ui` con radio de 10px (`rounded-lg`),
 * altura táctil de 48px (`h-12`) y piso tipográfico >= 14px/16px.
 */
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-12 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive',
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
