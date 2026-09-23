'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/ui/cn';
import { AnimatedBox } from '@/ui/motion';

interface SheetInternalContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}

const SheetInternalContext = React.createContext<SheetInternalContextValue | null>(null);

function useSheetInternalContext() {
  const ctx = React.useContext(SheetInternalContext);
  if (!ctx) {
    throw new Error('Sheet components must be rendered inside <Sheet>');
  }
  return ctx;
}

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Sheet({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (next && typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) {
        triggerRef.current = document.activeElement;
      }
      if (!isControlled) {
        setUncontrolledOpen(next);
      }
      onOpenChange?.(next);
      if (!next && triggerRef.current) {
        const toFocus = triggerRef.current;
        queueMicrotask(() => {
          toFocus.focus();
        });
      }
    },
    [isControlled, onOpenChange]
  );

  React.useEffect(() => {
    if (open && !triggerRef.current && typeof document !== 'undefined') {
      if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
        triggerRef.current = document.activeElement;
      }
    }
  }, [open]);

  return (
    <SheetInternalContext.Provider value={{ open, setOpen, triggerRef }}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </DialogPrimitive.Root>
    </SheetInternalContext.Provider>
  );
}

export function SheetTrigger({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen, triggerRef } = useSheetInternalContext();

  return (
    <DialogPrimitive.Trigger asChild>
      <button
        type="button"
        ref={(node) => {
          if (node) {
            triggerRef.current = node;
          }
        }}
        onClick={(e) => {
          triggerRef.current = e.currentTarget;
          setOpen(true);
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </button>
    </DialogPrimitive.Trigger>
  );
}

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: 'bottom' | 'right';
}

export function SheetContent({
  side = 'bottom',
  className,
  children,
  ...props
}: SheetContentProps) {
  const { open, setOpen } = useSheetInternalContext();

  if (!open) {
    return null;
  }

  return (
    <DialogPrimitive.Portal>
      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-foreground/50 backdrop-blur-sm"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
        <DialogPrimitive.Content
          data-sheet-side={side}
          tabIndex={-1}
          className={cn(
            'relative z-10 w-full max-w-lg border border-border bg-card p-6 text-card-foreground shadow-modal safe-area-bottom focus:outline-none',
            side === 'bottom' ? 'rounded-t-xl sm:rounded-xl' : 'h-full max-w-md rounded-l-xl',
            className
          )}
          {...props}
        >
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
          <AnimatedBox preset="sheetSpring">{children}</AnimatedBox>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 text-left', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <DialogPrimitive.Title
      className={cn('font-display text-lg font-bold text-foreground', className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mt-6 flex flex-col gap-3', className)} {...props} />;
}
