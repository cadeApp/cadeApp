import * as React from 'react';
import { cn } from './cn';

export interface BottomNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  active?: boolean;
}

export interface BottomNavProps extends React.HTMLAttributes<HTMLElement> {
  items: readonly BottomNavItem[];
  onNavigate?: (item: BottomNavItem) => void;
}

/**
 * Navegación inferior móvil (`BottomNav`) con objetivos táctiles >= 48x48px (`min-h-12 min-w-12`),
 * piso tipográfico de 14px (`text-sm`) y soporte de `safe-area-inset-bottom`.
 */
export function BottomNav({ items, onNavigate, className, ...props }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className={cn(
        'safe-area-bottom sticky bottom-0 z-40 w-full border-t border-border bg-card',
        className
      )}
      {...props}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-1">
            <a
              href={item.href}
              aria-current={item.active ? 'page' : undefined}
              onClick={(e) => {
                if (onNavigate) {
                  e.preventDefault();
                  onNavigate(item);
                }
              }}
              className={cn(
                'flex min-h-12 min-w-12 flex-1 flex-col items-center justify-center gap-1 py-1.5 font-sans text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                item.active ? 'text-primary-dark' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span aria-hidden="true" className="inline-flex h-5 w-5 items-center justify-center">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
