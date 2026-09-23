'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

interface SelectContextValue {
  value: string;
  onValueChange: (nextValue: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  placeholder?: string;
  items: Map<string, string>;
  registerItem: (val: string, label: string) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

function useSelectContext(): SelectContextValue {
  const ctx = React.useContext(SelectContext);
  if (!ctx) {
    throw new Error('Los subcomponentes de Select deben usarse dentro de <Select>.');
  }
  return ctx;
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({ value, defaultValue = '', onValueChange, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const [items] = React.useState(() => new Map<string, string>());

  const resolvedValue = value !== undefined ? value : internalValue;

  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      if (value === undefined) {
        setInternalValue(nextValue);
      }
      onValueChange?.(nextValue);
      setOpen(false);
    },
    [onValueChange, value]
  );

  const registerItem = React.useCallback(
    (val: string, label: string) => {
      items.set(val, label);
    },
    [items]
  );

  return (
    <SelectContext.Provider
      value={{
        value: resolvedValue,
        onValueChange: handleValueChange,
        open,
        setOpen,
        items,
        registerItem,
      }}
    >
      <div className="relative w-full">{children}</div>
    </SelectContext.Provider>
  );
}

export type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen } = useSelectContext();
    return (
      <button
        ref={ref}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex h-12 w-full items-center justify-between rounded-lg border border-input bg-card px-3.5 py-2.5 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </button>
    );
  }
);

SelectTrigger.displayName = 'SelectTrigger';

export interface SelectValueProps {
  placeholder?: string;
}

export function SelectValue({ placeholder = 'Seleccioná una opción' }: SelectValueProps) {
  const { value, items } = useSelectContext();
  const label = value ? (items.get(value) ?? value) : placeholder;
  return <span className={cn(!value && 'text-muted-foreground')}>{label}</span>;
}

export type SelectContentProps = React.HTMLAttributes<HTMLDivElement>;

export function SelectContent({ className, children, ...props }: SelectContentProps) {
  const { open } = useSelectContext();
  if (!open) {
    return <div className="hidden">{children}</div>;
  }
  return (
    <div
      role="listbox"
      className={cn(
        'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export function SelectItem({ value, className, children, ...props }: SelectItemProps) {
  const { value: selectedValue, onValueChange, registerItem } = useSelectContext();
  const textLabel = typeof children === 'string' ? children : value;

  React.useEffect(() => {
    registerItem(value, textLabel);
  }, [registerItem, textLabel, value]);

  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => onValueChange(value)}
      className={cn(
        'flex min-h-12 w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
        isSelected && 'bg-primary/15 font-semibold text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
