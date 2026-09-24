'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav, type BottomNavItem } from '@/ui/bottom-nav';
import { Store, History, User } from 'lucide-react';

export function MerchantNav() {
  const pathname = usePathname();

  // No mostrar la barra de navegación durante el onboarding de comercio
  if (pathname.startsWith('/merchant/onboarding') || pathname === '/onboarding') {
    return null;
  }

  const navItems: readonly BottomNavItem[] = [
    {
      id: 'dashboard',
      label: 'Inicio',
      href: '/merchant/dashboard',
      icon: <Store className="h-5 w-5" aria-hidden="true" />,
      active:
        pathname === '/merchant/dashboard' ||
        pathname === '/merchant' ||
        pathname === '/merchant/requests' ||
        pathname.startsWith('/merchant/requests'),
    },
    {
      id: 'history',
      label: 'Historial',
      href: '/merchant/history',
      icon: <History className="h-5 w-5" aria-hidden="true" />,
      active: pathname === '/merchant/history',
    },
    {
      id: 'plan',
      label: 'Cuenta',
      href: '/merchant/plan',
      icon: <User className="h-5 w-5" aria-hidden="true" />,
      active: pathname === '/merchant/plan',
    },
  ];

  return <BottomNav items={navItems} />;
}
