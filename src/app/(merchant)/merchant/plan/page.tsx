import * as React from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card } from '@/ui/card';
import { Button, buttonVariants } from '@/ui/button';
import { EmptyState } from '@/ui/empty-state';
import { cn } from '@/ui/cn';
import { Store, MapPin, Phone, MessageCircle, Info, LogOut } from 'lucide-react';
import {
  PublicationBalanceSection,
  getMerchantAccountProfile,
  getMyPublicationBalance,
} from '@/features/merchants/server';
import { logoutAction } from '@/features/auth/server';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { z } from 'zod';

/** Soporte configurado desde el servidor. Nunca construir un wa.me sin destinatario. */
function getSupportWhatsAppHref(rawPhone: string | undefined): string | null {
  const parsed = z.string().trim().regex(/^[+()\d\s-]{10,32}$/).safeParse(rawPhone);
  if (!parsed.success) return null;

  // Un prefijo internacional parcial no puede tratarse como diez dígitos nacionales.
  // El helper compartido acepta dígitos sin prefijo: comprobamos aquí la forma internacional.
  const digits = parsed.data.replace(/\D/g, '');
  const incompleteInternationalPrefix = digits.startsWith('549')
    ? digits.length !== 13
    : digits.startsWith('54') && digits.length !== 12;
  if (incompleteInternationalPrefix) {
    return null;
  }

  try {
    return buildWhatsAppUrl(
      parsed.data,
      'Hola cadeApp, quiero consultar sobre los planes para comercios.'
    );
  } catch {
    // El helper también comprueba que el número nacional argentino tenga 10 dígitos.
    return null;
  }
}

export default async function MerchantPlanPage() {
  const [profile, balance] = await Promise.all([
    getMerchantAccountProfile(),
    getMyPublicationBalance(),
  ]);

  async function handleLogout() {
    'use server';
    await logoutAction();
    redirect('/login');
  }

  if (!profile) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Cuenta</h1>
          <p className="text-sm text-muted-foreground">
            Datos de tu comercio y estado de tu suscripción.
          </p>
        </div>

        <EmptyState
          icon={<Store className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="Todavía no completaste el alta de tu comercio"
          description="Completá los datos de tu negocio para ver tu perfil y el estado real de tu suscripción."
        />
        <div className="flex justify-center">
          <Link
            href="/merchant/onboarding"
            className={cn(buttonVariants({ variant: 'default', size: 'lg' }), 'w-full sm:w-auto')}
          >
            Completar alta del comercio
          </Link>
        </div>

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

  const supportWhatsAppHref = getSupportWhatsAppHref(process.env.CADEAPP_SUPPORT_WHATSAPP_NUMBER);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Cuenta</h1>
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

      {/* Sección 2: Mi plan (C08, CC-029): saldo y plan reales de get_my_publication_balance */}
      <PublicationBalanceSection result={balance} />

      <div className="space-y-3">
        {/* Tarjeta: Después del período inicial */}
        <Card className="space-y-3 p-5 sm:p-6">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-foreground">
              Renovación y soporte comercial
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Cuando finalice el piloto, te vamos a informar las opciones comerciales disponibles para
              que puedas elegir cómo continuar. Durante el piloto no necesitás contratar un plan.
            </p>
          </div>

          {supportWhatsAppHref ? (
            <a
              href={supportWhatsAppHref}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'w-full font-semibold'
              )}
            >
              <MessageCircle className="text-success h-5 w-5" aria-hidden="true" />
              <span>Hablar con cadeApp</span>
            </a>
          ) : (
            <>
              <Button type="button" variant="outline" size="lg" disabled className="w-full font-semibold">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Hablar con cadeApp
              </Button>
              <p className="text-sm text-muted-foreground" role="status">
                El contacto por WhatsApp no está disponible en este momento.
              </p>
            </>
          )}
        </Card>

        {/* Nota educativa D14 */}
        <Card className="border-border bg-muted/30 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 shrink-0 text-primary-dark" aria-hidden="true" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">El pago del envío</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                El costo de cada envío lo paga quien recibe el paquete directamente al repartidor
                elegido, en efectivo o por transferencia acordada. cadeApp no procesa ese pago.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Sección 3: Términos publicados del piloto y cierre de sesión */}
      <Card className="p-4 text-sm text-muted-foreground">
        Consultá los{' '}
        <Link href="/legal/pilot" className="font-medium text-primary-dark underline underline-offset-4">
          Términos y condiciones del Piloto
        </Link>
        .
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
