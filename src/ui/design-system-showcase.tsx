'use client';

import * as React from 'react';
import { Package, Bike, Clock, CheckCircle2 } from 'lucide-react';
import { formatArs } from '@/lib/format';
import { verifyTokenContrastMatrix } from './tokens';
import { TopBar } from './top-bar';
import { BottomNav } from './bottom-nav';
import { Button } from './button';
import { Input } from './input';
import { Textarea } from './textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './select';
import { Badge } from './badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card';
import { RequestCardSkeleton } from './skeleton';
import { EmptyState } from './empty-state';

export interface AccessibilityAuditReport {
  violations: string[];
}

/**
 * Auditoría automatizada de accesibilidad DOM (equivalente a reglas nucleares de axe WCAG 2.2 AA)
 * para verificar que cualquier pantalla o muestra (`DesignSystemShowcase`) no tenga violaciones.
 */
export function auditElementAccessibility(root: HTMLElement): AccessibilityAuditReport {
  const violations: string[] = [];

  // 1. Matriz de contraste WCAG AA/AAA de tokens
  const contrast = verifyTokenContrastMatrix();
  if (!contrast.allPass) {
    violations.push('contrast: La matriz de contraste de tokens Stitch no cumple WCAG AA/AAA.');
  }

  // 2. Todo botón y enlace interactivo debe tener nombre accesible
  const interactiveNodes = Array.from(root.querySelectorAll<HTMLElement>('button, a[href]'));
  for (const node of interactiveNodes) {
    const text = (node.textContent ?? '').trim();
    const ariaLabel = node.getAttribute('aria-label');
    const ariaLabelledBy = node.getAttribute('aria-labelledby');
    if (!text && !ariaLabel && !ariaLabelledBy) {
      violations.push(
        `button-name: Elemento <${node.tagName.toLowerCase()}> sin nombre accesible.`
      );
    }
  }

  // 3. Todo input y textarea visible debe tener label asociado o aria-label
  const formControls = Array.from(root.querySelectorAll<HTMLElement>('input, textarea, select'));
  for (const ctrl of formControls) {
    const id = ctrl.getAttribute('id');
    const ariaLabel = ctrl.getAttribute('aria-label');
    const ariaLabelledBy = ctrl.getAttribute('aria-labelledby');
    const hasLabelFor = id ? Boolean(root.querySelector(`label[for="${id}"]`)) : false;
    if (!hasLabelFor && !ariaLabel && !ariaLabelledBy) {
      violations.push(`label: Control <${ctrl.tagName.toLowerCase()}> sin etiqueta asociada.`);
    }
  }

  // 4. Imágenes y role="img" deben tener alt o aria-label
  const images = Array.from(root.querySelectorAll<HTMLElement>('img, [role="img"]'));
  for (const img of images) {
    if (img.getAttribute('aria-hidden') === 'true') continue;
    const alt = img.getAttribute('alt');
    const ariaLabel = img.getAttribute('aria-label');
    if (!alt && !ariaLabel) {
      violations.push('image-alt: Elemento gráfico sin atributo alt ni aria-label.');
    }
  }

  // 5. Diálogos abiertos deben tener aria-modal="true" y aria-labelledby
  const dialogs = Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"]'));
  for (const dlg of dialogs) {
    if (dlg.getAttribute('aria-modal') !== 'true') {
      violations.push('aria-dialog-name: [role="dialog"] sin aria-modal="true".');
    }
    if (!dlg.getAttribute('aria-labelledby') && !dlg.getAttribute('aria-label')) {
      violations.push('aria-dialog-name: [role="dialog"] sin aria-labelledby ni aria-label.');
    }
  }

  return { violations };
}

/**
 * Página de muestra S00 — Hoja de marca y componentes de Stitch (D16).
 */
export function DesignSystemShowcase() {
  const [selectedZone, setSelectedZone] = React.useState('centro');

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <TopBar title="Hoja de marca S00" subtitle="Sistema de diseño Stitch (D16)" />

      <main className="mx-auto w-full max-w-lg flex-1 space-y-6 p-4">
        <section aria-labelledby="sec-typography" className="space-y-2">
          <h2 id="sec-typography" className="font-display text-xl font-bold text-foreground">
            Tipografía y montos
          </h2>
          <p className="text-base text-foreground">
            Cuerpo principal en Inter 16 px y texto secundario nunca menor a 14 px (Cláusula
            Anti-12px).
          </p>
          <p className="font-display text-3xl font-bold text-foreground">{formatArs(1500)}</p>
        </section>

        <section aria-labelledby="sec-buttons" className="space-y-3">
          <h2 id="sec-buttons" className="font-display text-xl font-bold text-foreground">
            Botones (48 px de alto)
          </h2>
          <div className="grid grid-cols-1 gap-2.5">
            <Button className="w-full">Publicar solicitud</Button>
            <Button variant="secondary" className="w-full">
              Ofertar
            </Button>
            <Button variant="outline" className="w-full">
              Cancelar
            </Button>
            <Button variant="ghost" className="w-full">
              Ver detalle
            </Button>
            <Button variant="destructive" className="w-full">
              Cancelar solicitud
            </Button>
            <Button isPending pendingText="Enviando…" className="w-full">
              Publicar solicitud
            </Button>
          </div>
        </section>

        <section aria-labelledby="sec-fields" className="space-y-3">
          <h2 id="sec-fields" className="font-display text-xl font-bold text-foreground">
            Campos de formulario
          </h2>
          <div className="space-y-1.5">
            <label htmlFor="s00-phone" className="block text-sm font-semibold text-foreground">
              Teléfono
            </label>
            <Input
              id="s00-phone"
              type="tel"
              inputMode="tel"
              placeholder="3865 12-3456"
              defaultValue="3865 12-3456"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="s00-phone-error"
              className="block text-sm font-semibold text-destructive"
            >
              Teléfono con error
            </label>
            <Input
              id="s00-phone-error"
              aria-invalid="true"
              aria-describedby="s00-phone-error-msg"
              defaultValue="123"
            />
            <p id="s00-phone-error-msg" role="alert" className="text-sm text-destructive">
              Ingresá un teléfono válido
            </p>
          </div>

          <div className="space-y-1.5">
            <label id="s00-zone-label" className="block text-sm font-semibold text-foreground">
              Barrio de entrega
            </label>
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger aria-labelledby="s00-zone-label">
                <SelectValue placeholder="Elegí el barrio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="centro">Centro</SelectItem>
                <SelectItem value="norte">Barrio Norte</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="s00-notes" className="block text-sm font-semibold text-foreground">
              Indicaciones de entrega
            </label>
            <Textarea id="s00-notes" placeholder="Portón verde al lado del kiosco" />
          </div>
        </section>

        <section aria-labelledby="sec-badges" className="space-y-3">
          <h2 id="sec-badges" className="font-display text-xl font-bold text-foreground">
            Insignias de estado y verificación
          </h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="published">Publicada</Badge>
            <Badge variant="with_offers">Con ofertas</Badge>
            <Badge variant="matched">Asignada</Badge>
            <Badge variant="in_transit">En camino</Badge>
            <Badge variant="delivered">Entregada</Badge>
            <Badge variant="expired">Vencida</Badge>
            <Badge variant="cancelled">Cancelada</Badge>
            <Badge variant="verified">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Licencia verificada
            </Badge>
            <Badge variant="declared">Moto · declarado</Badge>
          </div>
        </section>

        <section aria-labelledby="sec-cards" className="space-y-3">
          <h2 id="sec-cards" className="font-display text-xl font-bold text-foreground">
            Tarjeta de solicitud y Skeleton
          </h2>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Centro → Barrio Norte</CardTitle>
                <Badge variant="published">Publicada</Badge>
              </div>
              <CardDescription>≈ 2 km · Paquete chico</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-foreground">
              <p>Paga en efectivo (necesita cambio)</p>
            </CardContent>
            <CardFooter className="justify-between">
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" aria-hidden="true" />
                Vence en 18 min
              </span>
              <span className="font-display text-lg font-bold text-foreground">
                {formatArs(1500)}
              </span>
            </CardFooter>
          </Card>

          <RequestCardSkeleton />
        </section>

        <section aria-labelledby="sec-empty" className="space-y-3">
          <h2 id="sec-empty" className="font-display text-xl font-bold text-foreground">
            Estado vacío
          </h2>
          <EmptyState
            icon={<Package className="h-6 w-6" />}
            title="Todavía no hay solicitudes"
            description="Publicá tu primer envío en Aguilares para recibir ofertas de repartidores cercanos."
            actionLabel="Publicar solicitud"
            onAction={() => undefined}
          />
        </section>
      </main>

      <BottomNav
        items={[
          {
            id: 'requests',
            label: 'Envíos',
            href: '/requests',
            icon: <Package className="h-5 w-5" />,
            active: true,
          },
          {
            id: 'trips',
            label: 'Viajes',
            href: '/trips',
            icon: <Bike className="h-5 w-5" />,
          },
        ]}
      />
    </div>
  );
}
