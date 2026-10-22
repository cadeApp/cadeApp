'use client';

import { Button } from '@/ui/button';

export default function LegalError({ reset }: { readonly error: Error & { digest?: string }; readonly reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-[390px] flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-2xl font-bold text-foreground">No pudimos cargar el documento</h1>
      <p className="text-base leading-relaxed text-muted-foreground">
        Podés reintentar. No aceptes un documento que no pudiste consultar.
      </p>
      <Button type="button" size="lg" onClick={reset}>Reintentar</Button>
    </main>
  );
}
