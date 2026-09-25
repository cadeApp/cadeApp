'use client';

import { TripErrorState } from '@/features/trips';

export default function CourierTripError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-4">
      <TripErrorState
        title="No pudimos cargar el viaje"
        message="Ocurrió un error al cargar la información del viaje. Por favor, reintentá."
        onRetry={reset}
      />
    </div>
  );
}
