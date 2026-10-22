'use client';

import { Card } from '@/ui/card';
import { Button } from '@/ui/button';
import { ADMIN_COPY } from '@/features/admin';

export default function MerchantsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card role="alert" className="space-y-4 p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">{ADMIN_COPY.errors.merchants.title}</h2>
        <p className="text-sm text-muted-foreground">{ADMIN_COPY.errors.merchants.description}</p>
        <Button type="button" onClick={reset} className="w-full sm:w-auto">
          {ADMIN_COPY.errors.merchants.retry}
        </Button>
      </Card>
    </div>
  );
}
