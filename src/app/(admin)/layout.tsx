import * as React from 'react';
import { cookies } from 'next/headers';
import { getAdminOperatorName } from '@/features/admin/server';
import { getOpenIncidentsCount } from '@/features/incidents/server';
import { AdminNav } from './admin-nav';

export const metadata = {
  title: 'Administración | cadeApp',
  description: 'Panel de administración y gestión operativa de cadeApp Aguilares',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // T-406: valor inicial del contador de abiertos; después lo actualiza la navegación (D01 = C). Si falla, sigue sin él.
  const [operatorName, cookieStore, initialOpenIncidents] = await Promise.all([
    getAdminOperatorName(),
    cookies(),
    getOpenIncidentsCount(),
  ]);
  // Mismo nombre que ADMIN_SIDEBAR_COOKIE de admin-nav (un módulo cliente no exporta valores al servidor).
  const initialCollapsed = cookieStore.get('admin_sidebar')?.value === 'collapsed';

  return (
    <div className="min-h-screen bg-background text-foreground lg:flex">
      <AdminNav
        operatorName={operatorName}
        initialCollapsed={initialCollapsed}
        initialOpenIncidents={initialOpenIncidents}
      />
      {/* T-402: el contenido ocupa todo el ancho que deja la barra lateral, sin tope. */}
      <main className="w-full min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
