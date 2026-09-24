'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  ShieldCheck,
  Car,
  Bike,
  Footprints,
  Bell,
  FileText,
  LogOut,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { Card } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Button, buttonVariants } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { BrandLogo } from '@/ui/brand-logo';
import { cn } from '@/ui/cn';
import { logoutAction } from '@/features/auth';

export interface CourierProfileData {
  readonly displayName: string;
  readonly email: string;
  readonly vehicleType: string | null;
  readonly plate: string | null;
  readonly dniStatus: string;
  readonly selfieStatus: string;
  readonly licenseStatus: string;
  readonly insuranceStatus: string;
  readonly courierStatus: string;
}

function getVehicleInfo(type: string | null) {
  switch (type) {
    case 'moto':
    case 'motorcycle':
      return {
        label: 'Motocicleta',
        icon: <BrandLogo showWordmark={false} className="h-6 w-auto" />,
      };
    case 'auto':
    case 'car':
      return { label: 'Automóvil', icon: <Car className="h-5 w-5" aria-hidden="true" /> };
    case 'bici':
    case 'bike':
      return { label: 'Bicicleta', icon: <Bike className="h-5 w-5" aria-hidden="true" /> };
    case 'walk':
      return { label: 'A pie', icon: <Footprints className="h-5 w-5" aria-hidden="true" /> };
    default:
      return { label: 'Sin vehículo declarado', icon: <User className="h-5 w-5" aria-hidden="true" /> };
  }
}

function getCourierStatusBadge(status: string) {
  switch (status) {
    case 'active':
    case 'enabled':
    case 'approved':
      return (
        <Badge variant="verified" className="text-sm">
          Habilitado para operar
        </Badge>
      );
    case 'pending':
    case 'pending_review':
      return (
        <Badge variant="pending" className="text-sm">
          En revisión administrativa
        </Badge>
      );
    case 'rejected':
    case 'suspended':
      return (
        <Badge variant="rejected" className="text-sm">
          Requiere atención
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-sm">
          Estado sin confirmar
        </Badge>
      );
  }
}

function getDocStatusBadge(status: string) {
  switch (status) {
    case 'valid':
    case 'approved':
      return (
        <Badge variant="verified" className="text-sm">
          Validado por admin
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="pending" className="text-sm">
          En revisión
        </Badge>
      );
    case 'rejected':
      return (
        <Badge variant="rejected" className="text-sm">
          Observado
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-sm text-muted-foreground">
          No cargado
        </Badge>
      );
  }
}

export function CourierProfileView({ profile }: { profile: CourierProfileData | null }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logoutAction();
      router.push('/login');
    } catch {
      setIsLoggingOut(false);
    }
  };

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Mi perfil
          </h1>
          <p className="text-sm text-muted-foreground">
            Estado de tu cuenta, vehículo y documentación.
          </p>
        </div>

        <EmptyState
          icon={<User className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="Todavía no completaste tu legajo de repartidor"
          description="Subí tu documento, selfie y tipo de movilidad para iniciar la revisión."
          action={
            <Link
              href="/courier/onboarding/identity"
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full sm:w-auto')}
            >
              Completar legajo
            </Link>
          }
        />

        <div className="pt-2">
          <Button
            variant="outline"
            size="lg"
            disabled={isLoggingOut}
            onClick={handleLogout}
            className="w-full gap-2 border-destructive/30 font-display text-base font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
          </Button>
        </div>
      </div>
    );
  }

  const vehicle = getVehicleInfo(profile.vehicleType);
  const isMotorVehicle =
    profile.vehicleType === 'moto' ||
    profile.vehicleType === 'motorcycle' ||
    profile.vehicleType === 'auto' ||
    profile.vehicleType === 'car';

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Mi perfil
        </h1>
        <p className="text-sm text-muted-foreground">
          Gestioná tu vehículo, documentación y preferencias de cuenta.
        </p>
      </div>

      {/* Tarjeta de identidad principal */}
      <Card className="flex items-center gap-4 p-4 sm:p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-dark">
          <User className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate font-display text-lg font-bold text-foreground">
              {profile.displayName}
            </h2>
            {getCourierStatusBadge(profile.courierStatus)}
          </div>
          <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </Card>

      {/* Vehículo registrado */}
      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Mi vehículo
          </h2>
          <Link
            href="/courier/onboarding/vehicle"
            className="inline-flex min-h-12 items-center px-2 text-sm font-semibold text-primary-dark underline hover:text-foreground"
          >
            Actualizar
          </Link>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background text-primary-dark shadow-sm">
              {vehicle.icon}
            </div>
            <div>
              <p className="font-display text-base font-bold text-foreground">{vehicle.label}</p>
              {isMotorVehicle && (
                <p className="text-sm text-muted-foreground">
                  {profile.plate ? `Patente: ${profile.plate}` : 'Sin patente declarada'}
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Estado de Documentación (R08) */}
      <Card className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Documentación
          </h2>
          <span className="text-sm font-semibold text-primary-dark">
            Estado en legajo
          </span>
        </div>

        <div className="divide-y divide-border/60 text-sm">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              {profile.dniStatus === 'approved' ? (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="font-medium text-foreground">DNI (frente y dorso)</span>
            </div>
            {getDocStatusBadge(profile.dniStatus)}
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              {profile.selfieStatus === 'approved' ? (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="font-medium text-foreground">Selfie de identidad</span>
            </div>
            {getDocStatusBadge(profile.selfieStatus)}
          </div>

          {isMotorVehicle && (
            <>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium text-foreground">Licencia de conducir</span>
                </div>
                {getDocStatusBadge(profile.licenseStatus)}
              </div>

              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <span className="font-medium text-foreground">Seguro de accidentes</span>
                </div>
                {getDocStatusBadge(profile.insuranceStatus)}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Tarjeta de incentivo (solo vehículos motorizados con docs opcionales) */}
      {isMotorVehicle && (
        <Card className="border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-muted-foreground">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary-dark" aria-hidden="true" />
            <p>
              <strong className="text-foreground">Mayor respaldo documental:</strong> los comercios
              ven tus ofertas con insignias de respaldo al momento de elegir.
            </p>
          </div>
        </Card>
      )}

      {/* Ajustes y Opciones */}
      <Card className="divide-y divide-border/60 text-sm">
        {/* Notificaciones con área táctil >= 48x48px */}
        <div className="flex items-center justify-between p-3.5">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium text-foreground">Notificaciones sonoras</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            aria-label="Alternar notificaciones sonoras"
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                notificationsEnabled ? 'bg-primary-dark' : 'bg-muted'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-sm transition duration-200 ease-in-out ${
                  notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </span>
          </button>
        </div>

        {/* Estado legal pendiente T-311 */}
        <div className="flex items-center justify-between p-3.5 text-muted-foreground">
          <span>Términos y privacidad (en publicación · T-311)</span>
        </div>
      </Card>

      {/* Botón de Cerrar Sesión */}
      <div className="pt-2">
        <Button
          variant="outline"
          size="lg"
          disabled={isLoggingOut}
          onClick={handleLogout}
          className="w-full gap-2 border-destructive/30 font-display text-base font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </Button>
      </div>
    </div>
  );
}
