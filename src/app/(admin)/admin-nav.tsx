'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/ui/brand-logo';
import { Button } from '@/ui/button';
import { ADMIN_NAV_TABS } from '@/features/admin';
import { cn } from '@/ui/cn';

export { ADMIN_NAV_TABS };

export function AdminNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[#E4E7EC] bg-white shadow-sm">
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-6">
        <div className="flex items-center gap-8">
          <Link
            href="/admin/applicants"
            aria-label="Panel de Administración cadeApp"
            className="inline-flex items-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <BrandLogo size="md" variant="default" showWordmark={true} />
          </Link>

          <nav aria-label="Navegación principal de administración" className="hidden md:flex items-center gap-1">
            {ADMIN_NAV_TABS.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    'relative px-4 py-5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'text-primary font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
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
          <span className="hidden sm:inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            Admin (Aguilares)
          </span>
          <form action="/login">
            <Button variant="ghost" size="sm" type="submit" className="text-muted-foreground text-sm">
              Salir
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
