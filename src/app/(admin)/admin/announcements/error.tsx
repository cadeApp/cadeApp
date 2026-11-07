'use client';

import * as React from 'react';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ANNOUNCEMENTS_COPY } from '@/features/announcements';

const COPY = ANNOUNCEMENTS_COPY.admin;

/** T-414: error de Novedades con copy fijo; nunca muestra el mensaje, el stack ni el digest del error. */
export default function AnnouncementsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl py-8">
      <Card role="alert" className="space-y-4 p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">{COPY.errorTitle}</h2>
        <p className="text-sm text-muted-foreground">{COPY.errorDescription}</p>
        <Button type="button" onClick={() => reset()} className="w-full sm:w-auto">
          {COPY.retry}
        </Button>
      </Card>
    </div>
  );
}
