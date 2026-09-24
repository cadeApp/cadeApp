import * as React from 'react';
import { TopBar } from '@/ui/top-bar';
import { Badge } from '@/ui/badge';
import { MerchantNav } from './merchant-nav';

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[390px] sm:max-w-xl md:max-w-3xl lg:max-w-4xl flex-col bg-background text-foreground">
      <TopBar
        showLogo
        rightAction={
          <Badge variant="published" className="px-2.5 py-0.5 text-xs font-semibold">
            Piloto
          </Badge>
        }
      />
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
      <MerchantNav />
    </div>
  );
}
