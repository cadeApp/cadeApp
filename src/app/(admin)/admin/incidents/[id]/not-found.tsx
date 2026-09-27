import * as React from 'react';
import Link from 'next/link';
import { buttonVariants } from '@/ui/button';
import { Card } from '@/ui/card';
import { INCIDENTS_COPY } from '@/features/incidents';

const COPY = INCIDENTS_COPY.errors.notFound;

/** A05: incidente inexistente o id inválido; evita la 404 genérica sin navegación. */
export default function IncidentNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <Card className="space-y-4 p-6 text-center">
        <h1 className="text-lg font-bold text-foreground">{COPY.title}</h1>
        <p className="text-sm text-muted-foreground">{COPY.description}</p>
        <Link href="/admin/incidents" className={buttonVariants({ variant: 'outline' })}>
          {COPY.back}
        </Link>
      </Card>
    </div>
  );
}
