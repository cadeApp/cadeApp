'use client';

import Link from 'next/link';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';

export default function ApplicantDetailError({
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
          No pudimos cargar el detalle del postulante
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || 'Ocurrió un inconveniente al consultar la documentación del repartidor.'}
        </p>
        <div className="flex justify-center gap-3">
          <Button type="button" onClick={reset} className="w-full sm:w-auto">
            Reintentar
          </Button>
          <Link href="/admin/applicants">
            <Button variant="outline" type="button" className="w-full sm:w-auto">
              Volver a la cola
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
