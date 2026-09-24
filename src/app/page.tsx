import Link from 'next/link';
import { BrandLogo } from '@/ui/brand-logo';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { TopBar } from '@/ui/top-bar';
import { Store, Wallet, ArrowRight, CheckCircle2 } from 'lucide-react';


export default function HomePage() {
  return (
    <div className="flex min-h-screen w-full flex-col justify-between bg-background text-foreground">
      <TopBar
        rightAction={
          <Link href="/login">
            <Button
              variant="ghost"
              size="sm"
              className="font-semibold text-background hover:bg-white/10 hover:text-background"
            >
              Ingresar
            </Button>
          </Link>
        }
      />

      {/* Contenido principal responsive */}
      <main className="mx-auto flex-1 w-full max-w-5xl space-y-12 px-4 py-8 sm:px-6 md:space-y-16 md:py-12 lg:px-8">
        {/* Hero Section */}
        <section className="mx-auto max-w-3xl space-y-5 text-center">
          {/* Logo oficial auténtico destacado en el Hero */}
          <div className="flex justify-center py-2">
            <BrandLogo
              size="lg"
              showWordmark={false}
              className="h-16 sm:h-20 w-auto transition-transform hover:scale-105"
            />
          </div>

          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
            Tu envío, al precio que elijas
          </h1>
          <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Envíos directos entre comercios y repartidores. Publicá lo que necesitás
            mandar y los repartidores te ofertan en vivo. Vos elegís con quién.
          </p>

          {/* Acciones duales (mobile: vertical, desktop: horizontal) */}
          <div className="mx-auto flex flex-col justify-center gap-3 pt-3 sm:max-w-none sm:flex-row sm:gap-4">
            <Link href="/register?role=merchant" className="w-full sm:w-auto">
              <Button
                variant="default"
                size="lg"
                className="w-full min-h-12 h-12 font-display text-base font-bold shadow-sm transition-all hover:shadow sm:px-8"
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <Store className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>Tengo un comercio</span>
                </span>
              </Button>
            </Link>
            <Link href="/register?role=courier" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full min-h-12 h-12 font-display text-base font-bold border-2 border-primary-dark/25 transition-all hover:border-primary-dark hover:bg-primary/5 sm:px-8"
              >
                <span className="inline-flex items-center justify-center gap-2.5">
                  <BrandLogo showWordmark={false} className="h-6 w-auto shrink-0" />
                  <span>Quiero repartir</span>
                </span>
              </Button>
            </Link>
          </div>
        </section>

        {/* Cómo funciona (mobile: lista, desktop: grid 3 cols) */}
        <section className="space-y-6">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="font-display text-xl font-bold text-foreground sm:text-2xl">
              ¿Cómo funciona?
            </h2>
            <p className="text-sm text-muted-foreground">
              Tres pasos simples para conectar comercios y repartidores sin intermediarios.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
            <Card className="flex flex-col justify-between p-5 transition-shadow hover:shadow-sm">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-display text-lg font-bold text-primary-dark">
                  1
                </div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Publicás la entrega
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Barrio de retiro, barrio de entrega y tipo de paquete. Sin trámites ni esperas.
                </p>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5 transition-shadow hover:shadow-sm">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-display text-lg font-bold text-primary-dark">
                  2
                </div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Recibís ofertas en vivo
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Los repartidores de Aguilares te dicen cuánto cobran y en cuánto tiempo llegan.
                </p>
              </div>
            </Card>

            <Card className="flex flex-col justify-between p-5 transition-shadow hover:shadow-sm">
              <div className="space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-display text-lg font-bold text-primary-dark">
                  3
                </div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Elegís y coordinás
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Aceptás la oferta que más te convenga y coordinás la entrega directamente.
                </p>
              </div>
            </Card>
          </div>
        </section>

        {/* Sección inferior dual: ¿Quién paga? + Repartidores (grid 2 cols en desktop) */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          {/* ¿Quién paga el envío? */}
          <Card className="flex flex-col justify-between border-primary-dark/20 bg-primary/5 p-5 md:p-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/15 p-2 text-primary-dark">
                  <Wallet className="h-6 w-6" aria-hidden="true" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  ¿Quién paga el envío?
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                <strong className="text-foreground">Lo paga quien recibe</strong> al momento de la
                entrega. En efectivo o por transferencia directa al repartidor. cadeApp{' '}
                <strong className="text-foreground">no interviene en el cobro</strong> ni retiene el
                dinero del viaje.
              </p>
            </div>
            <div className="pt-4 text-sm font-medium text-primary-dark flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              Trato 100% directo entre comercio y repartidor
            </div>
          </Card>

          {/* Tarjeta para repartidores */}
          <Card className="flex flex-col justify-between space-y-4 p-5 md:p-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-primary-dark">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 p-1.5">
                  <BrandLogo showWordmark={false} className="h-7 w-auto shrink-0" />
                </div>
                <h2 className="font-display text-lg font-bold text-foreground">
                  ¿Tenés moto, bici o auto?
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                Sumate como repartidor independiente en Aguilares. Subís tu DNI y selfie, y en cuanto
                el equipo audita tu perfil ya podés empezar a ofertar en pedidos de comercios.
              </p>
            </div>

            <Link href="/register?role=courier" className="block w-full">
              <Button variant="outline" className="w-full min-h-12 h-12 border-2 border-border hover:border-primary-dark hover:bg-primary/5">
                <span className="inline-flex items-center w-full justify-between gap-2 font-semibold">
                  <span className="inline-flex items-center gap-2.5">
                    <BrandLogo showWordmark={false} className="h-5 w-auto shrink-0" />
                    <span>Quiero repartir</span>
                  </span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Button>
            </Link>
          </Card>
        </section>
      </main>

      {/* Footer responsive */}
      <footer className="w-full border-t border-border bg-card/40 py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto max-w-5xl space-y-2 px-4 sm:px-6">
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 font-medium">
            <span className="text-muted-foreground">
              Términos y Privacidad del Piloto (documentos legales en publicación · T-311)
            </span>
          </div>
          <p className="text-sm text-muted-foreground/80">
            Hecho en Aguilares, Tucumán · cadeApp 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
