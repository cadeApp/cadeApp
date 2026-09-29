// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axe = require('../../../node_modules/.pnpm/axe-core@4.13.0/node_modules/axe-core');

import { CreateRequestForm } from './components/create-request-form';
import { RequestOffersList } from './components/request-offers-list';
import { TripMerchantView, TripCourierView, type TripDetails } from '@/features/trips';
import { MerchantOnboardingForm } from '@/features/merchants';

// Mocks estándar para componentes de Next.js y utilidades de UI
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('@/ui/notify', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/ui/map', () => ({
  MapPicker: () => <div data-testid="mock-map-picker" />,
  AGUILARES_CENTER: { lat: -27.4341, lng: -65.6144 },
}));

vi.mock('@/features/requests/actions', () => ({
  createDeliveryRequestAction: vi.fn(),
}));

vi.mock('@/features/offers', () => ({
  acceptOfferAction: vi.fn(),
}));

const mockTripDetails: TripDetails = {
  id: '00000000-0000-4000-8000-000000000001',
  code: 'VIA-1001',
  status: 'matched',
  merchantId: 'merchant-1',
  merchantName: 'Pizzería Centro',
  merchantPhone: '3815559876',
  courierId: 'courier-1',
  courierName: 'Carlos Repartidor',
  courierPhone: '3815550000',
  vehicleType: 'moto',
  licensePlate: 'A123BCD',
  avatarUrl: null,
  amountArs: 1500,
  pickupAddress: 'San Martín 123',
  pickupZoneName: 'Centro',
  pickupLat: -27.43,
  pickupLng: -65.61,
  dropoffAddress: 'Belgrano 456',
  dropoffZoneName: 'San Martín',
  dropoffLat: -27.44,
  dropoffLng: -65.62,
  deliveryNotes: null,
  recipientName: 'Juan Pérez',
  recipientPhone: '3815551234',
  recipientPaymentMethod: 'cash',
  needsChange: false,
  cashChangeAmount: null,
  createdAt: new Date().toISOString(),
  matchedAt: new Date().toISOString(),
  pickedUpAt: null,
  deliveredAt: null,
};

const mockZones = [
  { id: '11111111-1111-4111-8111-111111111111', name: 'Centro', centroidLat: -27.43, centroidLng: -65.61 },
  { id: '22222222-2222-4222-8222-222222222222', name: 'San Martín', centroidLat: -27.44, centroidLng: -65.62 },
];

describe('T-205 DoD Fase RED: Auditoría inicial de Accesibilidad y Rendimiento', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DoD 1.1: al menos una violación axe en las pantallas auditadas (fase roja)', async () => {
    // Renderizamos la vista de viaje del comercio (TripMerchantView)
    const { container } = render(<TripMerchantView trip={mockTripDetails} />);

    // Ejecución de axe con reglas de accesibilidad WCAG 2.1 AA (incluyendo orden de jerarquía de encabezados)
    const results = await axe.run(container, {
      rules: {
        'heading-order': { enabled: true },
      },
    });

    // En la fase roja, la vista contiene una violación de jerarquía de encabezados (h1 -> h3 omitiendo h2)
    // Se espera que no haya violaciones, por lo que el test falla demostrando la fase roja requerida
    const violations = results.violations.map((v: { id: string; help: string }) => ({
      id: v.id,
      help: v.help,
    }));

    expect(
      violations,
      'TripMerchantView debe cumplir con la jerarquía de encabezados axe sin violaciones'
    ).toEqual([]);
  });

  it('DoD 1.2: al menos un objetivo táctil menor a 48 px en las pantallas auditadas (fase roja)', () => {
    const { container } = render(<CreateRequestForm zones={mockZones} />);

    // Recolectar botones interactivos
    const buttons = Array.from(container.querySelectorAll('button'));
    const undersizedTargets: Array<{ text: string; className: string }> = [];

    for (const btn of buttons) {
      const className = btn.className || '';
      const text = btn.textContent?.trim() || btn.getAttribute('aria-label') || '';

      // Detección de clases que reducen la altura por debajo de 48px (ej. min-h-[44px], py-1.5, min-h-10)
      if (className.includes('min-h-[44px]') || className.includes('min-h-10') || className.includes('py-1.5')) {
        undersizedTargets.push({ text, className });
      }
    }

    // En la fase roja, el botón de geolocalización y los botones de cambio miden 44px (< 48px).
    // Esperamos 0 objetivos por debajo de 48px, fallando la aserción.
    expect(
      undersizedTargets,
      'Todos los objetivos táctiles interactivos deben medir al menos 48 px (sin min-h-[44px])'
    ).toEqual([]);
  });

  it('DoD 1.3: al menos un input numérico o de teléfono sin atributo inputmode (fase roja)', () => {
    const { container: reqContainer } = render(<CreateRequestForm zones={mockZones} />);
    const { container: merchantContainer } = render(<MerchantOnboardingForm zones={mockZones} />);

    const inputsToAudit = [
      ...Array.from(reqContainer.querySelectorAll('input[type="tel"], input#recipient-phone')),
      ...Array.from(merchantContainer.querySelectorAll('input[type="tel"], input#phone')),
    ];

    const inputsWithoutInputMode: Array<{ id: string | null; type: string | null }> = [];

    for (const input of inputsToAudit) {
      const inputMode = input.getAttribute('inputmode');
      if (!inputMode) {
        inputsWithoutInputMode.push({
          id: input.getAttribute('id'),
          type: input.getAttribute('type'),
        });
      }
    }

    // En la fase roja, los inputs de teléfono de comercio y destinatario carecen de inputmode.
    // Esperamos que todos tengan inputmode definido, fallando la aserción.
    expect(
      inputsWithoutInputMode,
      'Los inputs de teléfono y numéricos deben declarar inputmode="numeric" o "tel"'
    ).toEqual([]);
  });

  it('DoD 1.4: al menos una ruta de comercio o repartidor supera el presupuesto First Load JS de 180 kB (fase roja)', () => {
    // Lectura del manifest de compilación de Next.js generado en .next/app-build-manifest.json
    const manifestPath = path.resolve(process.cwd(), '.next/app-build-manifest.json');
    expect(fs.existsSync(manifestPath), 'El build de Next.js debe existir para auditar presupuesto').toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      pages: Record<string, string[]>;
    };

    const routesToAudit = [
      '/(courier)/courier/feed/page',
      '/(courier)/courier/offers/page',
      '/(courier)/courier/profile/page',
      '/(courier)/courier/profile/notifications/page',
      '/trips/[id]/page',
    ];

    const overBudgetRoutes: Array<{ route: string; sizeKb: number }> = [];
    const MAX_BUDGET_KB = 180;

    for (const route of routesToAudit) {
      const files = manifest.pages[route] ?? [];
      let totalGzipBytes = 0;

      for (const file of files) {
        const filePath = path.resolve(process.cwd(), '.next', file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath);
          const gzipped = require('zlib').gzipSync(content);
          totalGzipBytes += gzipped.length;
        }
      }

      const sizeKb = Number((totalGzipBytes / 1024).toFixed(1));
      if (sizeKb > MAX_BUDGET_KB) {
        overBudgetRoutes.push({ route, sizeKb });
      }
    }

    // En la fase roja, las rutas de courier feed/offers/profile y trips superan los 180 kB.
    // Esperamos 0 rutas que superen el presupuesto, fallando la aserción.
    expect(
      overBudgetRoutes,
      `Las rutas de comercio y repartidor deben mantenerse dentro del presupuesto de ${MAX_BUDGET_KB} kB`
    ).toEqual([]);
  });
});
