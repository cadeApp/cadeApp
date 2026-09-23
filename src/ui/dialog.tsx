'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/button';
import { AnimatedBox } from '@/ui/motion';

interface DialogInternalContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}

const DialogInternalContext = React.createContext<DialogInternalContextValue | null>(null);

function useDialogInternalContext() {
  const ctx = React.useContext(DialogInternalContext);
  if (!ctx) {
    throw new Error('Dialog components must be rendered inside <Dialog>');
  }
  return ctx;
}

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  children,
}: DialogProps) {
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
    <DialogInternalContext.Provider value={{ open, setOpen, triggerRef }}>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </DialogPrimitive.Root>
    </DialogInternalContext.Provider>
  );
}

export function DialogTrigger({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen, triggerRef } = useDialogInternalContext();

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

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  preventCloseOnEscape?: boolean;
  onClose?: () => void;
}

export function DialogContent({
  className,
  children,
  preventCloseOnEscape = false,
  onClose,
  ...props
}: DialogContentProps) {
  const { open, setOpen } = useDialogInternalContext();
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    const container = contentRef.current;
    const focusables = container
      ? Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        )
      : [];
    if (focusables.length > 0) {
      focusables[0]?.focus();
    } else {
      container?.focus();
    }
  }, [open]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (!preventCloseOnEscape) {
        onClose?.();
        setOpen(false);
      }
      return;
    }

    if (event.key === 'Tab' && contentRef.current) {
      const focusables = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );
      if (focusables.length > 0) {
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
  };

  if (!open) {
    return null;
  }

  return (
    <DialogPrimitive.Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPrimitive.Overlay
          className="fixed inset-0 bg-foreground/50 backdrop-blur-xs transition-opacity"
          aria-hidden="true"
          onClick={() => {
            if (!preventCloseOnEscape) {
              onClose?.();
              setOpen(false);
            }
          }}
        />
        <DialogPrimitive.Content
          ref={contentRef}
          onEscapeKeyDown={(event) => {
            if (preventCloseOnEscape) {
              event.preventDefault();
            } else {
              onClose?.();
            }
          }}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
          className={cn(
            'relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-modal focus:outline-none',
            className
          )}
          {...props}
        >
          <AnimatedBox preset="scaleTap">{children}</AnimatedBox>
        </DialogPrimitive.Content>
      </div>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-2 text-left', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <DialogPrimitive.Title
      className={cn('font-display text-lg font-bold text-foreground', className)}
      {...props}
    />
  );
}

export function DialogDescription({
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

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isPending?: boolean;
  variant?: 'destructive' | 'default' | 'primary';
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Volver',
  onConfirm,
  isPending = false,
  variant = 'destructive',
}: ConfirmDialogProps) {
  const buttonVariant = variant === 'primary' ? 'default' : variant;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent preventCloseOnEscape={isPending}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={buttonVariant}
            isPending={isPending}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
