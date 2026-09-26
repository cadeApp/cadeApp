import * as React from 'react';
import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-background text-foreground">
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="w-full border-t border-border bg-card/40 py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-5xl space-y-2 px-4 sm:px-6">
          <nav aria-label="Documentos legales" className="flex flex-wrap justify-center gap-x-2 gap-y-1 font-medium">
            <Link href="/legal/terms" className="inline-flex min-h-12 items-center px-2 py-1 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Términos</Link>
            <Link href="/legal/privacy" className="inline-flex min-h-12 items-center px-2 py-1 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Privacidad</Link>
            <Link href="/legal/courier" className="inline-flex min-h-12 items-center px-2 py-1 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Repartidores</Link>
            <Link href="/legal/pilot" className="inline-flex min-h-12 items-center px-2 py-1 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Piloto</Link>
          </nav>
          <p className="text-sm text-muted-foreground">Hecho en Aguilares, Tucumán · cadeApp 2026</p>
        </div>
      </footer>
    </div>
  );
}
