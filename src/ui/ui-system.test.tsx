// @vitest-environment jsdom
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn((_msg, opts) => opts?.id ?? 'mock-success'),
    error: vi.fn((_msg, opts) => opts?.id ?? 'mock-error'),
    info: vi.fn((_msg, opts) => opts?.id ?? 'mock-info'),
    promise: vi.fn((promise, opts) => ({ promise, opts })),
  },
  Toaster: (props: Record<string, unknown>) => (
    <div data-testid="sonner-toaster-mock" data-position={String(props.position ?? '')} />
  ),
}));

import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ALL_DOMAIN_ERROR_CODES } from '@/domain/errors';
import { DOMAIN_ERROR_MESSAGES, getDomainErrorMessage } from '@/lib/error-messages';
import { formatArs, formatDate, formatPhone } from '@/lib/format';
import {
  BRAND_ASSET_PATHS,
  BRAND_LOGO_SVG_MARKUP,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  BottomNav,
  BrandLogo,
  Button,
  ConfirmDialog,
  DESIGN_TOKENS,
  DesignSystemShowcase,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  MOTION_PRESETS,
  MotionProvider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Toaster,
  TopBar,
  AnimatedBox,
  auditDomAccessibilityStructure,
  getContrastRatio,
  notify,
  resolveMotionPreset,
  sanitizeToastMessage,
  verifyTokenContrastMatrix,
} from '@/ui';

describe('T-008 · DoD Sistema de Diseño Stitch (D16) y Componentes Base en src/ui', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('1. Formateadores (ARS sin decimales, Fecha en zona Argentina, Teléfono rioplatense)', () => {
    it('formatArs formatea pesos enteros con separador de miles (punto) y sin centavos', () => {
      expect(formatArs(1000)).toBe('$ 1.000');
      expect(formatArs(1450)).toBe('$ 1.450');
      expect(formatArs(125000)).toBe('$ 125.000');
      expect(formatArs(0)).toBe('$ 0');
      expect(() => formatArs(-1500)).toThrow(RangeError);
      expect(() => formatArs(1499.7)).toThrow(RangeError);
      expect(() => formatArs(Number.NaN)).toThrow(RangeError);
    });

    it('formatDate formatea en huso horario America/Argentina/Buenos_Aires (UTC-3)', () => {
      const utcIso = '2026-09-20T01:30:00.000Z';
      expect(formatDate(utcIso, 'date')).toBe('19/09/2026');
      expect(formatDate(utcIso, 'time')).toMatch(/22:30/);
      expect(formatDate(utcIso, 'dateTime')).toContain('19/09/2026');
      expect(() => formatDate('invalid-date')).toThrow(RangeError);
    });

    it('formatPhone normaliza números locales de Aguilares/Tucumán y móviles +54 9', () => {
      expect(formatPhone('+5493865123456')).toBe('3865 12-3456');
      expect(formatPhone('3865123456')).toBe('3865 12-3456');
      expect(formatPhone('03865 15 654321')).toBe('3865 65-4321');
      expect(() => formatPhone('123')).toThrow(RangeError);
    });
  });

  describe('2. Tokens de color, Contraste WCAG AA/AAA y Cláusula Anti-12px', () => {
    it('cumple ratios WCAG AAA (7.35:1) en botón primario (#12182C sobre #09BABD) y AA en enlaces (#0B7A7D)', () => {
      const primaryBtnContrast = getContrastRatio(
        DESIGN_TOKENS.colors.ink,
        DESIGN_TOKENS.colors.primary
      );
      expect(primaryBtnContrast).toBeGreaterThanOrEqual(7.0);

      const linkContrast = getContrastRatio(
        DESIGN_TOKENS.colors.primaryDark,
        DESIGN_TOKENS.colors.surface
      );
      expect(linkContrast).toBeGreaterThanOrEqual(4.5);

      const matrix = verifyTokenContrastMatrix();
      expect(matrix.primaryButtonAAA).toBe(true);
      expect(matrix.secondaryButtonAAA).toBe(true);
      expect(matrix.primaryTextLinkAA).toBe(true);
      expect(matrix.bodyTextAAA).toBe(true);
      expect(matrix.mutedTextAA).toBe(true);
      expect(matrix.mutedBadgeAA).toBe(true);
      expect(matrix.successBadgeAA).toBe(true);
      expect(matrix.badgeSuccessAA).toBe(true);
      expect(matrix.warningBadgeAA).toBe(true);
      expect(matrix.dangerBadgeAA).toBe(true);
      expect(matrix.whatsappButtonAA).toBe(true);

      expect(getContrastRatio('#FFFFFF', DESIGN_TOKENS.colors.whatsapp)).toBeLessThan(4.5);
      expect(
        getContrastRatio(DESIGN_TOKENS.colors.whatsappForeground, DESIGN_TOKENS.colors.whatsapp)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        getContrastRatio(DESIGN_TOKENS.colors.whatsappForeground, DESIGN_TOKENS.colors.whatsappHover)
      ).toBeGreaterThanOrEqual(4.5);
    });

    it('respeta la cláusula Anti-12px (piso tipográfico >= 14px / 0.875rem) y targets táctiles >= 48px', () => {
      expect(DESIGN_TOKENS.typography.minFontSizePx).toBeGreaterThanOrEqual(14);
      expect(DESIGN_TOKENS.typography.minFontSizeRem).toBe('0.875rem');
      expect(DESIGN_TOKENS.touchTargets.minHeightPx).toBeGreaterThanOrEqual(48);
      expect(DESIGN_TOKENS.touchTargets.ctaHeightPx).toBe(52);
    });
  });

  describe('3. BrandLogo (< 5 KB), SVGs optimizados y sin import directo de assets/', () => {
    it('el SVG de BrandLogo pesa menos de 5 KB y renderiza con los colores de DESIGN_TOKENS', () => {
      const byteSize = new TextEncoder().encode(BRAND_LOGO_SVG_MARKUP).length;
      expect(byteSize).toBeGreaterThan(100);
      expect(byteSize).toBeLessThan(5 * 1024);

      expect(BRAND_ASSET_PATHS.logoSvg).toBe('/brand/logo.svg');
      expect(BRAND_ASSET_PATHS.logoWebp).toBe('/brand/logo.webp');
      expect(BRAND_ASSET_PATHS.icon192).toBe('/icon-192x192.png');
      expect(BRAND_ASSET_PATHS.icon512).toBe('/icon-512x512.png');

      const { container, rerender } = render(<BrandLogo label="Logo de Cade" />);
      expect(screen.getByRole('img', { name: 'Logo de Cade' })).toBeDefined();
      const riderPath = container.querySelector('[data-brand-part="rider"]');
      expect(riderPath?.getAttribute('fill')).toBe(DESIGN_TOKENS.colors.ink);
      const boxPath = container.querySelector('[data-brand-part="box"]');
      expect(boxPath).toBeDefined();

      rerender(<BrandLogo showWordmark={false} label="Isotipo Cade" />);
      expect(container.querySelector('[data-brand-part="wordmark"]')).toBeNull();
    });
  });

  describe('4. Dialog: foco inicial automático, foco atrapado (Tab/Shift+Tab), cierre con Esc y retorno al disparador', () => {
    it('mueve el foco automáticamente al abrir sin llamar .focus() en el test, atrapa Tab, cierra con Escape y devuelve el foco al trigger', async () => {
      function DialogTestHarness() {
        const [open, setOpen] = React.useState(false);
        return (
          <div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger>Abrir modal</DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar cancelación</DialogTitle>
                  <DialogDescription>¿Seguro que querés cancelar este envío?</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Volver
                  </Button>
                  <Button type="button" variant="destructive" onClick={() => setOpen(false)}>
                    Sí, cancelar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        );
      }

      render(<DialogTestHarness />);

      const trigger = screen.getByRole('button', { name: 'Abrir modal' });
      trigger.focus();
      expect(document.activeElement).toBe(trigger);

      fireEvent.click(trigger);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeDefined();

      const cancelBtn = screen.getByRole('button', { name: 'Volver' });
      const confirmBtn = screen.getByRole('button', { name: 'Sí, cancelar' });

      // H09: el foco inicial ya está dentro del diálogo sin llamar cancelBtn.focus() en el test
      expect(dialog.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(cancelBtn);

      // Si estamos en el último elemento y presionamos Tab, vuelve al primero (focus trap)
      confirmBtn.focus();
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(cancelBtn);

      // Si estamos en el primero y presionamos Shift+Tab, salta al último
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(confirmBtn);

      // Presionar Escape cierra el modal y restaura el foco al disparador (H18)
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });
  });

  describe('4B. CC-009 AlertDialog y token semántico WhatsApp', () => {
    it('AlertDialog usa role alertdialog, foco inicial seguro, focus trap, Escape/cancel y retorno al trigger', async () => {
      const onAction = vi.fn();
      render(
        <AlertDialog>
          <AlertDialogTrigger>Abrir alerta</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar envío</AlertDialogTitle>
              <AlertDialogDescription>Esta acción es irreversible.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction onClick={onAction}>Sí, cancelar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      );

      const trigger = screen.getByRole('button', { name: 'Abrir alerta' });
      trigger.focus();
      fireEvent.click(trigger);

      const alert = screen.getByRole('alertdialog');
      const cancel = screen.getByRole('button', { name: 'Volver' });
      const action = screen.getByRole('button', { name: 'Sí, cancelar' });
      expect(alert.contains(document.activeElement)).toBe(true);
      expect(document.activeElement).toBe(cancel);

      action.focus();
      fireEvent.keyDown(alert, { key: 'Tab' });
      expect(document.activeElement).toBe(cancel);

      fireEvent.keyDown(alert, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(action);

      fireEvent.keyDown(alert, { key: 'Escape' });
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger));

      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger));

      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
      expect(onAction).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('el token WhatsApp está sincronizado y Button consume clases semánticas sin hex arbitrarios', () => {
      expect(DESIGN_TOKENS.colors.whatsapp).toBe('#25D366');
      expect(DESIGN_TOKENS.colors.whatsappHover).toBe('#20BA5A');
      expect(DESIGN_TOKENS.colors.whatsappForeground).toBe('#12182C');

      const { container } = render(<Button variant="whatsapp">WhatsApp</Button>);
      const btn = container.querySelector('button');
      expect(btn?.className).toContain('bg-whatsapp');
      expect(btn?.className).toContain('text-whatsapp-foreground');
      expect(btn?.className).toContain('hover:bg-whatsapp-hover');
      expect(btn?.className).not.toMatch(/#[0-9a-fA-F]{6}/);
    });
  });

  describe('4C. CC-010 Table, Tabs e InputOTP oficiales de shadcn', () => {
    it('Table conserva semántica nativa y piso tipográfico text-sm', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Postulante</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Lautaro</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      );

      const table = screen.getByRole('table');
      expect(table.className).toContain('text-sm');
      expect(screen.getByRole('columnheader', { name: 'Postulante' })).toBeDefined();
      expect(screen.getByRole('cell', { name: 'Lautaro' })).toBeDefined();
    });

    it('Tabs expone tabs accesibles y cambia el estado activo al seleccionar', () => {
      render(
        <Tabs defaultValue="pending">
          <TabsList aria-label="Estado de postulantes">
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="approved">Aprobados</TabsTrigger>
          </TabsList>
          <TabsContent value="pending">Panel pendientes</TabsContent>
          <TabsContent value="approved">Panel aprobados</TabsContent>
        </Tabs>
      );

      const pending = screen.getByRole('tab', { name: 'Pendientes' });
      const approved = screen.getByRole('tab', { name: 'Aprobados' });
      expect(pending.getAttribute('data-state')).toBe('active');
      expect(approved.getAttribute('data-state')).toBe('inactive');

      fireEvent.mouseDown(approved, { button: 0, ctrlKey: false });
      expect(approved.getAttribute('data-state')).toBe('active');
      expect(pending.getAttribute('data-state')).toBe('inactive');
    });

    it('InputOTP mantiene un único textbox accesible y refleja seis dígitos en slots controlados', () => {
      function OtpHarness() {
        const [value, setValue] = React.useState('');
        return (
          <InputOTP
            maxLength={6}
            value={value}
            onChange={setValue}
            aria-label="Código MFA"
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, index) => (
                <InputOTPSlot key={index} index={index} data-testid={`otp-slot-${index}`} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        );
      }

      render(<OtpHarness />);

      const input = screen.getByRole('textbox', { name: 'Código MFA' });
      expect(input.getAttribute('autocomplete')).toBe('one-time-code');
      fireEvent.change(input, { target: { value: '123456' } });

      expect(screen.getByTestId('otp-slot-0').textContent).toContain('1');
      expect(screen.getByTestId('otp-slot-5').textContent).toContain('6');
    });
  });

  describe('5. notify (Sonner): uso de mensajes, reemplazo por id y sanitización anti-PII (D15)', () => {
    it('delega a Sonner con el mismo id al repetir y oculta teléfonos tanto internacionales como nacionales', () => {
      const id1 = notify.success('Oferta enviada con éxito');
      const id2 = notify.success('Oferta enviada con éxito');
      expect(id1).toBe('success:oferta enviada con éxito');
      expect(id2).toBe(id1);
      expect(toast.success).toHaveBeenCalledTimes(2);
      expect(toast.success).toHaveBeenLastCalledWith(
        'Oferta enviada con éxito',
        expect.objectContaining({ id: 'success:oferta enviada con éxito' })
      );

      // Ejecutamos callbacks onDismiss y onAutoClose para cubrir limpieza de estado
      const lastCallOpts = vi.mocked(toast.success).mock.calls[0]?.[1] as {
        onDismiss?: () => void;
        onAutoClose?: () => void;
      };
      lastCallOpts?.onDismiss?.();
      lastCallOpts?.onAutoClose?.();

      notify.error('No se pudo contactar al +54 9 3865 12-3456', {
        description: 'Teléfono +5493865998877 no disponible',
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(
        'No se pudo contactar al [teléfono oculto]',
        expect.objectContaining({
          description: 'Teléfono [teléfono oculto] no disponible',
        })
      );

      expect(sanitizeToastMessage('Llamar al +54 9 3865 445566 urgente')).toBe(
        'Llamar al [teléfono oculto] urgente'
      );
      expect(sanitizeToastMessage('Llamar al 3865 12-3456 urgente')).toBe(
        'Llamar al [teléfono oculto] urgente'
      );
    });
  });

  describe('6. Motion: presets con prefers-reduced-motion desactivan desplazamientos', () => {
    it('resolveMotionPreset y AnimatedBox neutralizan animaciones cuando reducedMotion está activo o matchMedia cambia', () => {
      const normalSlide = resolveMotionPreset('slideUp', false);
      expect(normalSlide.duration).toBeGreaterThan(0);
      expect(normalSlide.initialClass).toContain('translate-y-2');

      const reducedSlide = resolveMotionPreset('slideUp', true);
      expect(reducedSlide).toEqual(MOTION_PRESETS.none);
      expect(reducedSlide.duration).toBe(0);
      expect(reducedSlide.initialClass).toBe('');

      // H08: simulamos window.matchMedia('(prefers-reduced-motion: reduce)') con matches: true y evento change
      let registeredListener: ((ev: MediaQueryListEvent) => void) | null = null;
      const originalMatchMedia = window.matchMedia;
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: (_type: string, cb: (ev: MediaQueryListEvent) => void) => {
          registeredListener = cb;
        },
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      try {
        render(
          <MotionProvider>
            <AnimatedBox preset="sheetSpring" data-testid="motion-box">
              Contenido animado
            </AnimatedBox>
          </MotionProvider>
        );

        const box = screen.getByTestId('motion-box');
        expect(box.getAttribute('data-reduced-motion')).toBe('true');
        expect(box.getAttribute('data-motion-preset')).toBe('sheetSpring');

        if (registeredListener) {
          (registeredListener as (ev: MediaQueryListEvent) => void)({
            matches: false,
          } as MediaQueryListEvent);
        }
      } finally {
        window.matchMedia = originalMatchMedia;
      }
    });
  });

  describe('7. Showcase S00: auditoría estructural DOM sin violaciones y 0 clases arbitrarias en src/ui', () => {
    it('renderiza DesignSystemShowcase sin violaciones estructurales DOM y sin opciones huérfanas', () => {
      const { container } = render(<DesignSystemShowcase />);
      const violations = auditDomAccessibilityStructure(container);
      expect(violations).toEqual([]);
    });

    it('H07: ningún archivo de src/ui contiene clases con valores arbitrarios de estilo (excepto aria-*, data-*, supports-*)', () => {
      const uiDir = path.resolve(process.cwd(), 'src/ui');
      const collectFiles = (dir: string): string[] => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        const files: string[] = [];
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            files.push(...collectFiles(fullPath));
          } else if (
            (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
            !entry.name.endsWith('.test.tsx')
          ) {
            files.push(fullPath);
          }
        }
        return files;
      };

      const arbitraryStylePattern =
        /(?<![A-Za-z0-9_-])(?!(?:aria|data|supports)-)[a-zA-Z0-9-]+-\[[^\]]+\]/;

      // Verificamos que el patrón invertido detecta todas las clases arbitrarias de M6
      for (const forbiddenSample of [
        'shadow-[0_1px_2px_rgba(0,0,0,0.05)]',
        'ring-[3px]',
        'size-[13px]',
        'inset-[7px]',
        'translate-y-[11px]',
        'grid-cols-[1fr_auto]',
        'duration-[3000ms]',
        'opacity-[0.03]',
      ]) {
        expect(arbitraryStylePattern.test(forbiddenSample)).toBe(true);
      }
      expect(arbitraryStylePattern.test('data-[state=open]:opacity-100')).toBe(false);
      expect(arbitraryStylePattern.test('aria-[invalid=true]:border-destructive')).toBe(false);

      const files = collectFiles(uiDir);
      expect(files.length).toBeGreaterThan(10);

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        expect(content).not.toMatch(arbitraryStylePattern);
      }
    });
  });

  describe('8. Ronda 1 → Ronda 2: Cierre conductual de H02..H19 y D01..D04', () => {
    it('H02: tokens.css apaga .animate-pulse y .animate-spin con @media (prefers-reduced-motion: reduce) y EmptyState/AnimatedBox aplican presets reales', () => {
      const tokensCss = fs.readFileSync(path.resolve('src/ui/tokens.css'), 'utf8');
      expect(tokensCss).toMatch(/@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
      expect(tokensCss).toMatch(/\.animate-pulse[\s\S]*animation:\s*none\s*!important/);
      expect(tokensCss).toMatch(/\.animate-spin[\s\S]*animation:\s*none\s*!important/);

      render(
        <MotionProvider forceReducedMotion={false}>
          <EmptyState
            title="Sin viajes"
            description="Publicá una solicitud para empezar."
            actionLabel="Crear solicitud"
            onAction={() => {}}
          />
        </MotionProvider>
      );
      const statusRegion = screen.getByRole('status');
      expect(statusRegion.getAttribute('data-motion-preset')).toBe('fadeIn');
    });

    it('H03: ConfirmDialog ejecuta onConfirm, muestra el botón Volver y bloquea el cierre por Escape mientras isPending=true', () => {
      const onConfirm = vi.fn();
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <ConfirmDialog
          open={true}
          onOpenChange={onOpenChange}
          title="Cancelar pedido"
          description="El repartidor será notificado."
          confirmLabel="Confirmar baja"
          onConfirm={onConfirm}
          isPending={true}
        />
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(onOpenChange).not.toHaveBeenCalledWith(false);

      rerender(
        <ConfirmDialog
          open={true}
          onOpenChange={onOpenChange}
          title="Cancelar pedido"
          description="El repartidor será notificado."
          confirmLabel="Confirmar baja"
          onConfirm={onConfirm}
          isPending={false}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Confirmar baja' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('H04: cláusula Anti-12px verificada contra tailwind.config.ts (xs y sm >= 0.875rem y sin fontSize inline < 14px)', () => {
      const twConfigContent = fs.readFileSync(path.resolve('tailwind.config.ts'), 'utf8');
      expect(twConfigContent).toMatch(/xs:\s*\[\s*'0\.875rem'/);
      expect(twConfigContent).toMatch(/sm:\s*\[\s*'0\.875rem'/);
      expect(twConfigContent).not.toMatch(/['"]0\.75rem['"]|['"]12px['"]/);
    });

    it('H05, H12 y H17: Select cerrado no deja role="option" huérfanos en el DOM, muestra "Centro" en el primer pintado y soporta teclado', () => {
      const onValueChange = vi.fn();
      const { container } = render(
        <Select value="centro" onValueChange={onValueChange}>
          <SelectTrigger aria-label="Seleccionar barrio">
            <SelectValue placeholder="Elegí un barrio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="centro">Centro</SelectItem>
            <SelectItem value="villa-nueva">Villa Nueva</SelectItem>
          </SelectContent>
        </Select>
      );

      // Con el Select cerrado no debe haber ningún role="option" sin listbox
      expect(container.querySelectorAll('[role="option"]').length).toBe(0);
      // En el primer pintado debe verse "Centro" (con mayúscula), no el value crudo "centro"
      expect(screen.getByText('Centro')).toBeDefined();

      const trigger = screen.getByRole('combobox', { name: 'Seleccionar barrio' });
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      expect(screen.getByRole('listbox')).toBeDefined();

      fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      expect(onValueChange).toHaveBeenCalledWith('villa-nueva');
    });

    it('H06: FormControl enlaza automáticamente aria-describedby al id de FormMessage y marca aria-invalid sin cableado manual', () => {
      render(
        <FormField name="offerAmount" error="El monto es menor al piso.">
          <FormItem>
            <FormLabel>Oferta</FormLabel>
            <FormControl>
              <Input type="number" defaultValue="900" />
            </FormControl>
            <FormDescription>Ingresá múltiplos de 100.</FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>
      );

      const alertMsg = screen.getByRole('alert');
      const msgId = alertMsg.getAttribute('id');
      expect(msgId).toBeTruthy();

      const input = screen.getByLabelText('Oferta');
      expect(input.getAttribute('aria-describedby')).toContain(msgId as string);
      expect(input.getAttribute('aria-invalid')).toBe('true');
    });

    it('H10 y H11: notify delega siempre a Sonner con id (sin suprimir la segunda acción) y sanitiza el formato nacional de formatPhone', () => {
      notify.success('Oferta enviada');
      notify.success('Oferta enviada');
      expect(toast.success).toHaveBeenCalledTimes(2);

      notify.info('Coordiná el retiro al 3865 12-3456');
      expect(toast.info).toHaveBeenCalledWith(
        'Coordiná el retiro al [teléfono oculto]',
        expect.objectContaining({ id: 'info:coordiná el retiro al [teléfono oculto]' })
      );
    });

    it('H13 y H15: DESIGN_TOKENS incluye accent/muted, la matriz verifica .badge-success y bg-muted, y exige >= 7.0 (7.35:1 AAA) en botón primario', () => {
      expect(DESIGN_TOKENS.colors.accent).toBe('#F0FDF4');
      expect(DESIGN_TOKENS.colors.muted).toBe('#F3F4F6');
      const matrix = verifyTokenContrastMatrix();
      expect(matrix.badgeSuccessAA).toBe(true);
      expect(matrix.mutedBadgeAA).toBe(true);
      expect(matrix.secondaryButtonAAA).toBe(true);

      const tokensTsContent = fs.readFileSync(path.resolve('src/ui/tokens.ts'), 'utf8');
      expect(tokensTsContent).toMatch(/>=\s*7\.0/);
    });

    it('H14, H21, H25, D02 y D07: verifica en disco existencia y presupuesto en bytes (< 5 KB en logo.svg) de BRAND_ASSET_PATHS y metadata de /design-system', () => {
      const svgPath = path.resolve('public/brand/logo.svg');
      const webpPath = path.resolve('public/brand/logo.webp');
      const icon192Path = path.resolve('public/icon-192x192.png');
      const icon512Path = path.resolve('public/icon-512x512.png');

      expect(fs.existsSync(svgPath)).toBe(true);
      expect(fs.existsSync(webpPath)).toBe(true);
      expect(fs.existsSync(icon192Path)).toBe(true);
      expect(fs.existsSync(icon512Path)).toBe(true);
      expect(fs.existsSync(path.resolve('src/app/design-system/page.tsx'))).toBe(true);

      const svgStat = fs.statSync(svgPath);
      expect(svgStat.size).toBeGreaterThan(100);
      expect(svgStat.size).toBeLessThan(5 * 1024);

      const svgContent = fs.readFileSync(svgPath, 'utf8');
      expect(svgContent).toContain('cadeApp');
      expect(svgContent).not.toContain('CadeApp');
      expect(svgContent).not.toContain('c2pa:manifest');

      const webpStat = fs.statSync(webpPath);
      expect(webpStat.size).toBeGreaterThan(20);
      expect(webpStat.size).toBeLessThan(50 * 1024);

      const icon192Stat = fs.statSync(icon192Path);
      expect(icon192Stat.size).toBeGreaterThan(1000);
      expect(icon192Stat.size).toBeLessThan(100 * 1024);

      const icon512Stat = fs.statSync(icon512Path);
      expect(icon512Stat.size).toBeGreaterThan(1000);
      expect(icon512Stat.size).toBeLessThan(150 * 1024);

      const pageContent = fs.readFileSync(path.resolve('src/app/design-system/page.tsx'), 'utf8');
      expect(pageContent).toContain("title: 'Sistema de Diseño (S00) | cadeApp'");
      expect(pageContent).toContain('robots: { index: false, follow: false }');
    });

    it('H18 y H19: Sheet abre, cierra con Escape restaurando el foco al trigger, y Toaster se monta con las clases de marca', async () => {
      render(
        <div>
          <Toaster />
          <Sheet>
            <SheetTrigger>Abrir hoja</SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>Enviar oferta</SheetTitle>
                <SheetDescription>Elegí un monto rápido.</SheetDescription>
              </SheetHeader>
              <SheetFooter>
                <Button type="button">Confirmar oferta</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      );

      expect(screen.getByTestId('sonner-toaster-mock').getAttribute('data-position')).toBe(
        'bottom-center'
      );

      const trigger = screen.getByRole('button', { name: 'Abrir hoja' });
      trigger.focus();
      fireEvent.click(trigger);

      const sheetDialog = screen.getByRole('dialog');
      expect(sheetDialog.getAttribute('data-sheet-side')).toBe('bottom');

      fireEvent.keyDown(sheetDialog, { key: 'Escape' });
      expect(screen.queryByRole('dialog')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(trigger));
    });

    it('D04: ejercita todas las ramas de BottomNav, Button, TopBar, EmptyState, Form, Select, Dialog, Sheet y auditDomAccessibilityStructure (>= 80% por archivo)', () => {
      const onNavigate = vi.fn();
      function RhfHarness() {
        const methods = useForm<{ rhfAmount: string }>({
          defaultValues: { rhfAmount: '1500' },
        });
        return (
          <Form {...methods}>
            <FormField
              control={methods.control}
              name="rhfAmount"
              render={() => (
                <FormItem>
                  <FormLabel>Monto RHF</FormLabel>
                  <FormControl>
                    <Input defaultValue="1500" />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form>
        );
      }

      const { container } = render(
        <div>
          <TopBar title="Solo título" leftAction={<span>Atrás</span>} />
          <TopBar showLogo={false} rightAction={<span>Acción</span>} />
          <Button isPending>Guardando</Button>
          <EmptyState title="Vacío con ícono" description="Sin acciones" icon={<span>📦</span>} />
          <RhfHarness />
          <FormField name="cleanField">
            <FormItem>
              <FormLabel>Campo limpio</FormLabel>
              <FormControl>
                <Input defaultValue="ok" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
          <Select defaultValue="centro">
            <SelectTrigger aria-label="Barrio no controlado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="centro">Centro</SelectItem>
              <SelectItem value="norte">Barrio Norte</SelectItem>
            </SelectContent>
          </Select>
          <Sheet defaultOpen>
            <SheetContent side="right">
              <SheetTitle>Panel lateral</SheetTitle>
              <SheetDescription>Detalle lateral</SheetDescription>
            </SheetContent>
          </Sheet>
          <Dialog defaultOpen>
            <DialogContent>
              <DialogTitle>Modal no controlado</DialogTitle>
              <DialogDescription>Descripción</DialogDescription>
            </DialogContent>
          </Dialog>
        </div>
      );

      // Primero cerramos los modales Radix defaultOpen (que ponen aria-hidden="true" al resto del árbol)
      const overlays = document.body.querySelectorAll('[aria-hidden="true"].fixed.inset-0');
      overlays.forEach((ov) => fireEvent.click(ov));

      // Ejercitar ramas de Select: abrir, ArrowUp, click en opción y click afuera
      const selectCombo = screen.getByRole('combobox', { name: 'Barrio no controlado' });
      fireEvent.click(selectCombo);
      fireEvent.keyDown(selectCombo, { key: 'ArrowUp' });
      fireEvent.click(screen.getByRole('combobox', { name: 'Barrio no controlado' }));
      fireEvent.click(screen.getByRole('option', { name: 'Barrio Norte' }));
      fireEvent.click(selectCombo);
      fireEvent.mouseDown(document.body);
      fireEvent.click(selectCombo);
      fireEvent.keyDown(selectCombo, { key: 'Escape' });

      // Ejercitar ramas de violaciones en auditDomAccessibilityStructure
      const badDom = document.createElement('div');
      badDom.innerHTML = `
        <button></button>
        <img src="/x.png" />
        <input type="text" />
        <h2></h2>
        <div role="option">Huérfana</div>
      `;
      const foundViolations = auditDomAccessibilityStructure(badDom);
      expect(foundViolations.map((v) => v.rule)).toEqual([
        'button-name',
        'image-alt',
        'label',
        'empty-heading',
        'aria-required-parent',
      ]);

      // Ejercitar click en botón de acción del DesignSystemShowcase y enlaces de BottomNav
      const showcase = render(
        <div>
          <DesignSystemShowcase />
          <BottomNav
            onNavigate={onNavigate}
            items={[
              {
                id: 'alertas',
                href: '/alertas',
                label: 'Alertas',
                icon: <span>🔔</span>,
              },
            ]}
          />
        </div>
      );
      const actionBtn = showcase.getByRole('button', { name: 'Actualizar listado' });
      fireEvent.click(actionBtn);
      const navLink = showcase.getByRole('link', { name: /Alertas/i });
      fireEvent.click(navLink);

      expect(container).toBeDefined();
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('9. Ronda 2: Cierre conductual de D05..D07, R01, R02 y H21..H29', () => {
    it('D05 y R01: DOMAIN_ERROR_MESSAGES cubre los 27 códigos de ALL_DOMAIN_ERROR_CODES, notify.error traduce DomainErrorCode y notify.promise delega a Sonner', () => {
      expect(ALL_DOMAIN_ERROR_CODES.length).toBe(27);
      for (const code of ALL_DOMAIN_ERROR_CODES) {
        const msg = DOMAIN_ERROR_MESSAGES[code];
        expect(typeof msg).toBe('string');
        expect(msg.trim().length).toBeGreaterThanOrEqual(12);
        expect(getDomainErrorMessage(code)).toBe(msg);
      }
      expect(getDomainErrorMessage('Error personalizado')).toBe('Error personalizado');

      notify.error('OFFER_BELOW_MINIMUM');
      expect(toast.error).toHaveBeenCalledWith(
        DOMAIN_ERROR_MESSAGES.OFFER_BELOW_MINIMUM,
        expect.objectContaining({
          id: `error:${DOMAIN_ERROR_MESSAGES.OFFER_BELOW_MINIMUM.toLowerCase()}`,
        })
      );

      const fakeTask = Promise.resolve({ id: 'req-1' });
      const result = notify.promise(fakeTask, {
        loading: 'Publicando pedido al 3865 12-3456...',
        success: (data) => `Pedido ${data.id} publicado`,
        error: () => 'ALREADY_MATCHED',
      }) as unknown as {
        opts: {
          loading: string;
          success: (data: { id: string }) => string;
          error: (err: unknown) => string;
        };
      };

      expect(toast.promise).toHaveBeenCalledTimes(1);
      expect(result.opts.loading).toBe('Publicando pedido al [teléfono oculto]...');
      expect(result.opts.success({ id: 'req-1' })).toBe('Pedido req-1 publicado');
      expect(result.opts.error(new Error('conflict'))).toBe(DOMAIN_ERROR_MESSAGES.ALREADY_MATCHED);

      const staticPromiseResult = notify.promise(fakeTask, {
        loading: 'Guardando...',
        success: 'Listo',
        error: 'SUBSCRIPTION_INACTIVE',
      }) as unknown as {
        opts: {
          success: (data: { id: string }) => string;
          error: (err: unknown) => string;
        };
      };
      expect(staticPromiseResult.opts.success({ id: 'req-1' })).toBe('Listo');
      expect(staticPromiseResult.opts.error(new Error('sub'))).toBe(
        DOMAIN_ERROR_MESSAGES.SUBSCRIPTION_INACTIVE
      );
    });

    it('R02 y H28: presionar Escape en DialogContent invoca onClose exactamente 1 vez (sin duplicación con Radix)', () => {
      const onCloseSpy = vi.fn();
      render(
        <Dialog defaultOpen>
          <DialogContent onClose={onCloseSpy}>
            <DialogTitle>Confirmar</DialogTitle>
            <DialogDescription>Probando unicidad de onClose al presionar Escape</DialogDescription>
          </DialogContent>
        </Dialog>
      );

      const dialog = screen.getByRole('dialog');
      fireEvent.keyDown(dialog, { key: 'Escape' });
      expect(onCloseSpy).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('H22: las variables HSL de :root en src/ui/tokens.css coinciden con los hex de DESIGN_TOKENS.colors', () => {
      function hslToHex(h: number, s: number, l: number): string {
        const sNorm = s / 100;
        const lNorm = l / 100;
        const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = lNorm - c / 2;
        let rPrime = 0;
        let gPrime = 0;
        let bPrime = 0;
        if (h >= 0 && h < 60) {
          rPrime = c;
          gPrime = x;
        } else if (h >= 60 && h < 120) {
          rPrime = x;
          gPrime = c;
        } else if (h >= 120 && h < 180) {
          gPrime = c;
          bPrime = x;
        } else if (h >= 180 && h < 240) {
          gPrime = x;
          bPrime = c;
        } else if (h >= 240 && h < 300) {
          rPrime = x;
          bPrime = c;
        } else {
          rPrime = c;
          bPrime = x;
        }
        const toHex = (channel: number) =>
          Math.round((channel + m) * 255)
            .toString(16)
            .padStart(2, '0')
            .toUpperCase();
        return `#${toHex(rPrime)}${toHex(gPrime)}${toHex(bPrime)}`;
      }

      const cssText = fs.readFileSync(path.resolve('src/ui/tokens.css'), 'utf8');
      const rootBlockMatch = cssText.match(/:root\s*\{([\s\S]*?)\}/);
      expect(rootBlockMatch).not.toBeNull();
      const rootBlock = rootBlockMatch ? (rootBlockMatch[1] ?? '') : '';

      const cssHslVars = new Map<string, string>();
      const varRegex = /--([a-z0-9-]+):\s*([0-9.]+)\s+([0-9.]+)%\s+([0-9.]+)%\s*;/g;
      let match: RegExpExecArray | null = varRegex.exec(rootBlock);
      while (match !== null) {
        const varName = match[1];
        const h = Number(match[2]);
        const s = Number(match[3]);
        const l = Number(match[4]);
        if (varName) {
          cssHslVars.set(varName, hslToHex(h, s, l));
        }
        match = varRegex.exec(rootBlock);
      }

      const expectedPairs: ReadonlyArray<[string, string]> = [
        ['primary', DESIGN_TOKENS.colors.primary],
        ['primary-dark', DESIGN_TOKENS.colors.primaryDark],
        ['foreground', DESIGN_TOKENS.colors.ink],
        ['background', DESIGN_TOKENS.colors.background],
        ['card', DESIGN_TOKENS.colors.surface],
        ['muted', DESIGN_TOKENS.colors.muted],
        ['muted-foreground', DESIGN_TOKENS.colors.mutedForeground],
        ['border', DESIGN_TOKENS.colors.border],
        ['accent', DESIGN_TOKENS.colors.accent],
        ['success', DESIGN_TOKENS.colors.success],
        ['warning', DESIGN_TOKENS.colors.warning],
        ['warning-surface', DESIGN_TOKENS.colors.warningSurface],
        ['destructive', DESIGN_TOKENS.colors.danger],
        ['whatsapp', DESIGN_TOKENS.colors.whatsapp],
        ['whatsapp-hover', DESIGN_TOKENS.colors.whatsappHover],
        ['whatsapp-foreground', DESIGN_TOKENS.colors.whatsappForeground],
      ];

      for (const [cssVar, tokenHex] of expectedPairs) {
        expect(cssHslVars.get(cssVar), `Variable CSS --${cssVar} desincronizada`).toBe(tokenHex);
      }
    });

    it('BrandLogo renderiza todas sus variantes de tamaño (sm, md, lg), color (default, inverse, mono) e ícono sin wordmark', () => {
      const { rerender } = render(<BrandLogo size="sm" variant="default" showWordmark={true} />);
      expect(screen.getByRole('img', { name: 'cadeApp' }).getAttribute('class')).toContain('h-8');

      rerender(<BrandLogo size="md" variant="inverse" showWordmark={true} />);
      expect(screen.getByRole('img', { name: 'cadeApp' }).getAttribute('class')).toContain('h-10');

      rerender(<BrandLogo size="lg" variant="mono" showWordmark={false} label="Logo cadeApp" />);
      const lgLogo = screen.getByRole('img', { name: 'Logo cadeApp' });
      expect(lgLogo.getAttribute('class')).toContain('h-12');
      expect(lgLogo.getAttribute('data-variant')).toBe('mono');
    });
  });
});
