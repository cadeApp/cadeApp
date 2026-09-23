'use client';

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/ui/cn';

interface SelectInternalContextValue {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  labelsMap: ReadonlyMap<string, string>;
  listboxId: string;
}

const SelectInternalContext = React.createContext<SelectInternalContextValue | null>(null);

function useSelectInternalContext() {
  const ctx = React.useContext(SelectInternalContext);
  if (!ctx) {
    throw new Error('Select subcomponents must be used within <Select>');
  }
  return ctx;
}

function collectSelectLabels(children: React.ReactNode, map: Map<string, string>) {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }
    const props = child.props as { value?: unknown; children?: React.ReactNode };
    if (typeof props.value === 'string' && typeof props.children === 'string') {
      map.set(props.value, props.children);
    }
    if (props.children) {
      collectSelectLabels(props.children, map);
    }
  });
}

export interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function Select({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  children,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [open, setOpen] = React.useState(false);
  const listboxId = React.useId();

  const isControlled = controlledValue !== undefined;
  const currentValue = isControlled ? controlledValue : uncontrolledValue;

  const labelsMap = React.useMemo(() => {
    const map = new Map<string, string>();
    collectSelectLabels(children, map);
    return map;
  }, [children]);

  const handleSelect = React.useCallback(
    (next: string) => {
      if (!isControlled) {
        setUncontrolledValue(next);
      }
      onValueChange?.(next);
      setOpen(false);
    },
    [isControlled, onValueChange]
  );

  React.useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const listbox = document.querySelector('[data-cade-select-root="true"]');
      if (listbox && target && !listbox.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open]);

  return (
    <SelectInternalContext.Provider
      value={{
        value: currentValue,
        onValueChange: handleSelect,
        open,
        setOpen,
        labelsMap,
        listboxId,
      }}
    >
      <SelectPrimitive.Root
        value={currentValue}
        onValueChange={handleSelect}
        open={open}
        onOpenChange={setOpen}
      >
        <div className="relative w-full" data-cade-select-root="true">
          {children}
        </div>
      </SelectPrimitive.Root>
    </SelectInternalContext.Provider>
  );
}

export interface SelectTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  hasError?: boolean;
}

export function SelectTrigger({
  className,
  children,
  hasError = false,
  ...props
}: SelectTriggerProps) {
  const { open, setOpen, value, onValueChange, labelsMap, listboxId } = useSelectInternalContext();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && labelsMap.size > 0) {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const keys = Array.from(labelsMap.keys());
      const currentIdx = Math.max(0, keys.indexOf(value));
      const nextIdx =
        event.key === 'ArrowDown'
          ? (currentIdx + 1) % keys.length
          : (currentIdx - 1 + keys.length) % keys.length;
      const nextVal = keys[nextIdx];
      if (nextVal !== undefined) {
        onValueChange(nextVal);
      }
    }
  };

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-haspopup="listbox"
      aria-invalid={hasError || undefined}
      onClick={() => setOpen(!open)}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex min-h-12 w-full items-center justify-between rounded-control border border-input bg-card px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        hasError && 'border-destructive focus-visible:ring-destructive',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

export function SelectValue({ placeholder = 'Seleccionar...' }: { placeholder?: string }) {
  const { value, labelsMap } = useSelectInternalContext();
  const displayLabel = value ? (labelsMap.get(value) ?? value) : '';
  return (
    <span className={cn(!displayLabel && 'text-muted-foreground')}>
      {displayLabel || placeholder}
    </span>
  );
}

export function SelectContent({
  className,
  children,
}: React.HTMLAttributes<HTMLDivElement>) {
  const { open, listboxId } = useSelectInternalContext();
  if (!open) {
    return null;
  }
  return (
    <div
      id={listboxId}
      role="listbox"
      className={cn(
        'absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-control border border-border bg-popover p-1 text-popover-foreground shadow-modal',
        className
      )}
    >
      {children}
    </div>
  );
}

export interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  children: React.ReactNode;
}

export function SelectItem({ value, children, className, ...props }: SelectItemProps) {
  const { value: selectedValue, onValueChange } = useSelectInternalContext();
  const isSelected = selectedValue === value;

  return (
    <button
      type="button"
      role="option"
      aria-selected={isSelected}
      onClick={() => onValueChange(value)}
      className={cn(
        'flex min-h-12 w-full items-center rounded-sm px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected && 'bg-accent text-success font-semibold',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
