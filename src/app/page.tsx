import Link from 'next/link';
import { BrandLogo } from '@/ui/brand-logo';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Card } from '@/ui/card';
import { Store, Bike, Wallet, Package, ArrowRight, ShieldCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[390px] flex-col justify-between bg-background text-foreground">
      {/* TopBar pública */}
      <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-border bg-card px-4">
        <BrandLogo size="sm" showWordmark />
        <Link href="/login">
          <Button variant="ghost" size="sm" className="font-semibold text-primary-dark">
            Ingresar
          </Button>
        </Link>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 space-y-6 px-4 py-6">
        {/* Hero */}
        <section className="space-y-4 text-center">
          <div className="flex justify-center">
            <Badge variant="published" className="px-3 py-1 font-semibold">
              Piloto gratis en Aguilares
            </Badge>
          </div>

          <div className="flex justify-center py-2">
            <BrandLogo size="lg" showWordmark={false} />
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Tu envío, al precio que elijas
          </h1>
          <p className="text-base text-muted-foreground">
            Envíos directos entre comercios y repartidores de Aguilares. Publicá lo que necesitás
            mandar y los repartidores te ofertan en vivo. Vos elegís con quién.
          </p>

          <div className="space-y-3 pt-2">
            <Link href="/register?role=merchant" className="block w-full">
              <Button
                variant="default"
                size="lg"
                className="w-full gap-2 font-display text-base font-bold"
              >
                <Store className="h-5 w-5" aria-hidden="true" />
                Tengo un comercio
              </Button>
            </Link>
            <Link href="/register?role=courier" className="block w-full">
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2 font-display text-base font-bold"
              >
                <Bike className="h-5 w-5" aria-hidden="true" />
                Quiero repartir
              </Button>
            </Link>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-foreground">¿Cómo funciona?</h2>
          <div className="space-y-2.5">
            <Card className="flex items-start gap-3 p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 font-display font-bold text-primary-dark">
                1
              </div>
              <div className="space-y-0.5">
                <h3 className="font-semibold text-foreground">Publicás la entrega</h3>
                <p className="text-sm text-muted-foreground">
                  Barrio de retiro, barrio de entrega y tipo de paquete. Sin trámites.
                </p>
              </div>
            </Card>

            <Card className="flex items-start gap-3 p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 font-display font-bold text-primary-dark">
                2
              </div>
              <div className="space-y-0.5">
                <h3 className="font-semibold text-foreground">Recibís ofertas en vivo</h3>
                <p className="text-sm text-muted-foreground">
                  Los repartidores de la ciudad te dicen cuánto cobran y en cuánto llegan.
                </p>
              </div>
            </Card>

            <Card className="flex items-start gap-3 p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 font-display font-bold text-primary-dark">
                3
              </div>
              <div className="space-y-0.5">
                <h3 className="font-semibold text-foreground">Elegís y coordinás</h3>
                <p className="text-sm text-muted-foreground">
                  Aceptás la oferta que más te convenga y coordinás por WhatsApp.
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* Sección educativa: ¿Quién paga el envío? */}
        <section>
          <Card className="border-primary-dark/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary-dark">
                <Wallet className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-base font-bold text-foreground">
                  ¿Quién paga el envío?
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Lo paga quien recibe al momento de la entrega. En efectivo o transferencia directa
                  al repartidor. cadeApp no cobra comisión ni maneja ese dinero.
                </p>
              </div>
            </div>
          </Card>
        </section>

        {/* Tarjeta para repartidores */}
        <section>
          <Card className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-primary-dark">
              <Bike className="h-5 w-5" aria-hidden="true" />
              <h2 className="font-display text-base font-bold text-foreground">
                ¿Tenés moto, bici o auto?
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Sumate como repartidor independiente en Aguilares. Subís tu DNI y selfie, y cuando te
              aprobamos ya podés ofertar en las entregas de los comercios.
            </p>
            <Link href="/register?role=courier" className="block w-full">
              <Button variant="outline" className="w-full gap-2 font-semibold">
                Quiero repartir
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="space-y-2 border-t border-border px-4 py-6 text-center text-sm text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 font-medium">
          <Link href="/terms" className="hover:text-foreground">
            Términos
          </Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-foreground">
            Privacidad
          </Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-foreground">
            Términos del piloto
          </Link>
        </div>
        <p className="text-sm text-muted-foreground/80">
          Hecho en Aguilares, Tucumán · cadeApp 2026
        </p>
      </footer>
    </div>
  );
}
