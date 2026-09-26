'use client';

import { Card } from '@/ui/card';
import { Button } from '@/ui/button';

export default function ApplicantsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card role="alert" className="space-y-4 p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">
          No pudimos cargar la cola de postulantes
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'Ocurrió un inconveniente al consultar la base de datos de repartidores.'}
        </p>
        <Button type="button" onClick={reset} className="w-full sm:w-auto">
          Reintentar
        </Button>
      </Card>
    </div>
  );
}
