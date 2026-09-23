'use client';

import * as React from 'react';
import { Home, Package, User } from 'lucide-react';
import { Badge } from '@/ui/badge';
import { BottomNav } from '@/ui/bottom-nav';
import { BrandLogo } from '@/ui/brand-logo';
import { Button } from '@/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/ui/card';
import { EmptyState } from '@/ui/empty-state';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/ui/form';
import { Input } from '@/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Skeleton, SkeletonRequestCard } from '@/ui/skeleton';
import { Textarea } from '@/ui/textarea';
import { TopBar } from '@/ui/top-bar';

export interface AccessibilityViolation {
  rule: string;
  elementTag: string;
  message: string;
}

/**
 * Auditoría estructural del DOM de la pantalla de muestra S00:
 * verifica nombres accesibles en botones, imágenes/SVG, controles de formulario,
 * encabezados y padres ARIA requeridos (como role="option" dentro de role="listbox").
 * Nota (D03): la auditoría completa con @axe-core/playwright corresponde a la suite E2E.
 */
export function auditDomAccessibilityStructure(root: HTMLElement): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  const buttons = Array.from(root.querySelectorAll('button'));
  for (const btn of buttons) {
    const label = (btn.textContent ?? '').trim() || btn.getAttribute('aria-label') || '';
    if (!label) {
      violations.push({
        rule: 'button-name',
        elementTag: 'BUTTON',
        message: 'Every button must have discernible text or an aria-label.',
      });
    }
  }

  const imagesAndSvgs = Array.from(root.querySelectorAll('img, svg[role="img"]'));
  for (const img of imagesAndSvgs) {
    const alt = img.getAttribute('alt') || img.getAttribute('aria-label') || '';
    if (!alt) {
      violations.push({
        rule: 'image-alt',
        elementTag: img.tagName,
        message: 'Images and role="img" SVGs must have alt or aria-label.',
      });
    }
  }

  const inputs = Array.from(root.querySelectorAll('input, textarea'));
  for (const input of inputs) {
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
    const hasExplicitLabel = id ? Boolean(root.querySelector(`label[for="${id}"]`)) : false;
    if (!hasExplicitLabel && !ariaLabel) {
      violations.push({
        rule: 'label',
        elementTag: input.tagName,
        message: `Form control #${id ?? 'unidentified'} is missing an associated label.`,
      });
    }
  }

  const headings = Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  for (const h of headings) {
    if (!(h.textContent ?? '').trim()) {
      violations.push({
        rule: 'empty-heading',
        elementTag: h.tagName,
        message: 'Headings must not be empty.',
      });
    }
  }

  const options = Array.from(root.querySelectorAll('[role="option"]'));
  for (const opt of options) {
    if (!opt.closest('[role="listbox"]')) {
      violations.push({
        rule: 'aria-required-parent',
        elementTag: opt.tagName,
        message: 'Elements with role="option" must be contained within an element with role="listbox".',
      });
    }
  }

  return violations;
}

export const auditElementAccessibility = auditDomAccessibilityStructure;

export function DesignSystemShowcase() {
  const [zone, setZone] = React.useState('centro');

  return (
    <div className="min-h-screen bg-background pb-20 text-foreground" data-testid="s00-showcase">
      <TopBar
        title="Sistema de Diseño"
        subtitle="Aguilares · S00"
        rightAction={<Badge variant="published">D16</Badge>}
      />

      <main className="mx-auto max-w-md space-y-6 p-4">
        <section aria-labelledby="s00-brand-heading" className="space-y-3">
          <h2 id="s00-brand-heading" className="font-display text-lg font-bold">
            Identidad de Marca
          </h2>
          <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-card">
            <BrandLogo />
            <Badge variant="delivered">WCAG AAA</Badge>
          </div>
        </section>

        <section aria-labelledby="s00-buttons-heading" className="space-y-3">
          <h2 id="s00-buttons-heading" className="font-display text-lg font-bold">
            Acciones Táctiles (≥ 48px)
          </h2>
          <div className="flex flex-col gap-3">
            <Button variant="default" size="lg">
              Publicar pedido
            </Button>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" size="default">
                +$ 100
              </Button>
              <Button variant="outline" size="default">
                +$ 200
              </Button>
              <Button variant="outline" size="default">
                +$ 500
              </Button>
            </div>
            <Button variant="secondary" isPending pendingText="Procesando oferta...">
              Enviar oferta
            </Button>
          </div>
        </section>

        <section aria-labelledby="s00-forms-heading" className="space-y-3">
          <h2 id="s00-forms-heading" className="font-display text-lg font-bold">
            Controles de Formulario
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>Nueva oferta</CardTitle>
              <CardDescription>Proponé tu tarifa en pesos argentinos enteros.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField name="offerAmount" error="El monto debe superar el piso vigente.">
                <FormItem>
                  <FormLabel>Monto de oferta (ARS)</FormLabel>
                  <FormControl>
                    <Input type="number" defaultValue="1500" />
                  </FormControl>
                  <FormDescription>Sin centavos ni decimales.</FormDescription>
                  <FormMessage />
                </FormItem>
              </FormField>

              <div className="space-y-1.5">
                <label
                  htmlFor="showcase-notes"
                  className="block text-sm font-semibold text-foreground"
                >
                  Notas para el comercio
                </label>
                <Textarea id="showcase-notes" placeholder="Llego en 5 minutos..." />
              </div>

              <div className="space-y-1.5">
                <span className="block text-sm font-semibold text-foreground">Barrio</span>
                <Select value={zone} onValueChange={setZone}>
                  <SelectTrigger aria-label="Seleccionar barrio">
                    <SelectValue placeholder="Elegí un barrio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="centro">Centro</SelectItem>
                    <SelectItem value="villa-nueva">Villa Nueva</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Badge variant="in_transit">Tiempo restante: 18 min</Badge>
            </CardFooter>
          </Card>
        </section>

        <section aria-labelledby="s00-states-heading" className="space-y-3">
          <h2 id="s00-states-heading" className="font-display text-lg font-bold">
            Estados de Carga y Vacío
          </h2>
          <Skeleton className="h-6 w-36" />
          <SkeletonRequestCard />
          <EmptyState
            title="No hay solicitudes abiertas"
            description="Te avisaremos apenas un comercio de Aguilares publique un envío."
            actionLabel="Actualizar listado"
            onAction={() => {}}
          />
        </section>
      </main>

      <BottomNav
        items={[
          {
            id: 'requests',
            href: '/courier',
            label: 'Solicitudes',
            icon: <Home className="h-5 w-5" />,
            active: true,
          },
          {
            id: 'trips',
            href: '/courier/trips',
            label: 'Mis viajes',
            icon: <Package className="h-5 w-5" />,
          },
          {
            id: 'profile',
            href: '/courier/profile',
            label: 'Perfil',
            icon: <User className="h-5 w-5" />,
          },
        ]}
      />
    </div>
  );
}
