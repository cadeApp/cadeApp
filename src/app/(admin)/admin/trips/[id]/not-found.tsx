import * as React from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/ui/button';
import { Card } from '@/ui/card';
import { ADMIN_TRIPS_COPY } from '@/features/admin-trips';

const COPY = ADMIN_TRIPS_COPY.detail;

/** T-410: viaje inexistente, borrador o id inválido; evita la 404 genérica sin navegación. */
export default function TripNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <Card className="space-y-4 p-6 text-center">
        <h1 className="text-lg font-bold text-foreground">{COPY.notFoundTitle}</h1>
        <p className="text-sm text-muted-foreground">{COPY.notFoundDescription}</p>
        <Link href="/admin/trips" className={buttonVariants({ variant: 'outline' })}>
          {COPY.back}
        </Link>
      </Card>
    </div>
  );
}
