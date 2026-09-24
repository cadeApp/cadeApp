'use client';

import { Card } from '@/ui/card';
import { Button } from '@/ui/button';

export default function CourierFeedError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <Card role="alert" className="space-y-4 p-6 text-center">
        <h2 className="font-display text-lg font-bold text-foreground">
          No pudimos actualizar las solicitudes abiertas
        </h2>
        <p className="text-sm text-muted-foreground">
          Comprobá tu conexión e intentá nuevamente.
        </p>
        <Button type="button" size="lg" onClick={reset} className="w-full sm:w-auto">
          Reintentar
        </Button>
      </Card>
    </div>
  );
}
