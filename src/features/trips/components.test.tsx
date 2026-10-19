// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { TripMerchantView } from './components/trip-merchant-view';
import { TripCourierView } from './components/trip-courier-view';
import { TripCourierContainer } from './components/trip-courier-container';
import { TripCancelDialog } from './components/trip-cancel-dialog';
import { TripSkeleton } from './components/trip-skeleton';
import { TripErrorState } from './components/trip-error-state';
import { TripEmptyState } from './components/trip-empty-state';
import { formatVehicleType, formatRecipientPaymentMethod } from './format';
import type { TripDetails } from './types';

const mockRouterRefresh = vi.fn();
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: mockRouterPush,
  }),
}));

const mockMarkDropDeliveredAction = vi.fn();
const mockMarkDropFailedAction = vi.fn();
const mockMarkTripDeliveredAction = vi.fn();
const mockMarkTripPickedUpAction = vi.fn();
const mockCourierCancelTripAction = vi.fn();

vi.mock('./actions', () => ({
  markDropDeliveredAction: (...args: unknown[]) => mockMarkDropDeliveredAction(...args),
  markDropFailedAction: (...args: unknown[]) => mockMarkDropFailedAction(...args),
  markTripDeliveredAction: (...args: unknown[]) => mockMarkTripDeliveredAction(...args),
  markTripPickedUpAction: (...args: unknown[]) => mockMarkTripPickedUpAction(...args),
  courierCancelTripAction: (...args: unknown[]) => mockCourierCancelTripAction(...args),
}));

const mockNotifySuccess = vi.fn();
const mockNotifyError = vi.fn();
vi.mock('@/ui/notify', () => ({
  notify: {
    success: (...args: unknown[]) => mockNotifySuccess(...args),
    error: (...args: unknown[]) => mockNotifyError(...args),
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

function asHtmlElement(el: Element | null | undefined): HTMLElement {
  if (!el || !(el instanceof HTMLElement)) {
    throw new Error('Element is not an HTMLElement');
  }
  return el;
}

describe('T-115 DoD: Componentes visuales C06, R07 y T05 (H10)', () => {
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

  const multiDropTrip: TripDetails = {
    ...baseTrip,
    id: 'trip-multi-1',
    status: 'in_transit',
    dropsCount: 3,
    amountArs: 1500,
    totalAmountArs: 4500,
    collectibleAmountArs: 3000,
    drops: [
      {
        id: 'drop-1',
        position: 1,
        dropoffZoneName: 'Centro',
        dropoffAddress: 'Calle Uno 100',
        recipientName: 'Ana',
        recipientPhone: '3865111111',
        deliveryNotes: null,
        cashChangeAmount: null,
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        needsChange: false,
        approxDistanceM: 1000,
        status: 'delivered',
        deliveredAt: '2026-09-24T10:15:00Z',
        failedReason: null,
        dropoffLat: null,
        dropoffLng: null,
      },
      {
        id: 'drop-2',
        position: 2,
        dropoffZoneName: 'San Martín',
        dropoffAddress: 'Calle Dos 200',
        recipientName: 'Beto',
        recipientPhone: '3865222222',
        deliveryNotes: 'Dejar en puerta',
        cashChangeAmount: 1000,
        packageType: 'chico',
        recipientPaymentMethod: 'cash',
        needsChange: true,
        approxDistanceM: 1500,
        status: 'pending',
        deliveredAt: null,
        failedReason: null,
        dropoffLat: null,
        dropoffLng: null,
      },
      {
        id: 'drop-3',
        position: 3,
        dropoffZoneName: 'Barrio Sur',
        dropoffAddress: 'Calle Tres 300',
        recipientName: 'Carla',
        recipientPhone: '3865333333',
        deliveryNotes: null,
        cashChangeAmount: null,
        packageType: 'mediano',
        recipientPaymentMethod: 'transfer',
        needsChange: false,
        approxDistanceM: 2000,
        status: 'failed',
        deliveredAt: null,
        failedReason: 'No respondió al timbre',
        dropoffLat: null,
        dropoffLng: null,
      },
    ],
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
      expect(waBtn.getAttribute('href')).toContain('5493865111111');
      expect(decodeURIComponent(waBtn.getAttribute('href') ?? '')).toContain('REQ-1234');
      expect(decodeURIComponent(waBtn.getAttribute('href') ?? '')).toContain(
        'Centro -> Barrio Sur'
      );
      expect(decodeURIComponent(waBtn.getAttribute('href') ?? '')).toContain('$ 1.800');
      expect(decodeURIComponent(waBtn.getAttribute('href') ?? '')).toContain('Efectivo');
      expect(screen.getByRole('img', { name: /Foto de Carlos Benítez/i })).toBeDefined();

      const callBtn = screen.getByRole('link', { name: /Llamar/i });
      expect(callBtn.getAttribute('href')).toBe('tel:3865111111');
    });

    it('muestra tarjeta destacada "Avisale a tu cliente" con botón de 48px y texto preparado en 3ª persona', () => {
      render(<TripMerchantView trip={baseTrip} />);

      expect(screen.getByText(/Avisale a tu cliente/i)).toBeDefined();
      expect(screen.getByText(/Laura Gómez/i)).toBeDefined();

      const notifyCustomerBtn = screen.getByRole('link', { name: /Avisar a mi cliente/i });
      expect(notifyCustomerBtn).toBeDefined();
      expect(notifyCustomerBtn.getAttribute('href')).toContain('wa.me');
      expect(notifyCustomerBtn.getAttribute('href')).toContain('5493865123456');
      expect(notifyCustomerBtn.className).toContain('min-h-[48px]');

      const decodedText = decodeURIComponent(notifyCustomerBtn.getAttribute('href') ?? '');
      expect(decodedText).toContain('Carlos Benítez es el repartidor asignado');
      expect(decodedText).not.toMatch(/soy\s+carlos/i);
      expect(decodedText.toLowerCase()).not.toContain('en camino');
    });

    it('T-361: en multi-drop el comercio avisa a cada cliente según el estado de su entrega en 3ª persona', () => {
      render(<TripMerchantView trip={multiDropTrip} />);

      // La tarjeta muestra una sola etiqueta visible para cada cliente; el CTA no duplica esos nombres en texto visible
      expect(screen.getAllByText(/^Ana$/i)).toHaveLength(1);
      expect(screen.getAllByText(/^Beto$/i)).toHaveLength(1);
      expect(screen.getAllByText(/^Carla$/i)).toHaveLength(1);
      expect(screen.queryAllByText(/Avisar a Ana/i)).toHaveLength(0);
      expect(screen.queryAllByText(/Avisar a Beto/i)).toHaveLength(0);
      expect(screen.queryAllByText(/Avisar a Carla/i)).toHaveLength(0);

      const waAna = screen.getByRole('link', { name: /Avisar a Ana por WhatsApp/i });
      expect(waAna.textContent?.trim()).toBe('Avisar por WhatsApp');
      expect(waAna.getAttribute('aria-label')).toBe('Avisar a Ana por WhatsApp');
      expect(waAna.getAttribute('href')).toContain('5493865111111');
      const textAna = decodeURIComponent(waAna.getAttribute('href') ?? '');
      expect(textAna).toContain('ya fue entregado por Carlos Benítez');
      expect(textAna).not.toMatch(/soy\s+carlos/i);
      expect(textAna.toLowerCase()).not.toContain('en camino');

      const waBeto = screen.getByRole('link', { name: /Avisar a Beto por WhatsApp/i });
      expect(waBeto.textContent?.trim()).toBe('Avisar por WhatsApp');
      expect(waBeto.getAttribute('aria-label')).toBe('Avisar a Beto por WhatsApp');
      expect(waBeto.getAttribute('href')).toContain('5493865222222');
      const textBeto = decodeURIComponent(waBeto.getAttribute('href') ?? '');
      expect(textBeto).toContain('está en recorrido');
      expect(textBeto).not.toMatch(/soy\s+carlos/i);
      expect(textBeto).not.toContain('ya fue entregado');

      const waCarla = screen.getByRole('link', { name: /Avisar a Carla por WhatsApp/i });
      expect(waCarla.textContent?.trim()).toBe('Avisar por WhatsApp');
      expect(waCarla.getAttribute('aria-label')).toBe('Avisar a Carla por WhatsApp');
      expect(waCarla.getAttribute('href')).toContain('5493865333333');
      const textCarla = decodeURIComponent(waCarla.getAttribute('href') ?? '');
      expect(textCarla).toContain('no pudo completar la entrega');
      expect(textCarla).not.toMatch(/soy\s+carlos/i);
      expect(textCarla.toLowerCase()).not.toContain('en camino');
      expect(textCarla).not.toContain('ya fue entregado');
    });

    it('T-361: si el cliente tiene teléfono inválido o ausente, muestra botón deshabilitado sin crash (comercio)', () => {
      const tripInvalidPhone: TripDetails = {
        ...baseTrip,
        recipientPhone: 'telefono-invalido',
      };
      render(<TripMerchantView trip={tripInvalidPhone} />);

      const disabledBtn = screen.getByRole('button', { name: /WhatsApp no disponible/i });
      expect(disabledBtn).toBeDefined();
      expect((disabledBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it('muestra contingencias: "El repartidor no llegó" y "Cancelar envío"', () => {
      const onNoShow = vi.fn();
      const onCancel = vi.fn();
      render(
        <TripMerchantView trip={baseTrip} onReportNoShow={onNoShow} onCancelTrip={onCancel} />
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
        <TripMerchantView trip={baseTrip} onReportNoShow={vi.fn()} isReportingNoShow={true} />
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

    it('usa tokens semánticos de WhatsApp y nunca el teléfono del cliente para contactar al cadete', () => {
      render(<TripMerchantView trip={baseTrip} />);

      const waBtn = screen.getByRole('link', { name: /^WhatsApp$/i });
      expect(waBtn.className).toContain('bg-whatsapp');
      expect(waBtn.className).toContain('text-whatsapp-foreground');
      expect(waBtn.getAttribute('href')).toContain('5493865111111');
      expect(waBtn.getAttribute('href')).not.toContain('5493865123456');
    });

    const getCardContainer = (heading: HTMLElement): HTMLElement => {
      const container = heading.closest('.shadow-card') ?? heading.parentElement?.parentElement;
      if (!container || !(container instanceof HTMLElement)) {
        throw new Error('Card container not found');
      }
      return container;
    };

    it('T-359 C: legacy single sin drops muestra Medio de pago en Card Repartidor asignado para cash, transfer y to_agree', () => {
      const cases: Array<{ method: 'cash' | 'transfer' | 'to_agree'; label: string }> = [
        { method: 'cash', label: 'Efectivo' },
        { method: 'transfer', label: 'Transferencia' },
        { method: 'to_agree', label: 'A coordinar' },
      ];

      for (const { method, label } of cases) {
        const { unmount } = render(
          <TripMerchantView
            trip={{
              ...baseTrip,
              recipientPaymentMethod: method,
              drops: undefined,
            }}
          />
        );

        const heading = screen.getByRole('heading', { level: 2, name: /repartidor asignado/i });
        const card = getCardContainer(heading);
        const paymentP = within(card).getByText(
          (_, el) => el?.tagName === 'P' && new RegExp(`Medio de pago:\\s*${label}`, 'i').test(el.textContent ?? '')
        );
        expect(paymentP).toBeDefined();

        // Verificar que no hay texto de pago dentro del bloque "Avisale a tu cliente"
        const customerHeading = screen.getByRole('heading', { level: 2, name: /avisale a tu cliente/i });
        const customerCard = getCardContainer(customerHeading);
        const leakedPayment = within(customerCard).queryByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:/i.test(el.textContent ?? '')
        );
        expect(leakedPayment).toBeNull();

        unmount();
      }
    });

    it('T-359 C: single con drops=[...] de 1 entrega usa drop.recipientPaymentMethod incluso si difiere del global', () => {
      const singleDropDifferentMethodTrip: TripDetails = {
        ...baseTrip,
        recipientPaymentMethod: 'cash', // global
        drops: [
          {
            id: 'drop-single-1',
            position: 1,
            dropoffZoneName: 'Barrio Sur',
            dropoffAddress: 'Belgrano 1220',
            recipientName: 'Laura Gómez',
            recipientPhone: '3865123456',
            deliveryNotes: null,
            cashChangeAmount: null,
            packageType: 'chico',
            recipientPaymentMethod: 'transfer', // debe prevalecer el del drop
            needsChange: false,
            approxDistanceM: 1000,
            status: 'pending',
            deliveredAt: null,
            failedReason: null,
            dropoffLat: null,
            dropoffLng: null,
          },
        ],
      };

      const { container, unmount } = render(<TripMerchantView trip={singleDropDifferentMethodTrip} />);

      const heading = within(container).getByRole('heading', { level: 2, name: /repartidor asignado/i });
      const card = getCardContainer(heading);
      const paymentP = within(card).getByText(
        (_, el) => el?.tagName === 'P' && /Medio de pago:\s*Transferencia/i.test(el.textContent ?? '')
      );
      expect(paymentP).toBeDefined();

      const unexpectedCash = within(card).queryByText(
        (_, el) => el?.tagName === 'P' && /Medio de pago:\s*Efectivo/i.test(el.textContent ?? '')
      );
      expect(unexpectedCash).toBeNull();

      unmount();
    });

    it('T-359 C: multi-drop con 3 entregas heterogéneas muestra el método por entrega y no un global engañoso', () => {
      const heterogeneousTrip: TripDetails = {
        ...multiDropTrip,
        recipientPaymentMethod: 'cash', // global engañoso
        drops: [
          {
            id: 'drop-c-1',
            position: 1,
            dropoffZoneName: 'Centro',
            dropoffAddress: 'Calle Uno 100',
            recipientName: 'Ana',
            recipientPhone: '3865111111',
            deliveryNotes: null,
            cashChangeAmount: null,
            packageType: 'chico',
            recipientPaymentMethod: 'cash',
            needsChange: false,
            approxDistanceM: 1000,
            status: 'delivered',
            deliveredAt: '2026-09-24T10:15:00Z',
            failedReason: null,
            dropoffLat: null,
            dropoffLng: null,
          },
          {
            id: 'drop-c-2',
            position: 2,
            dropoffZoneName: 'San Martín',
            dropoffAddress: 'Calle Dos 200',
            recipientName: 'Beto',
            recipientPhone: '3865222222',
            deliveryNotes: 'Dejar en puerta',
            cashChangeAmount: 1000,
            packageType: 'chico',
            recipientPaymentMethod: 'transfer',
            needsChange: true,
            approxDistanceM: 1500,
            status: 'pending',
            deliveredAt: null,
            failedReason: null,
            dropoffLat: null,
            dropoffLng: null,
          },
          {
            id: 'drop-c-3',
            position: 3,
            dropoffZoneName: 'Barrio Sur',
            dropoffAddress: 'Calle Tres 300',
            recipientName: 'Carla',
            recipientPhone: '3865333333',
            deliveryNotes: null,
            cashChangeAmount: null,
            packageType: 'mediano',
            recipientPaymentMethod: 'to_agree',
            needsChange: false,
            approxDistanceM: 2000,
            status: 'failed',
            deliveredAt: null,
            failedReason: 'No respondió al timbre',
            dropoffLat: null,
            dropoffLng: null,
          },
        ],
      };

      const { container, unmount } = render(<TripMerchantView trip={heterogeneousTrip} />);

      // En multi-drop, la Card del repartidor NO debe mostrar un único medio de pago global
      const courierHeading = within(container).getByRole('heading', { level: 2, name: /repartidor asignado/i });
      const courierCard = getCardContainer(courierHeading);
      const globalPaymentP = within(courierCard).queryByText(
        (_, el) => el?.tagName === 'P' && /Medio de pago:/i.test(el.textContent ?? '')
      );
      expect(globalPaymentP).toBeNull();

      // Card 1: Ana -> Efectivo
      const cardAnaHeading = within(container).getByRole('heading', { level: 2, name: /avisale a tu cliente \(entrega 1\)/i });
      const cardAna = getCardContainer(cardAnaHeading);
      expect(
        within(cardAna).getByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*Efectivo/i.test(el.textContent ?? '')
        )
      ).toBeDefined();
      expect(
        within(cardAna).queryByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*Transferencia/i.test(el.textContent ?? '')
        )
      ).toBeNull();
      expect(
        within(cardAna).queryByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*A coordinar/i.test(el.textContent ?? '')
        )
      ).toBeNull();

      // Card 2: Beto -> Transferencia
      const cardBetoHeading = within(container).getByRole('heading', { level: 2, name: /avisale a tu cliente \(entrega 2\)/i });
      const cardBeto = getCardContainer(cardBetoHeading);
      expect(
        within(cardBeto).getByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*Transferencia/i.test(el.textContent ?? '')
        )
      ).toBeDefined();
      expect(
        within(cardBeto).queryByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*Efectivo/i.test(el.textContent ?? '')
        )
      ).toBeNull();
      expect(
        within(cardBeto).queryByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*A coordinar/i.test(el.textContent ?? '')
        )
      ).toBeNull();

      // Card 3: Carla -> A coordinar
      const cardCarlaHeading = within(container).getByRole('heading', { level: 2, name: /avisale a tu cliente \(entrega 3\)/i });
      const cardCarla = getCardContainer(cardCarlaHeading);
      expect(
        within(cardCarla).getByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*A coordinar/i.test(el.textContent ?? '')
        )
      ).toBeDefined();
      expect(
        within(cardCarla).queryByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*Efectivo/i.test(el.textContent ?? '')
        )
      ).toBeNull();
      expect(
        within(cardCarla).queryByText(
          (_, el) => el?.tagName === 'P' && /Medio de pago:\s*Transferencia/i.test(el.textContent ?? '')
        )
      ).toBeNull();

      unmount();
    });

    it('T-359 C / T-361: los mensajes de WhatsApp al cliente preservan privacidad (sin dinero ni método de pago)', () => {
      const { container, unmount } = render(<TripMerchantView trip={multiDropTrip} />);

      const waAna = within(container).getByRole('link', { name: /Avisar a Ana por WhatsApp/i });
      const textAna = decodeURIComponent(waAna.getAttribute('href') ?? '');
      expect(textAna).not.toMatch(/efectivo|transferencia|coordinar|\$\s*\d/i);

      const waBeto = within(container).getByRole('link', { name: /Avisar a Beto por WhatsApp/i });
      const textBeto = decodeURIComponent(waBeto.getAttribute('href') ?? '');
      expect(textBeto).not.toMatch(/efectivo|transferencia|coordinar|\$\s*\d/i);

      unmount();
    });
  });

  // =========================================================================
  // R07: Vista de Viaje del Repartidor
  // =========================================================================
  describe('R07: TripCourierView', () => {
    it('muestra contacto real del comercio con WhatsApp de coordinación', () => {
      render(<TripCourierView trip={baseTrip} />);

      expect(screen.getByText('Kiosco Centro')).toBeDefined();
      const waBtn = screen.getByRole('link', { name: /WhatsApp al comercio/i });
      expect(waBtn.getAttribute('href')).toContain('5493865222222');
      expect(waBtn.getAttribute('href')).not.toContain('5493865123456');
      expect(decodeURIComponent(waBtn.getAttribute('href') ?? '')).toContain('REQ-1234');
      const callBtn = screen.getByRole('link', { name: /Llamar/i });
      expect(callBtn.getAttribute('href')).toBe('tel:3865222222');
    });

    it('T-361: repartidor asignado tiene acceso a WhatsApp "Avisar a mi cliente" con texto pre-retiro en matched', () => {
      render(<TripCourierView trip={baseTrip} />);

      const waCustomerLink = screen.getByRole('link', { name: /Avisar a mi cliente/i });
      expect(waCustomerLink).toBeDefined();
      expect(waCustomerLink.getAttribute('href')).toContain('5493865123456');
      const decodedText = decodeURIComponent(waCustomerLink.getAttribute('href') ?? '');
      expect(decodedText).toContain('Soy Carlos Benítez');
      expect(decodedText).toContain('Ya tengo asignado tu pedido');
      expect(decodedText.toLowerCase()).not.toContain('en camino');
      expect(decodedText).not.toContain('REQ-1234');
    });

    it('T-361: en in_transit el repartidor tiene WhatsApp al cliente describiendo recorrido', () => {
      const inTransitTrip: TripDetails = { ...baseTrip, status: 'in_transit' };
      render(<TripCourierView trip={inTransitTrip} />);

      const waCustomerLink = screen.getByRole('link', { name: /Avisar a mi cliente/i });
      expect(waCustomerLink).toBeDefined();
      const decodedText = decodeURIComponent(waCustomerLink.getAttribute('href') ?? '');
      expect(decodedText).toContain('Soy Carlos Benítez');
      expect(decodedText).toMatch(/recorrido|reparto/i);
      expect(decodedText).not.toContain('ya fue entregado');
      expect(decodedText).not.toContain('REQ-1234');
    });

    it('T-361: en delivered el repartidor tiene WhatsApp al cliente confirmando entrega', () => {
      const deliveredTrip: TripDetails = { ...baseTrip, status: 'delivered' };
      render(<TripCourierView trip={deliveredTrip} />);

      const waCustomerLink = screen.getByRole('link', { name: /Avisar a mi cliente/i });
      expect(waCustomerLink).toBeDefined();
      const decodedText = decodeURIComponent(waCustomerLink.getAttribute('href') ?? '');
      expect(decodedText).toContain('Soy Carlos Benítez');
      expect(decodedText).toContain('ya fue entregado');
      expect(decodedText.toLowerCase()).not.toContain('en camino');
    });

    it('T-361: en multi-drop cada entrega tiene su propio enlace con el estado individual de cada drop', () => {
      render(<TripCourierView trip={multiDropTrip} />);

      // La tarjeta muestra una sola etiqueta visible Cliente: [nombre]; el CTA no duplica esos nombres en texto visible
      expect(screen.getAllByText(/^Cliente:\s*Ana$/i)).toHaveLength(1);
      expect(screen.getAllByText(/^Cliente:\s*Beto$/i)).toHaveLength(1);
      expect(screen.getAllByText(/^Cliente:\s*Carla$/i)).toHaveLength(1);
      expect(screen.queryAllByText(/^Avisar a Ana$/i)).toHaveLength(0);
      expect(screen.queryAllByText(/^Avisar a Beto$/i)).toHaveLength(0);
      expect(screen.queryAllByText(/^Avisar a Carla$/i)).toHaveLength(0);

      // Drop 1: Ana (delivered)
      const waDrop1 = screen.getByRole('link', { name: /Avisar a Ana por WhatsApp/i });
      expect(waDrop1.textContent?.trim()).toBe('Avisar por WhatsApp');
      expect(waDrop1.getAttribute('aria-label')).toBe('Avisar a Ana por WhatsApp');
      expect(waDrop1.getAttribute('href')).toContain('5493865111111');
      const textAna = decodeURIComponent(waDrop1.getAttribute('href') ?? '');
      expect(textAna).toContain('Soy Carlos Benítez');
      expect(textAna).toContain('ya fue entregado');
      expect(textAna.toLowerCase()).not.toContain('en camino');

      // Drop 2: Beto (pending)
      const waDrop2 = screen.getByRole('link', { name: /Avisar a Beto por WhatsApp/i });
      expect(waDrop2.textContent?.trim()).toBe('Avisar por WhatsApp');
      expect(waDrop2.getAttribute('aria-label')).toBe('Avisar a Beto por WhatsApp');
      expect(waDrop2.getAttribute('href')).toContain('5493865222222');
      const textBeto = decodeURIComponent(waDrop2.getAttribute('href') ?? '');
      expect(textBeto).toContain('Soy Carlos Benítez');
      expect(textBeto).toMatch(/recorrido|reparto/i);
      expect(textBeto).not.toContain('ya fue entregado');

      // Drop 3: Carla (failed)
      const waDrop3 = screen.getByRole('link', { name: /Avisar a Carla por WhatsApp/i });
      expect(waDrop3.textContent?.trim()).toBe('Avisar por WhatsApp');
      expect(waDrop3.getAttribute('aria-label')).toBe('Avisar a Carla por WhatsApp');
      expect(waDrop3.getAttribute('href')).toContain('5493865333333');
      const textCarla = decodeURIComponent(waDrop3.getAttribute('href') ?? '');
      expect(textCarla).toContain('Soy Carlos Benítez');
      expect(textCarla).toContain('no se pudo completar');
      expect(textCarla.toLowerCase()).not.toContain('en camino');
      expect(textCarla).not.toContain('ya fue entregado');
    });

    it('T-361: si el destinatario no tiene teléfono válido, no renderiza enlace de WhatsApp sin crash (repartidor)', () => {
      const tripWithoutPhone: TripDetails = {
        ...baseTrip,
        recipientPhone: '',
      };
      render(<TripCourierView trip={tripWithoutPhone} />);

      expect(screen.queryByRole('link', { name: /Avisar a mi cliente/i })).toBeNull();
    });

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

    it('incluye botón "Abrir en Google Maps" en T-117 (D7/D15)', () => {
      render(<TripCourierView trip={baseTrip} />);

      const mapsLink = screen.getByRole('link', { name: /Abrir en Google Maps/i });
      expect(mapsLink).toBeDefined();
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

    it('no contiene fallback económico inventado: el contrato entrega monto aceptado obligatorio', () => {
      render(<TripCourierView trip={baseTrip} />);
      expect(screen.getByText(/\$ 1\.800/i)).toBeDefined();
      expect(screen.queryByText(/Monto a confirmar/i)).toBeNull();
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

      expect(screen.getByRole('alertdialog')).toBeDefined();
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
  // T-350: Contraste AA del texto de acento (axe color-contrast)
  // =========================================================================
  describe('T-350: texto de acento con contraste AA (primary-dark)', () => {
    function expectPrimaryDarkText(element: HTMLElement) {
      expect(element.classList.contains('text-primary-dark')).toBe(true);
      expect(element.classList.contains('text-primary')).toBe(false);
    }

    it('R07: «Cobrás al entregar» usa text-primary-dark y nunca text-primary', () => {
      render(<TripCourierView trip={baseTrip} />);

      expectPrimaryDarkText(screen.getByText(/Cobrás al entregar/i));
    });

    it('C06: el paso pendiente «Retirado» usa text-primary-dark y nunca text-primary', () => {
      render(<TripMerchantView trip={baseTrip} />);

      const pendingStep = screen.getByText('Retirado').parentElement;
      expect(pendingStep).not.toBeNull();
      if (pendingStep) expectPrimaryDarkText(pendingStep);
    });
  });

  // =========================================================================
  // PR318-H10: Acciones individuales por drop en pantalla de courier
  // =========================================================================
  describe('PR318-H10: Acciones multi-drop del repartidor', () => {
    it('1 drop legacy en in_transit: muestra botón global Confirmar entrega y llama onAdvanceTrip', () => {
      const onAdvance = vi.fn();
      render(
        <TripCourierView trip={{ ...baseTrip, status: 'in_transit' }} onAdvanceTrip={onAdvance} />
      );

      const confirmBtn = screen.getByText(/Confirmar entrega/i);
      expect(confirmBtn).toBeDefined();
      fireEvent.click(confirmBtn);
      expect(onAdvance).toHaveBeenCalledTimes(1);
    });

    it('multi-drop en in_transit: renderiza botones por drop pendiente y no muestra botón global', () => {
      render(<TripCourierView trip={multiDropTrip} />);

      // No muestra el botón global de confirmar entrega para N>1
      expect(screen.queryByText(/Confirmar entrega \(/i)).toBeNull();

      // Muestra botones individuales para drop-2 (pending)
      expect(screen.getByTestId('mark-drop-delivered-drop-2')).toBeDefined();
      expect(screen.getByTestId('mark-drop-failed-drop-2')).toBeDefined();

      // No muestra botones para drop-1 (delivered) ni drop-3 (failed)
      expect(screen.queryByTestId('mark-drop-delivered-drop-1')).toBeNull();
      expect(screen.queryByTestId('mark-drop-delivered-drop-3')).toBeNull();

      // Muestra total cobrable acumulado
      expect(screen.getByText(/Total cobrable acumulado:/i)).toBeDefined();
    });

    it('al pulsar Entregada en drop-2, invoca onMarkDropDelivered exclusivamente con id del drop', () => {
      const onDeliver = vi.fn();
      const onAdvance = vi.fn();
      render(
        <TripCourierView
          trip={multiDropTrip}
          onMarkDropDelivered={onDeliver}
          onAdvanceTrip={onAdvance}
        />
      );

      fireEvent.click(screen.getByTestId('mark-drop-delivered-drop-2'));
      expect(onDeliver).toHaveBeenCalledExactlyOnceWith('drop-2');
      expect(onAdvance).not.toHaveBeenCalled();
    });

    it('al pulsar No se pudo entregar en drop-2, abre diálogo y exige motivo no vacío', () => {
      const onFailed = vi.fn();
      render(<TripCourierView trip={multiDropTrip} onMarkDropFailed={onFailed} />);

      // Abre diálogo
      fireEvent.click(screen.getByTestId('mark-drop-failed-drop-2'));
      expect(screen.getByRole('heading', { name: 'No se pudo entregar' })).toBeDefined();

      const confirmBtn = screen.getByTestId('confirm-drop-failed-btn');
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

      // Escribir solo espacios no habilita
      const input = screen.getByTestId('drop-failed-reason-input');
      fireEvent.change(input, { target: { value: '   ' } });
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

      // Escribir motivo válido habilita y despacha
      fireEvent.change(input, { target: { value: 'Destinatario ausente' } });
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(confirmBtn);

      expect(onFailed).toHaveBeenCalledExactlyOnceWith('drop-2', 'Destinatario ausente');
    });
  });

  describe('H10: Integración TripCourierContainer -> Server Actions', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('al pulsar Entregada en drop-2, despacha markDropDeliveredAction con {requestId, dropId} y nunca markTripDeliveredAction', async () => {
      mockMarkDropDeliveredAction.mockResolvedValue({ ok: true });

      render(<TripCourierContainer trip={multiDropTrip} />);

      const deliverBtn = screen.getByTestId('mark-drop-delivered-drop-2');
      fireEvent.click(deliverBtn);

      expect(mockMarkDropDeliveredAction).toHaveBeenCalledExactlyOnceWith({
        requestId: multiDropTrip.id,
        dropId: 'drop-2',
      });
      expect(mockMarkTripDeliveredAction).not.toHaveBeenCalled();

      // En éxito hace router.refresh y toast
      await waitFor(() => {
        expect(mockNotifySuccess).toHaveBeenCalledWith('Entrega confirmada.');
        expect(mockRouterRefresh).toHaveBeenCalled();
      });
    });

    it('si markDropDeliveredAction falla, muestra toast de error y no hace router.refresh', async () => {
      mockMarkDropDeliveredAction.mockResolvedValue({ ok: false, code: 'UNAUTHORIZED_ACTOR' });

      render(<TripCourierContainer trip={multiDropTrip} />);

      fireEvent.click(screen.getByTestId('mark-drop-delivered-drop-2'));

      await waitFor(() => {
        expect(mockNotifyError).toHaveBeenCalledWith('No se pudo confirmar la entrega.');
        expect(mockRouterRefresh).not.toHaveBeenCalled();
      });
    });

    it('al pulsar No se pudo entregar en drop-2 con motivo válido, despacha markDropFailedAction; motivo en blanco no lo invoca', async () => {
      mockMarkDropFailedAction.mockResolvedValue({ ok: true });

      render(<TripCourierContainer trip={multiDropTrip} />);

      fireEvent.click(screen.getByTestId('mark-drop-failed-drop-2'));

      const confirmBtn = screen.getByTestId('confirm-drop-failed-btn');
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);

      // Motivo en blanco no habilita
      const input = screen.getByTestId('drop-failed-reason-input');
      fireEvent.change(input, { target: { value: '   ' } });
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
      expect(mockMarkDropFailedAction).not.toHaveBeenCalled();

      // Motivo válido despacha
      fireEvent.change(input, { target: { value: 'Destinatario no responde al timbre' } });
      expect((confirmBtn as HTMLButtonElement).disabled).toBe(false);
      fireEvent.click(confirmBtn);

      expect(mockMarkDropFailedAction).toHaveBeenCalledExactlyOnceWith({
        requestId: multiDropTrip.id,
        dropId: 'drop-2',
        reason: 'Destinatario no responde al timbre',
      });

      await waitFor(() => {
        expect(mockNotifySuccess).toHaveBeenCalledWith(
          'Entrega registrada como no entregada.'
        );
        expect(mockRouterRefresh).toHaveBeenCalled();
      });
    });

    it('viaje 1-drop legacy en in_transit despacha markTripDeliveredAction y jamás markDropDeliveredAction', async () => {
      mockMarkTripDeliveredAction.mockResolvedValue({ ok: true });

      render(
        <TripCourierContainer trip={{ ...baseTrip, status: 'in_transit' }} />
      );

      const confirmBtn = screen.getByText(/Confirmar entrega/i);
      fireEvent.click(confirmBtn);

      expect(mockMarkTripDeliveredAction).toHaveBeenCalledExactlyOnceWith({
        requestId: baseTrip.id,
      });
      expect(mockMarkDropDeliveredAction).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(mockNotifySuccess).toHaveBeenCalledWith('¡Entrega confirmada!');
        expect(mockRouterRefresh).toHaveBeenCalled();
      });
    });

    it('T-373 / 5-A: al cancelar la asignación se queda en /trips/[id] (refresh) en vez de ir al feed', async () => {
      mockCourierCancelTripAction.mockResolvedValue({ ok: true, data: { requestId: baseTrip.id, status: 'published' } });

      render(<TripCourierContainer trip={baseTrip} />);

      fireEvent.click(screen.getByRole('button', { name: /no puedo hacer este viaje/i }));
      fireEvent.click(await screen.findByRole('radio', { name: 'Problema con el vehículo' }));
      fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
      fireEvent.click(await screen.findByRole('button', { name: /sí, cancelar/i }));

      await waitFor(() => {
        expect(mockCourierCancelTripAction).toHaveBeenCalledExactlyOnceWith({
          requestId: baseTrip.id,
          reason: 'Problema con el vehículo',
        });
        expect(mockRouterRefresh).toHaveBeenCalled();
      });
      expect(mockRouterPush).not.toHaveBeenCalled();
    });
  });
});
