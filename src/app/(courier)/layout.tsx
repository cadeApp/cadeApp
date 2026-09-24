import * as React from 'react';
import { CourierNav } from './courier-nav';

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1">{children}</main>
      <CourierNav />
    </div>
  );
}
