'use client';

import * as React from 'react';
import { useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { ActionResult, DomainErrorCode } from '@/domain/errors';
import type { RpcOutput } from '@/domain/rpc-contracts';
import type { DocumentReviewStatus, VehicleType } from '@/domain/schemas';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Input } from '@/ui/input';
import { notify } from '@/ui/notify';
import {
  addCourierVehicleAction,
  removeCourierVehicleAction,
  setActiveCourierVehicleAction,
  updateCourierVehiclePlateAction,
} from '../actions';
import { COURIER_ONBOARDING_COPY, COURIER_VEHICLES_COPY } from '../copy';
import { ARGENTINA_PLATE_REGEX } from '../schemas';
import { DocumentReplacementCard } from './document-replacement-card';

type CourierVehicles = RpcOutput<'get_my_courier_vehicles'>;
type CourierVehicle = CourierVehicles['vehicles'][number];

const VEHICLE_TYPES: readonly VehicleType[] = ['moto', 'car', 'bike', 'walk'];

function needsPlate(type: VehicleType): boolean {
  return type === 'moto' || type === 'car';
}

function documentStatusLabel(status: DocumentReviewStatus): string {
  switch (status) {
    case 'verified':
      return 'Verificado';
    case 'submitted':
      return 'En revisión';
    case 'rejected':
      return COURIER_ONBOARDING_COPY.rejectedBadge;
    default:
      return 'Sin cargar';
  }
}

export interface CourierVehiclesManagerProps {
  readonly courierId: string;
  readonly vehicles: CourierVehicles;
}

/**
 * CC-042 / T-419: lista de vehículos del repartidor. Agrega, edita la patente, quita y elige el activo; la licencia y el
 * seguro se cargan por vehículo (solo moto y auto). Todo pasa por las RPC; la página se refresca con el resultado.
 */
export function CourierVehiclesManager({ courierId, vehicles }: CourierVehiclesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [plateDraft, setPlateDraft] = React.useState('');

  const loadedTypes = new Set(vehicles.vehicles.map((vehicle) => vehicle.vehicleType));
  const availableTypes = VEHICLE_TYPES.filter((type) => !loadedTypes.has(type));
  const [chosenType, setNewType] = React.useState<VehicleType | null>(null);
  // Después de agregar, el tipo elegido puede quedar cargado: se pasa al primero libre.
  const newType = chosenType && availableTypes.includes(chosenType) ? chosenType : (availableTypes[0] ?? null);
  const [newPlate, setNewPlate] = React.useState('');
  const [makeActive, setMakeActive] = React.useState(false);

  const run = (action: () => Promise<ActionResult<unknown, DomainErrorCode>>, success: string, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        // El aviso queda en la pantalla (no solo en el toast): por ejemplo, por qué no se puede cambiar de vehículo.
        setError(getDomainErrorMessage(result.code));
        return;
      }
      notify.success(success);
      after?.();
      router.refresh();
    });
  };

  const newPlateValid = newType === null || !needsPlate(newType) || ARGENTINA_PLATE_REGEX.test(newPlate.trim());
  const draftPlateValid = ARGENTINA_PLATE_REGEX.test(plateDraft.trim());

  const handleAdd = (event: React.FormEvent) => {
    event.preventDefault();
    if (newType === null || !newPlateValid) return;
    run(
      () =>
        addCourierVehicleAction({
          vehicleType: newType,
          plate: needsPlate(newType) ? newPlate.trim().toUpperCase() : null,
          makeActive,
        }),
      COURIER_VEHICLES_COPY.added,
      () => {
        setNewPlate('');
        setMakeActive(false);
      }
    );
  };

  const renderVehicle = (vehicle: CourierVehicle) => {
    const isActive = vehicle.id === vehicles.activeVehicleId;
    const isEditing = editingId === vehicle.id;
    const label = COURIER_VEHICLES_COPY.types[vehicle.vehicleType];

    return (
      <Card key={vehicle.id} className="flex flex-col gap-4 p-4" data-testid={`courier-vehicle-${vehicle.vehicleType}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-display text-base font-bold text-foreground">{label}</p>
            <p className="text-sm text-muted-foreground">{vehicle.plate ?? COURIER_VEHICLES_COPY.noPlate}</p>
          </div>
          {isActive ? (
            <Badge variant="verified" className="text-sm">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {COURIER_VEHICLES_COPY.activeBadge}
            </Badge>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() =>
                run(() => setActiveCourierVehicleAction({ vehicleId: vehicle.id }), COURIER_VEHICLES_COPY.switched)
              }
            >
              {COURIER_VEHICLES_COPY.useThis}
            </Button>
          )}
        </div>

        {needsPlate(vehicle.vehicleType) && isEditing && (
          <div className="flex flex-col gap-2">
            <label htmlFor={`plate-${vehicle.id}`} className="text-sm font-medium text-foreground">
              {COURIER_VEHICLES_COPY.plateLabel}
            </label>
            <Input
              id={`plate-${vehicle.id}`}
              value={plateDraft}
              onChange={(event) => setPlateDraft(event.target.value)}
              placeholder={COURIER_ONBOARDING_COPY.platePlaceholder}
              autoCapitalize="characters"
            />
            <p className="text-sm text-muted-foreground">{COURIER_VEHICLES_COPY.plateInsuranceNotice}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                disabled={isPending || !draftPlateValid}
                onClick={() =>
                  run(
                    () =>
                      updateCourierVehiclePlateAction({ vehicleId: vehicle.id, plate: plateDraft.trim().toUpperCase() }),
                    COURIER_VEHICLES_COPY.plateSaved,
                    () => setEditingId(null)
                  )
                }
              >
                {COURIER_VEHICLES_COPY.savePlate}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                {COURIER_VEHICLES_COPY.cancel}
              </Button>
            </div>
          </div>
        )}

        {!isEditing && (
          <div className="flex flex-wrap gap-2">
            {needsPlate(vehicle.vehicleType) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingId(vehicle.id);
                  setPlateDraft(vehicle.plate ?? '');
                }}
              >
                {COURIER_VEHICLES_COPY.editPlate}
              </Button>
            )}
            {!isActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  run(() => removeCourierVehicleAction({ vehicleId: vehicle.id }), COURIER_VEHICLES_COPY.removed)
                }
              >
                {COURIER_VEHICLES_COPY.remove}
              </Button>
            )}
          </div>
        )}

        {needsPlate(vehicle.vehicleType) && (
          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p className="text-sm font-semibold text-foreground">{COURIER_VEHICLES_COPY.documentsTitle}</p>
            {(
              [
                ['license', COURIER_ONBOARDING_COPY.licenseTitle, vehicle.licenseStatus],
                ['insurance', COURIER_ONBOARDING_COPY.insuranceTitle, vehicle.insuranceStatus],
              ] as const
            ).map(([kind, title, status]) => (
              <div key={kind} className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">
                  {title}: {documentStatusLabel(status)}
                </p>
                {(status === 'none' || status === 'rejected') && (
                  <DocumentReplacementCard
                    courierId={courierId}
                    kind={kind}
                    title={title}
                    initialStatus={status}
                    mode={status === 'none' ? 'add' : 'replace'}
                    vehicleId={vehicle.id}
                    onReplaced={() => router.refresh()}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4">
      <section className="flex flex-col gap-1.5">
        <h1 className="font-display text-xl font-bold text-foreground">{COURIER_VEHICLES_COPY.title}</h1>
        <p className="text-sm text-muted-foreground">{COURIER_VEHICLES_COPY.subtitle}</p>
      </section>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {vehicles.vehicles.map(renderVehicle)}

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-display text-base font-bold text-foreground">{COURIER_VEHICLES_COPY.addTitle}</h2>
        {newType === null ? (
          <p className="text-sm text-muted-foreground">{COURIER_VEHICLES_COPY.allTypesLoaded}</p>
        ) : (
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={COURIER_VEHICLES_COPY.addTitle}>
              {availableTypes.map((type) => (
                <Button
                  key={type}
                  type="button"
                  role="radio"
                  aria-checked={newType === type}
                  variant={newType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setNewType(type)}
                >
                  {COURIER_VEHICLES_COPY.types[type]}
                </Button>
              ))}
            </div>
            {needsPlate(newType) && (
              <div className="flex flex-col gap-2">
                <label htmlFor="new-vehicle-plate" className="text-sm font-medium text-foreground">
                  {COURIER_VEHICLES_COPY.plateLabel}
                </label>
                <Input
                  id="new-vehicle-plate"
                  value={newPlate}
                  onChange={(event) => setNewPlate(event.target.value)}
                  placeholder={COURIER_ONBOARDING_COPY.platePlaceholder}
                  autoCapitalize="characters"
                />
              </div>
            )}
            <label className="flex min-h-12 items-center gap-3 text-sm text-foreground">
              <input type="checkbox" checked={makeActive} onChange={(event) => setMakeActive(event.target.checked)} />
              {COURIER_VEHICLES_COPY.addActiveLabel}
            </label>
            <Button type="submit" disabled={isPending || !newPlateValid}>
              {COURIER_VEHICLES_COPY.addButton}
            </Button>
          </form>
        )}
      </Card>

      <Link
        href="/courier/profile"
        className="text-center text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >
        {COURIER_VEHICLES_COPY.backToProfile}
      </Link>
    </div>
  );
}
