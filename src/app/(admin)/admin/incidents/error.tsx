'use client';

import * as React from 'react';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { INCIDENTS_COPY } from '@/features/incidents';

const COPY = INCIDENTS_COPY.errors.inbox;

/** A05: error de la bandeja con copy fijo; nunca muestra el mensaje, el stack ni el digest del error. */
export default function IncidentsError({
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
