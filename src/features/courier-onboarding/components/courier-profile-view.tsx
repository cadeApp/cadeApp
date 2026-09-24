'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { logoutAction } from '@/features/auth';
import {
  User,
  ShieldCheck,
  Bike,
  FileText,
  Bell,
  Download,
  ExternalLink,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

export interface CourierProfileData {
  readonly displayName: string;
  readonly email: string;
  readonly vehicleType: string | null;
  readonly plate: string | null;
  readonly licenseStatus: string;
  readonly insuranceStatus: string;
  readonly courierStatus: string;
}

export function CourierProfileView({ profile }: { profile: CourierProfileData }) {
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutAction();
    router.push('/login');
    router.refresh();
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <Badge variant="verified" className="text-xs">
            Verificado
          </Badge>
        );
      case 'pending':
      case 'submitted':
        return (
          <Badge variant="in_transit" className="text-xs">
            En revisión
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs text-muted-foreground">
            No cargado
          </Badge>
        );
    }
  };

  const vehicleLabel =
    profile.vehicleType === 'moto'
      ? `Moto ${profile.plate ? `· ${profile.plate}` : ''}`
      : profile.vehicleType === 'bici'
      ? 'Bicicleta'
      : profile.vehicleType === 'auto'
      ? `Auto ${profile.plate ? `· ${profile.plate}` : ''}`
      : 'A pie';

  return (
    <div className="space-y-5 px-4 py-4">
      {/* Header del perfil */}
      <div className="flex items-center gap-4 pt-2">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary-dark border-2 border-primary/20">
          <User className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-xl font-bold text-foreground">
              {profile.displayName || 'Repartidor'}
            </h1>
            <Badge variant="verified" className="text-xs">
              Aprobado
            </Badge>
          </div>
          <p className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
            <Bike className="h-4 w-4 text-primary-dark" aria-hidden="true" />
            <span>{vehicleLabel}</span>
          </p>
        </div>
      </div>

      {/* Tarjeta: Tu documentación */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-foreground">
            Tu documentación
          </h2>
          <span className="text-xs font-semibold text-primary-dark">
            Auditada por cadeApp
          </span>
        </div>

        <div className="divide-y divide-border/60 text-sm">
          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              <span className="font-medium text-foreground">DNI (frente y dorso)</span>
            </div>
            <Badge variant="verified" className="text-xs">
              Verificado
            </Badge>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              <span className="font-medium text-foreground">Selfie de identidad</span>
            </div>
            <Badge variant="verified" className="text-xs">
              Verificada
            </Badge>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium text-foreground">Licencia de conducir</span>
            </div>
            {getDocStatusBadge(profile.licenseStatus)}
          </div>

          <div className="flex items-center justify-between py-2.5">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <span className="font-medium text-foreground">Seguro de accidentes</span>
            </div>
            {getDocStatusBadge(profile.insuranceStatus)}
          </div>
        </div>
      </Card>

      {/* Tarjeta de incentivo */}
      <Card className="border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground leading-relaxed">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary-dark" aria-hidden="true" />
          <p>
            <strong className="text-foreground">Más documentación verificada:</strong> los
            comercios ven tus ofertas primero y con insignias de confianza al momento de elegir.
          </p>
        </div>
      </Card>

      {/* Ajustes y Opciones */}
      <Card className="divide-y divide-border/60 text-sm">
        {/* Notificaciones */}
        <div className="flex items-center justify-between p-3.5">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium text-foreground">Notificaciones sonoras</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              notificationsEnabled ? 'bg-primary-dark' : 'bg-muted'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Términos y privacidad */}
        <Link
          href="/terms"
          className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <ExternalLink className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium text-foreground">Términos y privacidad</span>
          </div>
        </Link>
      </Card>

      {/* Botón de Cerrar Sesión */}
      <div className="pt-2">
        <Button
          variant="outline"
          size="lg"
          disabled={isLoggingOut}
          onClick={handleLogout}
          className="w-full gap-2 font-display text-base font-bold text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          {isLoggingOut ? 'Cerrando sesión...' : 'Cerrar sesión'}
        </Button>
      </div>
    </div>
  );
}
