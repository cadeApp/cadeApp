'use client';

import { TripErrorState } from '@/features/trips';

export default function TripError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-4">
      <TripErrorState onRetry={reset} />
    </div>
  );
}
