'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { Card } from '@/ui/card';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { AVAILABILITY_COPY } from '../copy';
import { setAvailabilityAction } from '../actions';

export interface AvailabilitySwitchProps {
  initialAvailable: boolean;
  onAvailabilityChange?: (available: boolean) => void;
}

export function AvailabilitySwitch({
  initialAvailable,
  onAvailabilityChange,
}: AvailabilitySwitchProps) {
  const [available, setAvailable] = React.useState(initialAvailable);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const nextState = !available;
    // Actualización optimista en cliente
    setAvailable(nextState);

    startTransition(async () => {
      const [result, { notify }] = await Promise.all([
        setAvailabilityAction({ available: nextState }),
        import('@/ui/notify'),
      ]);
      if (!result.ok) {
        // Rollback al estado anterior si falla
        setAvailable(!nextState);
        notify.error(getDomainErrorMessage(result.code));
      } else {
        onAvailabilityChange?.(nextState);
        if (nextState) {
          notify.success(AVAILABILITY_COPY.successAvailable);
        } else {
          notify.info(AVAILABILITY_COPY.successUnavailable);
        }
      }
    });
  };

  return (
    <Card className="p-4 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <p className="font-display text-base font-bold text-foreground">
            {available ? AVAILABILITY_COPY.titleAvailable : AVAILABILITY_COPY.titleUnavailable}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {available ? AVAILABILITY_COPY.hintAvailable : AVAILABILITY_COPY.hintUnavailable}
          </p>
        </div>

        {/* Botón interactivo tipo switch con target >= 48x48px (min-h-12 min-w-12) */}
        <button
          type="button"
          role="switch"
          aria-checked={available}
          aria-label={AVAILABILITY_COPY.toggleAriaLabel}
          disabled={isPending}
          onClick={handleToggle}
          className="relative inline-flex min-h-12 min-w-12 items-center justify-center rounded-full p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <span
            className={`inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
              available ? 'bg-primary' : 'bg-muted'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                available ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </span>
        </button>
      </div>
    </Card>
  );
}
