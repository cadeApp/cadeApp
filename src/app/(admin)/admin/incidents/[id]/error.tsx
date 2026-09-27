'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@/ui/button';
import { Card } from '@/ui/card';
import { cn } from '@/ui/cn';
import { INCIDENTS_COPY } from '@/features/incidents';

const COPY = INCIDENTS_COPY.errors.detail;

/** A05: error del detalle con copy fijo; nunca muestra el mensaje, el stack ni el digest del error. */
export default function IncidentDetailError({
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
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button type="button" onClick={() => reset()}>
            {COPY.retry}
          </Button>
          <Link href="/admin/incidents" className={cn(buttonVariants({ variant: 'outline' }))}>
            {COPY.back}
          </Link>
        </div>
      </Card>
    </div>
  );
}
