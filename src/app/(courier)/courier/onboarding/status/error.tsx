'use client';

import { Card } from '@/ui/card';
import { Button } from '@/ui/button';

export default function CourierStatusError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-6 sm:px-6">
      <Card role="alert" className="space-y-4 p-6 text-center">
        <h2 className="font-display text-lg font-bold text-foreground">
          No pudimos consultar el estado de tu revisión
        </h2>
        <p className="text-sm text-muted-foreground">Verificá tu conexión y volvé a intentar.</p>
        <Button type="button" size="lg" onClick={reset} className="w-full sm:w-auto">
          Reintentar
        </Button>
      </Card>
    </div>
  );
}
