import Link from 'next/link';
import { Card } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { ShieldCheck, MessageCircle, Info, Sparkles } from 'lucide-react';

export default function MerchantPlanPage() {
  return (
    <div className="space-y-5 px-4 py-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Mi plan
        </h1>
        <p className="text-sm text-muted-foreground">
          Información de tu suscripción y condiciones del servicio en Aguilares.
        </p>
      </div>

      {/* Tarjeta principal del piloto gratuito */}
      <Card className="space-y-4 border-primary/20 bg-card p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <Badge variant="published" className="px-3 py-1 font-semibold">
            Piloto activo
          </Badge>
          <span className="text-xs text-muted-foreground">Aguilares, Tucumán</span>
        </div>

        <div className="space-y-1">
          <h2 className="font-display text-xl font-bold text-foreground">
            Estás en el piloto gratis
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Podés publicar todas las entregas que necesites durante el período de prueba, sin
            costo de plataforma ni comisiones.
          </p>
        </div>

        <div className="space-y-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Sparkles className="h-4 w-4 text-primary-dark" aria-hidden="true" />
            <span>Beneficios incluidos en el piloto:</span>
          </div>
          <ul className="list-inside list-disc space-y-1 pl-1 text-xs sm:text-sm">
            <li>Publicaciones de entregas ilimitadas</li>
            <li>Ofertas de repartidores en tiempo real</li>
            <li>Contacto directo por WhatsApp para coordinar</li>
            <li>Comisión por viaje: $ 0 (gratis en el piloto)</li>
          </ul>
        </div>
      </Card>

      {/* Tarjeta: Después del piloto */}
      <Card className="space-y-3 p-5">
        <div className="space-y-1">
          <h2 className="font-display text-base font-bold text-foreground">
            Después del piloto
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Para seguir usando cadeApp vas a poder elegir un abono mensual fijo. Te vamos a avisar
            con anticipación antes de cualquier cambio para que decidas cómo continuar.
          </p>
        </div>

        <a
          href="https://wa.me/?text=Hola%20cadeApp,%20quiero%20consultar%20sobre%20el%20plan%20para%20comercios"
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <Button
            variant="outline"
            className="w-full min-h-12 h-12 gap-2 font-semibold"
          >
            <MessageCircle className="h-5 w-5 text-[#25D366]" aria-hidden="true" />
            Hablar con cadeApp
          </Button>
        </a>
      </Card>

      {/* Nota educativa D14 */}
      <Card className="border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 shrink-0 text-primary-dark" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-sm">
              El pago del flete
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              El costo de cada entrega no pasa por cadeApp. Lo paga directamente quien recibe el
              paquete al repartidor elegido, en efectivo o transferencia acordada.
            </p>
          </div>
        </div>
      </Card>

      <div className="text-center pt-2">
        <Link
          href="/terms"
          className="text-xs font-medium text-primary-dark underline hover:text-foreground"
        >
          Ver Términos y Condiciones del Piloto
        </Link>
      </div>
    </div>
  );
}
