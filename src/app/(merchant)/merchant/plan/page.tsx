import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Button, buttonVariants } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { cn } from '@/ui/cn';
import {
  Store,
  MapPin,
  Phone,
  MessageCircle,
  Info,
  CheckCircle2,
  LogOut,
} from 'lucide-react';
import { getMerchantAccountProfile } from '@/features/merchants/server';
import { logoutAction } from '@/features/auth';

function getSubscriptionDisplay(
  status: 'trial' | 'active' | 'grace_period' | 'suspended',
  paidUntil: string | null
) {
  const formattedUntil = paidUntil
    ? new Date(paidUntil).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : 'Sin fecha de vencimiento asignada';

  switch (status) {
    case 'trial':
      return {
        badgeVariant: 'published' as const,
        badgeLabel: 'Período de prueba',
        headline: 'Suscripción en período de prueba bonificado',
        description:
          'Podés publicar todas las entregas que necesites con el abono mensual bonificado.',
        untilLabel: formattedUntil,
      };
    case 'active':
      return {
        badgeVariant: 'verified' as const,
        badgeLabel: 'Suscripción al día',
        headline: 'Tu abono mensual está activo',
        description:
          'Tu comercio tiene habilitadas las publicaciones ilimitadas de envíos.',
        untilLabel: formattedUntil,
      };
    case 'grace_period':
      return {
        badgeVariant: 'pending' as const,
        badgeLabel: 'Período de gracia',
        headline: 'Tu abono está en período de gracia',
        description:
          'Contactate con soporte para regularizar el abono mensual y mantener el servicio activo.',
        untilLabel: formattedUntil,
      };
    case 'suspended':
      return {
        badgeVariant: 'rejected' as const,
        badgeLabel: 'Suspendida',
        headline: 'Suscripción pausada',
        description:
          'Tu cuenta de comercio se encuentra pausada. Escribinos para reactivarla.',
        untilLabel: formattedUntil,
      };
  }
}

export default async function MerchantPlanPage() {
  const profile = await getMerchantAccountProfile();

  async function handleLogout() {
    'use server';
    await logoutAction();
    redirect('/login');
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Cuenta
          </h1>
          <p className="text-sm text-muted-foreground">
            Datos de tu comercio y estado de tu suscripción.
          </p>
        </div>

        <EmptyState
          icon={<Store className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="Todavía no completaste el alta de tu comercio"
          description="Completá los datos de tu negocio para ver tu perfil y el estado real de tu suscripción."
          action={
            <Link
              href="/merchant/onboarding"
              className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'w-full sm:w-auto')}
            >
              Completar alta del comercio
            </Link>
          }
        />

        <form action={handleLogout} className="pt-2">
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="w-full gap-2 border-destructive/30 font-display text-base font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5" aria-hidden="true" />
            Cerrar sesión
          </Button>
        </form>
      </div>
    );
  }

  const subscription = getSubscriptionDisplay(profile.subscriptionStatus, profile.paidUntil);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Cuenta
        </h1>
        <p className="text-sm text-muted-foreground">
          Datos de tu comercio y condiciones de tu suscripción.
        </p>
      </div>

      {/* Sección 1: Perfil del comercio */}
      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
              <Store className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {profile.businessName}
              </h2>
              <p className="text-sm text-muted-foreground">Comercio registrado</p>
            </div>
          </div>

          <Link
            href="/merchant/onboarding"
            className="inline-flex min-h-12 items-center px-2 text-sm font-semibold text-primary-dark underline-offset-4 hover:underline"
          >
            Editar datos
          </Link>
        </div>

        <div className="divide-y divide-border/60 border-t border-border/70 pt-2 text-sm">
          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              Retiro predeterminado
            </span>
            <span className="text-right font-medium text-foreground">
              {profile.defaultPickupAddress ?? 'Sin dirección configurada'}
              {profile.zoneName ? ` · ${profile.zoneName}` : ''}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              Teléfono de contacto
            </span>
            <span className="font-medium text-foreground">
              {profile.phone ?? 'Sin teléfono registrado'}
            </span>
          </div>

          {profile.notes ? (
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-muted-foreground">Referencias</span>
              <span className="text-right font-medium text-foreground">{profile.notes}</span>
            </div>
          ) : null}
        </div>
      </Card>

      {/* Sección 2: Mi plan (C08) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
            Mi plan
          </h2>
          <Badge variant={subscription.badgeVariant} className="px-2.5 py-0.5 text-sm font-semibold">
            {subscription.badgeLabel}
          </Badge>
        </div>

        <Card className="space-y-4 border-primary/20 bg-card p-5 shadow-sm sm:p-6">
          <div className="space-y-1">
            <h3 className="font-display text-xl font-bold text-foreground">
              {subscription.headline}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {subscription.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 border-y border-border/60 py-3">
            <div>
              <p className="text-sm text-muted-foreground">Envíos permitidos</p>
              <p className="font-display text-base font-bold text-foreground">Ilimitados</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vigencia registrada</p>
              <p className="font-display text-sm font-bold text-primary-dark">
                {subscription.untilLabel}
              </p>
            </div>
          </div>

          <div className="space-y-2 rounded-lg bg-muted/60 p-3.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary-dark" aria-hidden="true" />
              <span>Condiciones del servicio:</span>
            </div>
            <ul className="list-inside list-disc space-y-1 pl-1 text-sm">
              <li>Publicaciones de entregas ilimitadas</li>
              <li>Ofertas de repartidores en tiempo real</li>
              <li>Contacto directo por WhatsApp para coordinar</li>
              <li>Abono mensual fijo (bonificado durante la etapa inicial)</li>
            </ul>
          </div>
        </Card>

        {/* Tarjeta: Después del período inicial */}
        <Card className="space-y-3 p-5 sm:p-6">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-foreground">
              Renovación y soporte comercial
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Para seguir usando cadeApp vas a poder elegir un abono mensual fijo. Te vamos a avisar
              con anticipación antes de cualquier cambio para que decidas cómo continuar.
            </p>
          </div>

          <a
            href="https://wa.me/?text=Hola%20cadeApp,%20quiero%20consultar%20sobre%20el%20plan%20para%20comercios"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'lg' }),
              'w-full font-semibold'
            )}
          >
            <MessageCircle className="h-5 w-5 text-success" aria-hidden="true" />
            <span>Hablar con cadeApp</span>
          </a>
        </Card>

        {/* Nota educativa D14 */}
        <Card className="border-border bg-muted/30 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 shrink-0 text-primary-dark" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">El pago del flete</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                El costo de cada entrega no pasa por cadeApp. Lo paga directamente quien recibe el
                paquete al repartidor elegido, en efectivo o transferencia acordada.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sección 3: Estado legal pendiente T-311 y cierre de sesión */}
      <Card className="p-4 text-sm text-muted-foreground">
        Términos y condiciones del Piloto (documento legal en publicación · T-311)
      </Card>

      <form action={handleLogout} className="pt-1">
        <Button
          type="submit"
          variant="outline"
          size="lg"
          className="w-full gap-2 border-destructive/30 font-display text-base font-bold text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" aria-hidden="true" />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
