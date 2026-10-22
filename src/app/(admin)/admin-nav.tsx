'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandLogo } from '@/ui/brand-logo';
import { Button } from '@/ui/button';
import { ADMIN_COPY, ADMIN_NAV_TABS } from '@/features/admin';
import { cn } from '@/ui/cn';
import { logoutAction } from '@/features/auth';

export { ADMIN_NAV_TABS };

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await logoutAction();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card shadow-sm">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/admin/applicants"
            aria-label={ADMIN_COPY.nav.brandLabel}
            className="inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo size="md" variant="default" showWordmark={true} />
          </Link>

          <nav aria-label={ADMIN_COPY.nav.ariaLabel} className="hidden items-center gap-1 md:flex">
            {ADMIN_NAV_TABS.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'relative px-4 py-5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'font-semibold text-primary after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden rounded-full bg-muted px-3 py-1 text-sm font-medium text-muted-foreground sm:inline-block">
            {ADMIN_COPY.nav.badgeText}
          </span>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            onClick={handleLogout}
            className="text-sm text-muted-foreground"
          >
            {ADMIN_COPY.nav.logoutButton}
          </Button>
        </div>
      </div>
    </header>
  );
}
