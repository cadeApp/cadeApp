'use client';

import * as React from 'react';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';
import type { VehicleType } from '@/domain/schemas';
import { COURIER_VEHICLES_COPY, setActiveCourierVehicleAction } from '@/features/courier-onboarding';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { notify } from '@/ui/notify';

export interface VehicleQuickSwitchProps {
  readonly activeVehicleId: string | null;
  readonly vehicles: readonly { readonly id: string; readonly vehicleType: VehicleType; readonly plate: string | null }[];
}

/**
 * CC-042 / T-419: cambio rápido del vehículo activo junto a «Disponible». Con ofertas pendientes o un viaje activo la
 * RPC lo rechaza y el motivo queda en pantalla.
 */
export function VehicleQuickSwitch({ activeVehicleId, vehicles }: VehicleQuickSwitchProps) {
  const router = useRouter();
  const [activeId, setActiveId] = React.useState(activeVehicleId);
  const [error, setError] = React.useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (vehicles.length < 2) return null;

  const choose = (vehicleId: string) => {
    if (vehicleId === activeId) return;
    setError(null);
    startTransition(async () => {
      const result = await setActiveCourierVehicleAction({ vehicleId });
      if (!result.ok) {
        setError(getDomainErrorMessage(result.code));
        return;
      }
      setActiveId(result.data.activeVehicleId);
      notify.success(COURIER_VEHICLES_COPY.switched);
      router.refresh();
    });
  };

  return (
    <Card className="flex flex-col gap-3 p-4 shadow-sm">
      <p className="font-display text-base font-bold text-foreground">{COURIER_VEHICLES_COPY.quickSwitchLabel}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={COURIER_VEHICLES_COPY.quickSwitchAria}>
        {vehicles.map((vehicle) => (
          <Button
            key={vehicle.id}
            type="button"
            role="radio"
            aria-checked={vehicle.id === activeId}
            variant={vehicle.id === activeId ? 'default' : 'outline'}
            size="sm"
            disabled={isPending}
            onClick={() => choose(vehicle.id)}
          >
            {COURIER_VEHICLES_COPY.types[vehicle.vehicleType]}
            {vehicle.plate ? ` · ${vehicle.plate}` : ''}
          </Button>
        ))}
      </div>
      {error && (
        <div role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}
    </Card>
  );
}
