'use client';

import * as React from 'react';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ADMIN_TRIPS_COPY } from '@/features/admin-trips';

const COPY = ADMIN_TRIPS_COPY.errors;

/** T-410: error de la lista con copy fijo; nunca muestra el mensaje, el stack ni el digest del error. */
export default function TripsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <Card role="alert" className="space-y-4 p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">{COPY.title}</h2>
        <p className="text-sm text-muted-foreground">{COPY.description}</p>
        <Button type="button" onClick={() => reset()} className="w-full sm:w-auto">
          {COPY.retry}
        </Button>
      </Card>
    </div>
  );
}
