import * as React from 'react';
import { TopBar } from '@/ui/top-bar';
import { Badge } from '@/ui/badge';
import { CourierNav } from './courier-nav';

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-foreground">
      <TopBar
        logoHref="/courier/feed"
        rightAction={
          <Badge variant="published" className="px-2.5 py-0.5 text-sm font-semibold">
            Repartidor
          </Badge>
        }
      />

      <main className="mx-auto w-full max-w-[390px] flex-1 pb-20 sm:max-w-2xl md:max-w-4xl lg:max-w-5xl">
        {children}
      </main>
      <CourierNav />
    </div>
  );
}
