'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/tooltip';
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

/** T-427: preferencia de la barra contraída; la lee el layout (servidor) para que la recarga no parpadee. */
export const ADMIN_SIDEBAR_COOKIE = 'admin_sidebar';

export interface AdminNavProps {
  readonly operatorName: string;
  readonly initialCollapsed?: boolean;
}

/**
 * T-402: shell del admin. En escritorio (≥ lg) barra lateral fija en tinta; en angosto, barra superior con «Menú» que
 * abre la misma navegación en un Sheet. Ninguna sección queda inaccesible en ningún ancho.
 * T-425: en escritorio la barra se contrae a solo íconos (nombre en tooltip) y el logo queda en la moto.
 */
export function AdminNav({ operatorName, initialCollapsed = false }: AdminNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${ADMIN_SIDEBAR_COOKIE}=${next ? 'collapsed' : 'expanded'}; path=/admin; max-age=31536000; samesite=lax`;
  }

  async function handleLogout() {
    await logoutAction();
    router.push('/login');
    router.refresh();
  }

  function brand(showWordmark = true) {
    return (
      <Link
        href="/admin/applicants"
        aria-label={ADMIN_COPY.nav.brandLabel}
        className={cn('inline-flex items-center rounded-sm', FOCUS_ON_INK)}
      >
        <BrandLogo size="md" variant="inverse" showWordmark={showWordmark} className={showWordmark ? undefined : 'h-auto w-10'} />
      </Link>
    );
  }

  // Contraída, el texto queda para lectores de pantalla y el nombre se ve en el tooltip.
  function withTooltip(label: string, item: React.ReactElement, iconOnly: boolean) {
    if (!iconOnly) return item;
    return (
      <Tooltip>
        <TooltipTrigger asChild>{item}</TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
    );
  }

  function navList(onNavigate?: () => void, iconOnly = false) {
    return (
      <nav aria-label={ADMIN_COPY.nav.ariaLabel}>
        <ul className="space-y-1">
          {ADMIN_NAV_TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            const Icon = NAV_ICONS[tab.href];
            return (
              <li key={tab.href}>
                {withTooltip(
                  tab.label,
                  <Link
                    href={tab.href}
                    onClick={onNavigate}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      ITEM_CLASS,
                      FOCUS_ON_INK,
                      iconOnly && 'justify-center',
                      isActive
                        ? 'bg-primary font-semibold text-primary-foreground'
                        : 'text-secondary-foreground hover:bg-secondary-foreground/10'
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className={cn(iconOnly && 'sr-only')}>{tab.label}</span>
                  </Link>,
                  iconOnly
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  function footer(iconOnly = false) {
    return (
      <div className="space-y-3 border-t border-secondary-foreground/20 pt-4">
        <div className={cn(iconOnly && 'sr-only')}>
          <p className="truncate text-sm font-semibold text-secondary-foreground">{operatorName}</p>
          <p className="text-sm text-secondary-foreground/80">{ADMIN_COPY.nav.badgeText}</p>
        </div>
        {withTooltip(
          ADMIN_COPY.nav.logoutButton,
          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              ITEM_CLASS,
              'w-full text-secondary-foreground hover:bg-secondary-foreground/10',
              iconOnly && 'justify-center',
              FOCUS_ON_INK
            )}
          >
            <LogOut className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={cn(iconOnly && 'sr-only')}>{ADMIN_COPY.nav.logoutButton}</span>
          </button>,
          iconOnly
        )}
      </div>
    );
  }

  const toggleLabel = collapsed ? ADMIN_COPY.nav.expandSidebar : ADMIN_COPY.nav.collapseSidebar;
  const ToggleIcon = collapsed ? ChevronRight : ChevronLeft;

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <aside
          className={cn(
            'relative hidden bg-secondary text-secondary-foreground lg:sticky lg:top-0 lg:z-30 lg:flex lg:h-screen lg:shrink-0',
            collapsed ? 'lg:w-20' : 'lg:w-64'
          )}
        >
          {/* El scroll va adentro para que el botón redondo pueda asomar sobre el borde con el contenido. */}
          <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-4">
            <div className={cn('pt-2', collapsed ? 'flex justify-center' : 'px-2')}>{brand(!collapsed)}</div>
            <div className="flex-1">{navList(undefined, collapsed)}</div>
            {footer(collapsed)}
          </div>
          {withTooltip(
            toggleLabel,
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={!collapsed}
              aria-label={toggleLabel}
              className={cn(
                // T-427: chico y redondo sobre el borde; el pseudo-elemento agranda el área para tocarlo.
                'absolute -right-3 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-md transition-colors hover:bg-muted before:absolute before:-inset-3',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
              )}
            >
              <ToggleIcon className="h-4 w-4" aria-hidden="true" />
            </button>,
            true
          )}
        </aside>
      </TooltipProvider>

      <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between bg-secondary px-4 text-secondary-foreground lg:hidden">
        {brand()}
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
            {footer()}
          </SheetContent>
        </Sheet>
      </header>
    </>
  );
}
