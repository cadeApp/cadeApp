'use client';

import Link from 'next/link';
import { Card } from '@/ui/card';
import { Button } from '@/ui/button';
import { ADMIN_COPY } from '@/features/admin';

export default function ApplicantDetailError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <Card role="alert" className="space-y-4 p-6 text-center">
        <h2 className="text-lg font-bold text-foreground">
          {ADMIN_COPY.errors.detail.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {ADMIN_COPY.errors.detail.description}
        </p>
        <div className="flex justify-center gap-3">
          <Button type="button" onClick={reset} className="w-full sm:w-auto">
            {ADMIN_COPY.errors.detail.retry}
          </Button>
          <Link href="/admin/applicants">
            <Button variant="outline" type="button" className="w-full sm:w-auto">
              {ADMIN_COPY.errors.detail.back}
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
