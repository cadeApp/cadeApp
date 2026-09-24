import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from './cn';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-sans text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-95',
        secondary: 'bg-secondary text-secondary-foreground hover:opacity-95',
        outline: 'border border-border bg-card text-foreground hover:bg-muted',
        ghost: 'text-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-95',
        link: 'text-primary-dark underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-12 h-12 px-5 py-2.5 text-base',
        sm: 'min-h-12 h-12 px-4 py-2 text-sm',
        lg: 'min-h-14 h-14 px-6 py-3 text-base',
        icon: 'min-h-12 min-w-12 h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  isPending?: boolean;
  pendingText?: string;
}

/**
 * Botón base de `src/ui` con altura mínima táctil de 48px (`h-12`),
 * contraste AAA en variante primaria (`#12182C` sobre `#09BABD`)
 * y estado pendiente integrado (`isPending` + `pendingText`).
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isPending = false,
      pendingText,
      disabled,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const isDisabled = Boolean(disabled || isPending);
    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isPending ? 'true' : undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {isPending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
        <span className="inline-flex w-full items-center justify-center gap-2">
          {isPending && pendingText ? pendingText : children}
        </span>
      </button>
    );
  }
);

Button.displayName = 'Button';
