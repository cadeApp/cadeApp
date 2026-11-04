'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  LogOut,
  Megaphone,
  Menu,
  Route,
  ScrollText,
  SlidersHorizontal,
  Store,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { BrandLogo } from '@/ui/brand-logo';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/ui/sheet';
import { ADMIN_COPY, ADMIN_NAV_TABS } from '@/features/admin';
import { cn } from '@/ui/cn';
import { logoutAction } from '@/features/auth';

export { ADMIN_NAV_TABS };

type AdminNavHref = (typeof ADMIN_NAV_TABS)[number]['href'];

const NAV_ICONS: Record<AdminNavHref, LucideIcon> = {
  '/admin/applicants': Users,
  '/admin/merchants': Store,
  '/admin/trips': Route,
  '/admin/incidents': AlertTriangle,
  '/admin/announcements': Megaphone,
  '/admin/settings': SlidersHorizontal,
  '/admin/audit': ScrollText,
};

const FOCUS_ON_INK =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-secondary';

const ITEM_CLASS = 'flex min-h-12 items-center gap-3 rounded-lg px-3 text-sm font-medium';

export interface AdminNavProps {
  readonly operatorName: string;
}

/**
 * T-402: shell del admin. En escritorio (≥ lg) barra lateral fija en tinta; en angosto, barra superior con «Menú» que
 * abre la misma navegación en un Sheet. Ninguna sección queda inaccesible en ningún ancho.
 */
export function AdminNav({ operatorName }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);

  async function handleLogout() {
    await logoutAction();
    router.push('/login');
    router.refresh();
  }

  const brand = (
    <Link
      href="/admin/applicants"
      aria-label={ADMIN_COPY.nav.brandLabel}
      className={cn('inline-flex items-center rounded-sm', FOCUS_ON_INK)}
    >
      <BrandLogo size="md" variant="inverse" showWordmark={true} />
    </Link>
  );

  function navList(onNavigate?: () => void) {
    return (
      <nav aria-label={ADMIN_COPY.nav.ariaLabel}>
        <ul className="space-y-1">
          {ADMIN_NAV_TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = NAV_ICONS[tab.href];
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    ITEM_CLASS,
                    FOCUS_ON_INK,
                    isActive
                      ? 'bg-primary font-semibold text-primary-foreground'
                      : 'text-secondary-foreground hover:bg-secondary-foreground/10'
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  const footer = (
    <div className="space-y-3 border-t border-secondary-foreground/20 pt-4">
      <div>
        <p className="truncate text-sm font-semibold text-secondary-foreground">{operatorName}</p>
        <p className="text-sm text-secondary-foreground/80">{ADMIN_COPY.nav.badgeText}</p>
      </div>
      <button
        type="button"
        onClick={handleLogout}
        className={cn(ITEM_CLASS, 'w-full text-secondary-foreground hover:bg-secondary-foreground/10', FOCUS_ON_INK)}
      >
        <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
        {ADMIN_COPY.nav.logoutButton}
      </button>
    </div>
  );

  return (
    <>
      <aside className="hidden bg-secondary text-secondary-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-64 lg:shrink-0 lg:flex-col lg:gap-6 lg:overflow-y-auto lg:p-4">
        <div className="px-2 pt-2">{brand}</div>
        <div className="flex-1">{navList()}</div>
        {footer}
      </aside>

      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-secondary px-4 text-secondary-foreground lg:hidden">
        {brand}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger
            aria-expanded={menuOpen}
            className={cn(
              'inline-flex min-h-12 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-secondary-foreground hover:bg-secondary-foreground/10',
              FOCUS_ON_INK
            )}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
            {ADMIN_COPY.nav.menuButton}
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex flex-col gap-6 overflow-y-auto border-secondary bg-secondary text-secondary-foreground"
          >
            <SheetTitle className="text-secondary-foreground">{ADMIN_COPY.nav.menuTitle}</SheetTitle>
            {navList(() => setMenuOpen(false))}
            {footer}
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
