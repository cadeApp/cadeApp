'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { BottomNav, type BottomNavItem } from '@/ui/bottom-nav';
import { Radio, Inbox, User } from 'lucide-react';

export function CourierNav() {
  const pathname = usePathname();

  const navItems: readonly BottomNavItem[] = [
    {
      id: 'feed',
      label: 'Solicitudes',
      href: '/courier/feed',
      icon: <Radio className="h-5 w-5" aria-hidden="true" />,
      active: pathname === '/courier/feed' || pathname === '/courier' || pathname === '/feed',
    },
    {
      id: 'offers',
      label: 'Mis ofertas',
      href: '/courier/offers',
      icon: <Inbox className="h-5 w-5" aria-hidden="true" />,
      active: pathname === '/courier/offers' || pathname === '/offers',
    },
    {
      id: 'profile',
      label: 'Perfil',
      href: '/courier/profile',
      icon: <User className="h-5 w-5" aria-hidden="true" />,
      active: pathname === '/courier/profile' || pathname === '/profile',
    },
  ];

  return <BottomNav items={navItems} />;
}
