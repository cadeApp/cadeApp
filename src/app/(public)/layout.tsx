import * as React from 'react';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-background text-foreground">
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="w-full border-t border-border bg-card/40 py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-5xl space-y-2 px-4 sm:px-6">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 font-medium">
            <span className="text-muted-foreground">
              Términos y Privacidad del Piloto (documentos legales en publicación · T-311)
            </span>
          </div>
          <p className="text-sm text-muted-foreground/80">
            Hecho en Aguilares, Tucumán · cadeApp 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
