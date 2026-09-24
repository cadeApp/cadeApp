import * as React from 'react';
import { TopBar } from '@/ui/top-bar';
import { CourierNav } from './courier-nav';

export default function CourierLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[390px] sm:max-w-xl md:max-w-2xl lg:max-w-3xl flex-col bg-background text-foreground">
      <TopBar showLogo />
      <style>{`
        header svg[data-variant="inverse"] [fill="#12182C"],
        header svg[data-variant="inverse"] [fill="#1D212F"] {
          fill: #ffffff !important;
        }
        header svg[data-variant="inverse"] [stroke="#12182C"],
        header svg[data-variant="inverse"] [stroke="#1D212F"] {
          stroke: #ffffff !important;
        }
      `}</style>
      <main className="flex-1 pb-20">{children}</main>
      <CourierNav />
    </div>
  );
}
