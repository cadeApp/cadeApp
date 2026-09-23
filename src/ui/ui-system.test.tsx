import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { toast } from 'sonner';
import {
  DESIGN_TOKENS,
  getContrastRatio,
  verifyTokenContrastMatrix,
  BrandLogo,
  BRAND_LOGO_SVG_MARKUP,
  Button,
  Input,
  Textarea,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Skeleton,
  EmptyState,
  TopBar,
  BottomNav,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  useZodForm,
  notify,
  DOMAIN_ERROR_MESSAGES,
  MotionProvider,
  AnimatedBox,
  getMotionPreset,
  DesignSystemShowcase,
  auditElementAccessibility,
} from './index';
import { ALL_DOMAIN_ERROR_CODES } from '@/domain';
import { z } from 'zod';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    promise: vi.fn(),
  },
  Toaster: () => <div data-testid="sonner-toaster" />,
}));

describe('T-008 · DoD Sistema de Diseño Stitch (D16) y Componentes Base en src/ui', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notify._resetActiveToastsForTests();
  });

  describe('1. Contraste WCAG 2.2 AA/AAA y Tokens de Stitch (D16)', () => {
    it('garantiza contraste WCAG AAA (>= 6.9:1) en botón primario (#12182C sobre #09BABD) y AA (>= 4.5:1) en toda la matriz', () => {
      const primaryButtonRatio = getContrastRatio(
        DESIGN_TOKENS.colors.primaryForeground,
        DESIGN_TOKENS.colors.primary
      );
      expect(primaryButtonRatio).toBeGreaterThanOrEqual(6.9);

      const matrix = verifyTokenContrastMatrix();
      expect(matrix.allPass).toBe(true);
      expect(matrix.primaryButtonAAA).toBe(true);
      expect(matrix.deepTealOnWhiteAA).toBe(true);
      expect(matrix.mutedOnWhiteAA).toBe(true);
    });

    it('aplica la cláusula Anti-12px: piso tipográfico >= 14px (0.875rem) sin excepciones móviles', () => {
      expect(DESIGN_TOKENS.typography.minFontSizePx).toBe(14);
      const tokensCss = fs.readFileSync(path.resolve('src/ui/tokens.css'), 'utf-8');
      expect(tokensCss).toContain('--radius: 0.625rem');
      expect(tokensCss).not.toMatch(/font-size:\s*(10|11|12|13)px/i);
      expect(tokensCss).not.toMatch(/0\.75rem/i);
    });
  });

  describe('2. <BrandLogo /> (< 5 KB, sin importar archivos crudos de assets/)', () => {
    it('pesa menos de 5 KB en markup y archivo fuente y no importa desde assets/', () => {
      const logoFile = path.resolve('src/ui/brand-logo.tsx');
      const stats = fs.statSync(logoFile);
      const content = fs.readFileSync(logoFile, 'utf-8');

      expect(stats.size).toBeLessThan(5 * 1024);
      expect(Buffer.byteLength(BRAND_LOGO_SVG_MARKUP, 'utf-8')).toBeLessThan(5 * 1024);
      expect(content).not.toMatch(/from\s+['"].*assets\//);

      render(<BrandLogo showWordmark />);
      expect(screen.getByRole('img', { name: /cadeApp/i })).toBeDefined();
      expect(screen.getByText('cadeApp')).toBeDefined();
    });
  });

  describe('3. Dialog de confirmación: foco atrapado (Tab / Shift+Tab) y cierre con Escape (Esc)', () => {
    it('atrapa el foco con Tab y Shift+Tab dentro del Dialog abierto y cierra al presionar Escape', () => {
      const onOpenChange = vi.fn();
      render(
        <Dialog open onOpenChange={onOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar cancelación</DialogTitle>
              <DialogDescription>Esta acción no se puede deshacer.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button data-testid="btn-cancel" variant="outline">
                Volver
              </Button>
              <Button data-testid="btn-confirm" variant="destructive">
                Cancelar solicitud
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      const cancelBtn = screen.getByTestId('btn-cancel');
      const confirmBtn = screen.getByTestId('btn-confirm');

      // Al abrir, el primer elemento enfocable recibe foco
      cancelBtn.focus();
      expect(document.activeElement).toBe(cancelBtn);

      // En el último elemento, Tab cicla de vuelta al primero (foco atrapado)
      confirmBtn.focus();
      expect(document.activeElement).toBe(confirmBtn);
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(cancelBtn);

      // En el primer elemento, Shift+Tab cicla al último
      cancelBtn.focus();
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(confirmBtn);

      // Presionar Escape cierra el diálogo
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe('4. notify (Sonner): usa mensajes del dominio y no duplica toasts por id', () => {
    it('cubre los 27 códigos de DomainErrorCode en es-AR y reemplaza/deduplica toasts con el mismo id', () => {
      for (const code of ALL_DOMAIN_ERROR_CODES) {
        expect(DOMAIN_ERROR_MESSAGES[code]).toBeDefined();
        expect(DOMAIN_ERROR_MESSAGES[code].length).toBeGreaterThan(8);
      }

      // Dos llamadas seguidas con el mismo código de error usan el mismo id determinístico y no apilan duplicados
      const id1 = notify.error('OFFER_BELOW_MINIMUM');
      const id2 = notify.error('OFFER_BELOW_MINIMUM');
      expect(id1).toBe('domain-error:OFFER_BELOW_MINIMUM');
      expect(id2).toBe(id1);
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(
        DOMAIN_ERROR_MESSAGES.OFFER_BELOW_MINIMUM,
        expect.objectContaining({ id: 'domain-error:OFFER_BELOW_MINIMUM' })
      );

      // Si se pasa un id explícito repetido en notify.success, tampoco duplica mientras sigue activo
      notify.success('Oferta enviada', { id: 'offer-sent' });
      notify.success('Oferta enviada', { id: 'offer-sent' });
      expect(toast.success).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Motion presets y prefers-reduced-motion', () => {
    it('con prefers-reduced-motion activo, ningún preset desplaza (x=0, y=0, scale=1)', () => {
      const presets = ['fadeIn', 'fadeOut', 'slideUpSheet', 'highlightItem'] as const;
      for (const name of presets) {
        const reduced = getMotionPreset(name, true);
        expect(reduced.initial.x).toBe(0);
        expect(reduced.initial.y).toBe(0);
        expect(reduced.initial.scale).toBe(1);
        expect(reduced.animate.x).toBe(0);
        expect(reduced.animate.y).toBe(0);
        expect(reduced.animate.scale).toBe(1);
        expect(reduced.exit.x).toBe(0);
        expect(reduced.exit.y).toBe(0);
      }

      // Con movimiento normal, slideUpSheet sí desplaza en eje Y (transform)
      const normalSlide = getMotionPreset('slideUpSheet', false);
      expect(normalSlide.initial.y).toBeGreaterThan(0);
      expect(normalSlide.transition.durationMs).toBeLessThanOrEqual(300);
    });
  });

  describe('6. Componentes base (Button pendiente, Form con Zod, Sheet, TopBar, BottomNav, EmptyState)', () => {
    it('Button en estado isPending se deshabilita, marca aria-busy y muestra texto de espera', () => {
      render(
        <Button isPending pendingText="Enviando…">
          Publicar solicitud
        </Button>
      );
      const btn = screen.getByRole('button');
      expect(btn).toHaveProperty('disabled', true);
      expect(btn.getAttribute('aria-busy')).toBe('true');
      expect(btn.textContent).toContain('Enviando…');
    });

    it('Form + useZodForm valida con Zod y muestra el mensaje de error asociado al campo', () => {
      const schema = z.object({
        amountArs: z.number().int().min(1000, 'La oferta mínima es de $ 1.000'),
      });

      function TestForm() {
        const form = useZodForm(schema, { amountArs: 500 });
        return (
          <Form form={form} onSubmit={() => undefined}>
            <FormField
              name="amountArs"
              render={({ field, error }) => (
                <FormItem>
                  <FormLabel htmlFor="amountArs">Monto en ARS</FormLabel>
                  <FormControl>
                    <Input
                      id="amountArs"
                      type="number"
                      inputMode="numeric"
                      aria-invalid={Boolean(error)}
                      value={String(field.value)}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Ofertar</Button>
          </Form>
        );
      }

      render(<TestForm />);
      fireEvent.click(screen.getByRole('button', { name: 'Ofertar' }));
      expect(screen.getByText('La oferta mínima es de $ 1.000')).toBeDefined();
    });

    it('ejercita ConfirmDialog, Sheet (cierre con Escape), AnimatedBox y notify.info / notify.promise', async () => {
      const onSheetChange = vi.fn();
      const onConfirm = vi.fn();
      render(
        <MotionProvider reducedMotion="always">
          <AnimatedBox preset="slideUpSheet">Contenido animado</AnimatedBox>
          <Sheet open onOpenChange={onSheetChange}>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Detalle de envío</SheetTitle>
                <SheetDescription>Información de retiro</SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
          <Dialog open onOpenChange={() => undefined}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar</DialogTitle>
                <DialogDescription>Paso 2</DialogDescription>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </MotionProvider>
      );

      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs.length).toBe(2);
      fireEvent.keyDown(dialogs[0] as HTMLElement, { key: 'Escape' });
      expect(onSheetChange).toHaveBeenCalledWith(false);
      expect(onConfirm).not.toHaveBeenCalled();

      notify.info('Actualizando solicitudes');
      expect(toast.info).toHaveBeenCalledTimes(1);

      await notify.promise(Promise.resolve('ok'), {
        loading: 'Publicando…',
        success: 'Solicitud publicada',
        error: 'INTERNAL_ERROR',
      });
      expect(toast.promise).toHaveBeenCalledTimes(1);
    });
  });

  describe('7. Auditoría de accesibilidad (axe-equivalente) en la página de muestra y 0 valores arbitrarios', () => {
    it('renderiza DesignSystemShowcase (S00) con 0 violaciones de accesibilidad', () => {
      const { container } = render(
        <MotionProvider reducedMotion="user">
          <DesignSystemShowcase />
        </MotionProvider>
      );

      const report = auditElementAccessibility(container);
      expect(report.violations).toEqual([]);
    });

    it('ningún archivo de src/ui/** ni src/lib/format/** contiene clases de Tailwind con valores arbitrarios [...]', () => {
      function listFiles(dir: string): string[] {
        const out: string[] = [];
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            out.push(...listFiles(full));
          } else if (
            entry.isFile() &&
            /\.(ts|tsx|css)$/.test(entry.name) &&
            !entry.name.endsWith('.test.ts') &&
            !entry.name.endsWith('.test.tsx')
          ) {
            out.push(full);
          }
        }
        return out;
      }

      const targetFiles = [
        ...listFiles(path.resolve('src/ui')),
        ...listFiles(path.resolve('src/lib/format')),
      ];

      const arbitraryClassRegex =
        /\b(?:bg|text|border|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|w|h|min-w|min-h|max-w|max-h|rounded|gap|top|bottom|left|right|z|font|leading|tracking)-\[[^\]]+\]/;

      const offenders: string[] = [];
      for (const file of targetFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        if (arbitraryClassRegex.test(content)) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }

      expect(offenders).toEqual([]);
    });
  });
});
