// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { TripCancelDialog } from './trip-cancel-dialog';
import { TripCourierView } from './trip-courier-view';
import { TripMerchantView } from './trip-merchant-view';
import { TripCourierContainer } from './trip-courier-container';
import { TripMerchantContainer } from './trip-merchant-container';
import type { TripDetails } from '../types';

// Expectations contractuales fijas e independientes de las constantes de producción (H03)
const EXPECTED_MERCHANT_REASONS = [
  'Ya no hace falta',
  'Lo resolví de otra forma',
  'Me equivoqué en los datos',
  'Otro',
] as const;

const EXPECTED_COURIER_REASONS = [
  'Tuve un imprevisto',
  'Problema con el vehículo',
  'No puedo llegar al punto de retiro',
  'Emergencia',
  'Otro',
] as const;

const mockRouterRefresh = vi.fn();
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: mockRouterPush,
  }),
}));

const mockCourierCancelTripAction = vi.fn();
const mockMerchantCancelTripAction = vi.fn();
vi.mock('../actions', () => ({
  courierCancelTripAction: (...args: unknown[]) => mockCourierCancelTripAction(...args),
  merchantCancelTripAction: (...args: unknown[]) => mockMerchantCancelTripAction(...args),
  markTripPickedUpAction: vi.fn(),
  markTripDeliveredAction: vi.fn(),
  markDropDeliveredAction: vi.fn(),
  markDropFailedAction: vi.fn(),
  merchantReportNoShowAction: vi.fn(),
}));

vi.mock('@/ui/notify', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  APILoadingStatus: {
    NOT_LOADED: 'NOT_LOADED',
    LOADING: 'LOADING',
    LOADED: 'LOADED',
    FAILED: 'FAILED',
  },
  useApiLoadingStatus: () => 'LOADED',
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Polyline: () => null,
}));

describe('T-362: TripCancelDialog por rol', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseTrip: TripDetails = {
    id: 'req-uuid-1',
    code: 'REQ-1234',
    status: 'matched',
    merchantId: 'merchant-1',
    merchantName: 'Kiosco Centro',
    merchantPhone: '3865222222',
    courierId: 'courier-1',
    courierName: 'Carlos Benítez',
    courierPhone: '3865111111',
    vehicleType: 'moto',
    licensePlate: 'AB 123 CD',
    avatarUrl: 'https://signed.test/avatar.webp',
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

  describe('Rol Comercio (actor="merchant")', () => {
    it('muestra exactamente el conjunto contractual de razones del comercio y ninguna de repartidor (H03)', () => {
      render(
        <TripCancelDialog
          open={true}
          actor="merchant"
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(EXPECTED_MERCHANT_REASONS.length);

      // Razones del comercio presentes en orden contractual exacto
      EXPECTED_MERCHANT_REASONS.forEach((reason, index) => {
        expect(radios[index]?.getAttribute('value')).toBe(reason);
        expect(screen.getByRole('radio', { name: reason })).toBeDefined();
      });

      // Razones del repartidor contractualmente ausentes
      expect(screen.queryByRole('radio', { name: 'Tuve un imprevisto' })).toBeNull();
      expect(screen.queryByRole('radio', { name: 'Problema con el vehículo' })).toBeNull();
      expect(screen.queryByRole('radio', { name: 'No puedo llegar al punto de retiro' })).toBeNull();
      expect(screen.queryByRole('radio', { name: 'Emergencia' })).toBeNull();
    });

    it('copy de confirmación en paso 2 advierte sobre cancelación definitiva', () => {
      render(
        <TripCancelDialog
          open={true}
          actor="merchant"
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: 'Ya no hace falta' }));
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

      expect(screen.getByText(/¿Confirmás la cancelación definitiva\?/i)).toBeDefined();
      expect(screen.getByText(/Las ofertas se van a cerrar\. No se puede deshacer\./i)).toBeDefined();
    });

    it('despacha la razón seleccionada exacta en onConfirm', () => {
      const onConfirm = vi.fn();
      render(
        <TripCancelDialog
          open={true}
          actor="merchant"
          onOpenChange={vi.fn()}
          onConfirm={onConfirm}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: 'Lo resolví de otra forma' }));
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
      fireEvent.click(screen.getByRole('button', { name: /Sí, cancelar/i }));

      expect(onConfirm).toHaveBeenCalledWith('Lo resolví de otra forma');
    });
  });

  describe('Rol Repartidor (actor="courier")', () => {
    it('muestra exactamente el conjunto contractual de razones del repartidor y ninguna de comercio (H03)', () => {
      render(
        <TripCancelDialog
          open={true}
          actor="courier"
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(EXPECTED_COURIER_REASONS.length);

      // Razones del repartidor presentes en orden contractual exacto (incluye 'Emergencia')
      EXPECTED_COURIER_REASONS.forEach((reason, index) => {
        expect(radios[index]?.getAttribute('value')).toBe(reason);
        expect(screen.getByRole('radio', { name: reason })).toBeDefined();
      });

      // Razones de comercio ausentes
      expect(screen.queryByRole('radio', { name: 'Ya no hace falta' })).toBeNull();
      expect(screen.queryByRole('radio', { name: 'Lo resolví de otra forma' })).toBeNull();
      expect(screen.queryByRole('radio', { name: 'Me equivoqué en los datos' })).toBeNull();
    });

    it('copy de confirmación en paso 2 advierte sobre liberación/republicación del viaje', () => {
      render(
        <TripCancelDialog
          open={true}
          actor="courier"
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: 'Tuve un imprevisto' }));
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

      expect(screen.getByText(/¿Confirmás que no podés hacer este viaje\?/i)).toBeDefined();
      expect(
        screen.getByText(/La solicitud volverá a publicarse para que otro repartidor pueda tomarla\./i)
      ).toBeDefined();
      expect(screen.queryByText(/cancelación definitiva/i)).toBeNull();
    });

    it('despacha la razón del repartidor exacta en onConfirm', () => {
      const onConfirm = vi.fn();
      render(
        <TripCancelDialog
          open={true}
          actor="courier"
          onOpenChange={vi.fn()}
          onConfirm={onConfirm}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: 'Problema con el vehículo' }));
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
      fireEvent.click(screen.getByRole('button', { name: /Sí, cancelar/i }));

      expect(onConfirm).toHaveBeenCalledWith('Problema con el vehículo');
    });
  });

  describe('Opción «Otro» con aclaración obligatoria', () => {
    it('al seleccionar «Otro», exige texto de aclaración no vacío para habilitar Continuar', () => {
      render(
        <TripCancelDialog
          open={true}
          actor="courier"
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      const continueBtn = screen.getByRole('button', { name: /Continuar/i });
      fireEvent.click(screen.getByRole('radio', { name: 'Otro' }));

      // Campo de aclaración visible
      const input = screen.getByTestId('cancellation-other-reason-input');
      expect(input).toBeDefined();

      // Botón deshabilitado con aclaración vacía o con espacios
      expect((continueBtn as HTMLButtonElement).disabled).toBe(true);
      fireEvent.change(input, { target: { value: '    ' } });
      expect((continueBtn as HTMLButtonElement).disabled).toBe(true);

      // Habilitado con texto válido
      fireEvent.change(input, { target: { value: 'Problemas familiares urgentes' } });
      expect((continueBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it('en paso 2 y onConfirm se envía la aclaración real y no el literal vacío «Otro»', () => {
      const onConfirm = vi.fn();
      render(
        <TripCancelDialog
          open={true}
          actor="courier"
          onOpenChange={vi.fn()}
          onConfirm={onConfirm}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: 'Otro' }));
      const input = screen.getByTestId('cancellation-other-reason-input');
      fireEvent.change(input, { target: { value: 'Desperfecto en frenos de la moto' } });

      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

      // En paso 2 muestra el texto ingresado
      expect(screen.getByText('Desperfecto en frenos de la moto')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /Sí, cancelar/i }));
      expect(onConfirm).toHaveBeenCalledWith('Desperfecto en frenos de la moto');
      expect(onConfirm).not.toHaveBeenCalledWith('Otro');
    });

    it('botón Atrás conserva la selección de «Otro» y la aclaración escrita', () => {
      render(
        <TripCancelDialog
          open={true}
          actor="merchant"
          onOpenChange={vi.fn()}
          onConfirm={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: 'Otro' }));
      const input = screen.getByTestId('cancellation-other-reason-input');
      fireEvent.change(input, { target: { value: 'El cliente cambió de opinión' } });

      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));
      expect(screen.getByText('El cliente cambió de opinión')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: /Atrás/i }));

      const inputRetornado = screen.getByTestId('cancellation-other-reason-input') as HTMLTextAreaElement;
      expect(inputRetornado.value).toBe('El cliente cambió de opinión');
      expect((screen.getByRole('radio', { name: 'Otro' }) as HTMLInputElement).checked).toBe(true);
    });

    it('al cerrar el modal se resetea el estado y la aclaración', () => {
      const onOpenChange = vi.fn();
      const { rerender } = render(
        <TripCancelDialog
          open={true}
          actor="courier"
          onOpenChange={onOpenChange}
          onConfirm={vi.fn()}
        />
      );

      fireEvent.click(screen.getByRole('radio', { name: 'Otro' }));
      const input = screen.getByTestId('cancellation-other-reason-input');
      fireEvent.change(input, { target: { value: 'Lluvia torrencial' } });

      fireEvent.click(screen.getByRole('button', { name: /Volver/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);

      // Reabrir modal debe estar limpio
      rerender(
        <TripCancelDialog
          open={true}
          actor="courier"
          onOpenChange={onOpenChange}
          onConfirm={vi.fn()}
        />
      );
      expect((screen.getByRole('button', { name: /Continuar/i }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('Acotamiento de cancelación pre-retiro en vistas (matched vs in_transit)', () => {
    it('TripCourierView: en matched muestra «No puedo hacer este viaje»', () => {
      const onCancel = vi.fn();
      render(<TripCourierView trip={baseTrip} onCancelTrip={onCancel} />);

      const cancelBtn = screen.getByRole('button', { name: /No puedo hacer este viaje/i });
      expect(cancelBtn).toBeDefined();
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('TripCourierView: en in_transit NO muestra «No puedo hacer este viaje»', () => {
      const onCancel = vi.fn();
      render(
        <TripCourierView
          trip={{ ...baseTrip, status: 'in_transit', pickedUpAt: '2026-09-24T10:15:00Z' }}
          onCancelTrip={onCancel}
        />
      );

      expect(screen.queryByRole('button', { name: /No puedo hacer este viaje/i })).toBeNull();
    });

    it('TripCourierView: en delivered NO muestra «No puedo hacer este viaje»', () => {
      const onCancel = vi.fn();
      render(
        <TripCourierView
          trip={{
            ...baseTrip,
            status: 'delivered',
            pickedUpAt: '2026-09-24T10:15:00Z',
            deliveredAt: '2026-09-24T10:30:00Z',
          }}
          onCancelTrip={onCancel}
        />
      );

      expect(screen.queryByRole('button', { name: /No puedo hacer este viaje/i })).toBeNull();
    });

    it('TripMerchantView: en matched muestra «Cancelar envío»', () => {
      const onCancel = vi.fn();
      render(<TripMerchantView trip={baseTrip} onCancelTrip={onCancel} />);

      const cancelBtn = screen.getByRole('button', { name: /Cancelar envío/i });
      expect(cancelBtn).toBeDefined();
      fireEvent.click(cancelBtn);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('TripMerchantView: en in_transit NO muestra «Cancelar envío»', () => {
      const onCancel = vi.fn();
      render(
        <TripMerchantView
          trip={{ ...baseTrip, status: 'in_transit', pickedUpAt: '2026-09-24T10:15:00Z' }}
          onCancelTrip={onCancel}
        />
      );

      expect(screen.queryByRole('button', { name: /Cancelar envío/i })).toBeNull();
    });
  });

  describe('Integración de contenedores y wiring de actor (H04)', () => {
    it('TripCourierContainer transmite actor="courier" al diálogo y llama a courierCancelTripAction', async () => {
      mockCourierCancelTripAction.mockResolvedValue({ ok: true });
      render(<TripCourierContainer trip={baseTrip} />);

      // Abre modal desde la acción en vista
      const cancelTrigger = screen.getByRole('button', { name: /No puedo hacer este viaje/i });
      fireEvent.click(cancelTrigger);

      // Espera y verifica que el diálogo cargó con razones de courier (falla si el container pasa actor="merchant")
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: 'Problema con el vehículo' })).toBeDefined();
        expect(screen.getByRole('radio', { name: 'Emergencia' })).toBeDefined();
        expect(screen.queryByRole('radio', { name: 'Ya no hace falta' })).toBeNull();
      });

      // Selecciona motivo de cadete
      fireEvent.click(screen.getByRole('radio', { name: 'Emergencia' }));
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

      // Confirmar paso 2
      const confirmBtn = screen.getByRole('button', { name: /Sí, cancelar/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockCourierCancelTripAction).toHaveBeenCalledWith({
          requestId: baseTrip.id,
          reason: 'Emergencia',
        });
      });
    });

    it('TripMerchantContainer transmite actor="merchant" al diálogo y llama a merchantCancelTripAction', async () => {
      mockMerchantCancelTripAction.mockResolvedValue({ ok: true });
      render(<TripMerchantContainer trip={baseTrip} />);

      // Abre modal desde la acción en vista
      const cancelTrigger = screen.getByRole('button', { name: /Cancelar envío/i });
      fireEvent.click(cancelTrigger);

      // Espera y verifica que el diálogo cargó con razones de merchant (falla si el container pasa actor="courier")
      await waitFor(() => {
        expect(screen.getByRole('radio', { name: 'Ya no hace falta' })).toBeDefined();
        expect(screen.getByRole('radio', { name: 'Me equivoqué en los datos' })).toBeDefined();
        expect(screen.queryByRole('radio', { name: 'Emergencia' })).toBeNull();
      });

      // Selecciona motivo de comercio
      fireEvent.click(screen.getByRole('radio', { name: 'Me equivoqué en los datos' }));
      fireEvent.click(screen.getByRole('button', { name: /Continuar/i }));

      // Confirmar paso 2
      const confirmBtn = screen.getByRole('button', { name: /Sí, cancelar/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(mockMerchantCancelTripAction).toHaveBeenCalledWith({
          requestId: baseTrip.id,
          reason: 'Me equivoqué en los datos',
        });
      });
    });
  });
});
