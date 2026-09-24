import * as React from 'react';
import Link from 'next/link';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-background text-foreground">
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="w-full border-t border-border bg-card/40 py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-5xl space-y-2 px-4 sm:px-6">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 font-medium">
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Términos
            </Link>
            <span>·</span>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              Privacidad
            </Link>
            <span>·</span>
            <Link href="/terms" className="transition-colors hover:text-foreground">
              Términos del piloto
            </Link>
          </div>
          <p className="text-xs text-muted-foreground/80 sm:text-sm">
            Hecho en Aguilares, Tucumán · cadeApp 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
