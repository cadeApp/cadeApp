// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { TripMerchantView } from './components/trip-merchant-view';
import { TripCourierView } from './components/trip-courier-view';
import { TripCancelDialog } from './components/trip-cancel-dialog';
import { TripSkeleton } from './components/trip-skeleton';
import { TripErrorState } from './components/trip-error-state';
import { TripEmptyState } from './components/trip-empty-state';
import { formatVehicleType, formatRecipientPaymentMethod } from './format';
import type { TripDetails } from './types';

describe('T-115 DoD: Componentes visuales C06, R07 y T05 (H10)', () => {
  const baseTrip: TripDetails = {
    id: 'req-uuid-1',
    code: 'REQ-1234',
    status: 'matched',
    merchantId: 'merchant-1',
    courierId: 'courier-1',
    courierName: 'Carlos Benítez',
    vehicleType: 'moto',
    licensePlate: 'AB 123 CD',
    avatarUrl: null,
    amountArs: 1800,
    pickupAddress: 'San Martín 450, Centro',
    pickupZoneName: 'Centro',
    dropoffAddress: 'Belgrano 1220, Aguilares',
    dropoffZoneName: 'Barrio Sur',
    deliveryNotes: 'Frente a la plaza',
    recipientName: 'Laura Gómez',
    recipientPhone: '3865123456',
    recipientPaymentMethod: 'cash',
    needsChange: true,
    cashChangeAmount: 5000,
    createdAt: '2026-09-24T10:00:00Z',
    matchedAt: '2026-09-24T10:05:00Z',
    pickedUpAt: null,
    deliveredAt: null,
  };

  // =========================================================================
  // C06: Vista de Viaje del Comercio
  // =========================================================================
  describe('C06: TripMerchantView', () => {
    it('muestra el stepper con estados: Asignada, Retirado y Entregado', () => {
      render(<TripMerchantView trip={baseTrip} />);

      expect(screen.getByText(/Asignada/i)).toBeDefined();
      expect(screen.getByText(/Retirado/i)).toBeDefined();
      expect(screen.getByText(/Entregado/i)).toBeDefined();
    });

    it('muestra tarjeta del cadete con nombre, vehículo, patente y botón de WhatsApp', () => {
      render(<TripMerchantView trip={baseTrip} />);

      expect(screen.getByText('Carlos Benítez')).toBeDefined();
      expect(screen.getByText(/Moto/i)).toBeDefined();
      expect(screen.getByText('AB 123 CD')).toBeDefined();

      const waBtn = screen.getByRole('link', { name: /WhatsApp/i });
      expect(waBtn).toBeDefined();
      expect(waBtn.getAttribute('href')).toContain('wa.me');
      expect(waBtn.getAttribute('href')).toContain('5493865123456');
    });

    it('muestra tarjeta destacada "Avisale a tu cliente" con botón de 48px y texto preparado', () => {
      render(<TripMerchantView trip={baseTrip} />);

      expect(screen.getByText(/Avisale a tu cliente/i)).toBeDefined();
      expect(screen.getByText(/Laura Gómez/i)).toBeDefined();

      const notifyCustomerBtn = screen.getByRole('link', { name: /Avisar a mi cliente/i });
      expect(notifyCustomerBtn).toBeDefined();
      expect(notifyCustomerBtn.getAttribute('href')).toContain('wa.me');
      expect(notifyCustomerBtn.className).toContain('min-h-[48px]');
    });

    it('muestra contingencias: "El repartidor no llegó" y "Cancelar envío"', () => {
      const onNoShow = vi.fn();
      const onCancel = vi.fn();
      render(
        <TripMerchantView
          trip={baseTrip}
          onReportNoShow={onNoShow}
          onCancelTrip={onCancel}
        />
      );

      const noShowBtn = screen.getByRole('button', { name: /El repartidor no llegó/i });
      const cancelBtn = screen.getByRole('button', { name: /Cancelar envío/i });

      expect(noShowBtn).toBeDefined();
      expect(cancelBtn).toBeDefined();

      fireEvent.click(noShowBtn);
      expect(onNoShow).toHaveBeenCalled();

      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalled();
    });

    it('muestra estado pendiente y deshabilitado en contingencia cuando se está reportando no show (H10)', () => {
      render(
        <TripMerchantView
          trip={baseTrip}
          onReportNoShow={vi.fn()}
          isReportingNoShow={true}
        />
      );

      const noShowBtn = screen.getByRole('button', { name: /Reportando\.\.\./i });
      expect((noShowBtn as HTMLButtonElement).disabled).toBe(true);
      expect(noShowBtn.getAttribute('aria-busy')).toBe('true');
    });

    it('soporta navegación y foco visible en los botones interactivos (H10)', () => {
      const onCancel = vi.fn();
      render(<TripMerchantView trip={baseTrip} onCancelTrip={onCancel} />);

      const cancelBtn = screen.getByRole('button', { name: /Cancelar envío/i });
      cancelBtn.focus();
      expect(document.activeElement).toBe(cancelBtn);
    });

    it('no renderiza "$ 0" cuando amountArs es null o inválido en el viaje (H21)', () => {
      const tripWithoutAmount: TripDetails = { ...baseTrip, amountArs: null };
      render(<TripMerchantView trip={tripWithoutAmount} />);

      expect(screen.queryByText(/\$\s*0\b/)).toBeNull();
      expect(screen.getByText(/Monto a confirmar/i)).toBeDefined();
    });
  });

  // =========================================================================
  // R07: Vista de Viaje del Repartidor
  // =========================================================================
  describe('R07: TripCourierView', () => {
    it('muestra tarjeta de cobro en mano destacada: $ 1.800 en Efectivo con cambio de $ 5.000', () => {
      render(<TripCourierView trip={baseTrip} />);

      expect(screen.getByText(/Cobrás al entregar/i)).toBeDefined();
      expect(screen.getByText(/\$ 1\.800/i)).toBeDefined();
      expect(screen.getByText(/Efectivo/i)).toBeDefined();
      expect(screen.getByText(/\$ 5\.000/i)).toBeDefined();
    });

    it('muestra direcciones exactas reveladas de retiro y entrega', () => {
      render(<TripCourierView trip={baseTrip} />);

      expect(screen.getByText('San Martín 450, Centro')).toBeDefined();
      expect(screen.getByText('Belgrano 1220, Aguilares')).toBeDefined();
      expect(screen.getByText(/Frente a la plaza/i)).toBeDefined();
    });

    it('no incluye botón "Abrir en Google Maps" ni coordenadas en T-115 (H15)', () => {
      render(<TripCourierView trip={baseTrip} />);

      const mapsLink = screen.queryByRole('link', { name: /Abrir en Google Maps/i });
      expect(mapsLink).toBeNull();
    });

    it('tiene botón sticky gigante de 56px de avance de viaje: "Marcar como retirado" en matched', () => {
      const onAdvance = vi.fn();
      render(<TripCourierView trip={baseTrip} onAdvanceTrip={onAdvance} />);

      const advanceBtn = screen.getByRole('button', { name: /Marcar como retirado/i });
      expect(advanceBtn).toBeDefined();
      expect(advanceBtn.className).toContain('min-h-[56px]');

      fireEvent.click(advanceBtn);
      expect(onAdvance).toHaveBeenCalled();
    });

    it('soporta navegación y foco en el botón de avance de viaje (H10)', () => {
      render(<TripCourierView trip={baseTrip} onAdvanceTrip={vi.fn()} />);

      const advanceBtn = screen.getByRole('button', { name: /Marcar como retirado/i });
      advanceBtn.focus();
      expect(document.activeElement).toBe(advanceBtn);
    });

    it('tiene botón sticky gigante de 56px: "Confirmar entrega ($ 1.800)" en in_transit', () => {
      const onAdvance = vi.fn();
      const inTransitTrip: TripDetails = { ...baseTrip, status: 'in_transit' };
      render(<TripCourierView trip={inTransitTrip} onAdvanceTrip={onAdvance} />);

      const deliveredBtn = screen.getByRole('button', { name: /Confirmar entrega \(\$ 1\.800\)/i });
      expect(deliveredBtn).toBeDefined();
      expect(deliveredBtn.className).toContain('min-h-[56px]');
    });

    it('no renderiza "$ 0" cuando amountArs es null o no disponible (H21)', () => {
      const tripWithoutAmount: TripDetails = { ...baseTrip, amountArs: null };
      render(<TripCourierView trip={tripWithoutAmount} />);

      expect(screen.queryByText(/\$\s*0\b/)).toBeNull();
      expect(screen.getByText(/Monto a confirmar/i)).toBeDefined();
    });
  });

  // =========================================================================
  // T05: Diálogo de Cancelación en 2 Pasos con Motivo Obligatorio
  // =========================================================================
  describe('T05: TripCancelDialog (Cancelación irreversible)', () => {
    it('requiere motivo no vacío: el botón de confirmar está deshabilitado sin selección', () => {
      render(
        <TripCancelDialog
          open={true}
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
          isPending={false}
        />
      );

      const nextBtn = screen.getByRole('button', { name: /Continuar/i });
      expect((nextBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('flujo en 2 pasos: selección de motivo y advertencia de confirmación irreversible', async () => {
      const onConfirm = vi.fn();
      render(
        <TripCancelDialog
          open={true}
          onOpenChange={vi.fn()}
          onConfirm={onConfirm}
          isPending={false}
        />
      );

      // Paso 1: Elegir motivo
      const option = screen.getByRole('radio', { name: /Ya no hace falta/i });
      fireEvent.click(option);

      const nextBtn = screen.getByRole('button', { name: /Continuar/i });
      expect((nextBtn as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(nextBtn);

      // Paso 2: Pantalla de confirmación con advertencia de irreversibilidad
      expect(screen.getByText(/¿Confirmás la cancelación definitiva\?/i)).toBeDefined();
      expect(screen.getByText(/No se puede deshacer/i)).toBeDefined();

      const finalBtn = screen.getByRole('button', { name: /Sí, cancelar/i });
      expect(finalBtn.className).toContain('min-h-[48px]');

      fireEvent.click(finalBtn);
      expect(onConfirm).toHaveBeenCalledWith('Ya no hace falta');
    });

    it('muestra estado pending en el botón mientras la acción está en curso', () => {
      render(
        <TripCancelDialog
          open={true}
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
          isPending={true}
          defaultStep={2}
          selectedReason="Ya no hace falta"
        />
      );

      const finalBtn = screen.getByRole('button', { name: /Cancelando\.\.\./i });
      expect((finalBtn as HTMLButtonElement).disabled).toBe(true);
      expect(finalBtn.getAttribute('aria-busy')).toBe('true');
    });
  });

  // =========================================================================
  // Estados Skeleton, Error y Empty
  // =========================================================================
  describe('Estados visuales obligatorios (Skeleton, Error, Empty)', () => {
    it('TripSkeleton imita la forma de la pantalla de viaje', () => {
      render(<TripSkeleton />);
      expect(screen.getByTestId('trip-skeleton')).toBeDefined();
    });

    it('TripErrorState muestra mensaje empático en es-AR con botón de reintentar', () => {
      const onRetry = vi.fn();
      render(<TripErrorState onRetry={onRetry} code="5F2A" />);

      expect(screen.getByText(/Algo salió mal/i)).toBeDefined();
      expect(screen.getByText(/5F2A/i)).toBeDefined();

      const retryBtn = screen.getByRole('button', { name: /Reintentar/i });
      expect(retryBtn.className).toContain('min-h-[48px]');
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalled();
    });

    it('TripEmptyState muestra estado vacío empático', () => {
      render(<TripEmptyState />);
      expect(screen.getByText(/Viaje no encontrado/i)).toBeDefined();
    });
  });

  // =========================================================================
  // H17: Mapeo exhaustivo de enums
  // =========================================================================
  describe('H17: Mapeo exhaustivo de enums (vehicleType y recipientPaymentMethod)', () => {
    it('mapea correctamente todos los tipos de vehículo a es-AR', () => {
      expect(formatVehicleType('walk')).toBe('A pie');
      expect(formatVehicleType('bike')).toBe('Bicicleta');
      expect(formatVehicleType('moto')).toBe('Moto');
      expect(formatVehicleType('car')).toBe('Auto');
      expect(formatVehicleType(null)).toBe('Repartidor');
      expect(formatVehicleType(undefined)).toBe('Repartidor');
    });

    it('mapea correctamente todos los métodos de pago a es-AR', () => {
      expect(formatRecipientPaymentMethod('cash')).toBe('Efectivo');
      expect(formatRecipientPaymentMethod('transfer')).toBe('Transferencia');
      expect(formatRecipientPaymentMethod('to_agree')).toBe('A coordinar');
      expect(formatRecipientPaymentMethod(null)).toBe('A coordinar');
      expect(formatRecipientPaymentMethod(undefined)).toBe('A coordinar');
    });

    it('muestra el vehículo correcto en TripMerchantView según el enum', () => {
      const tripWalk: TripDetails = { ...baseTrip, vehicleType: 'walk' };
      const { rerender } = render(<TripMerchantView trip={tripWalk} />);
      expect(screen.getByText('A pie')).toBeDefined();

      rerender(<TripMerchantView trip={{ ...baseTrip, vehicleType: 'car' }} />);
      expect(screen.getByText('Auto')).toBeDefined();
    });
  });

  // =========================================================================
  // H18: Anti-12px — Erradicación total de text-xs
  // =========================================================================
  describe('H18: Anti-12px — Erradicación de text-xs en componentes de viaje', () => {
    it('no contiene ninguna clase text-xs en src/features/trips/components', () => {
      const componentsDir = path.resolve(__dirname, 'components');
      const files = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.tsx'));

      const violations: string[] = [];
      const textXsRegex = /\btext-xs\b/;

      for (const file of files) {
        const fullPath = path.join(componentsDir, file);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (textXsRegex.test(line)) {
            violations.push(`${file}:${idx + 1}: ${line.trim()}`);
          }
        });
      }

      expect(violations).toEqual([]);
    });
  });
});

