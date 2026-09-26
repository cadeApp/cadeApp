import * as React from 'react';
import { AdminNav } from './admin-nav';
import { Toaster } from '@/ui/toaster';

export const metadata = {
  title: 'Administración | cadeApp',
  description: 'Panel de administración y gestión operativa de cadeApp Aguilares',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <AdminNav />
      <main className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 lg:p-8">
        {children}
      </main>
      <Toaster />
    </div>
  );
}
