// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateRequestForm } from './create-request-form';
import * as actions from '../actions';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/ui/notify', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../actions', () => ({
  createDeliveryRequestAction: vi.fn(),
}));

describe('T-112: CreateRequestForm', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockZones = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Barrio Centro',
      centroidLat: -27.43,
      centroidLng: -65.61,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Barrio San Martín',
      centroidLat: -27.44,
      centroidLng: -65.62,
    },
  ];

  it('renderiza todos los campos principales y precarga datos del comercio', () => {
    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: '11111111-1111-4111-8111-111111111111',
          defaultPickupLat: -27.43,
          defaultPickupLng: -65.61,
          notes: 'Timbre blanco',
        }}
      />
    );

    expect(screen.getByText('Nueva solicitud de envío')).toBeDefined();
    expect(screen.getByDisplayValue('San Martín 350')).toBeDefined();
    expect(screen.getByDisplayValue('Timbre blanco')).toBeDefined();
    expect(screen.getByText('Precargado editable')).toBeDefined();
  });

  it('muestra los chips de cambio en efectivo ("Paga con: $ 2.000 / $ 5.000 / $ 10.000") cuando needsChange es true', () => {
    render(<CreateRequestForm zones={mockZones} />);

    // Por defecto es Efectivo, needsChange es false
    expect(screen.queryByText('Paga con: $ 2.000')).toBeNull();

    // Hacemos click en "Sí" para cambio
    const yesButton = screen.getByRole('button', { name: 'Sí' });
    fireEvent.click(yesButton);

    // Ahora deben estar visibles los chips rápidos
    expect(screen.getByText('Paga con: $ 2.000')).toBeDefined();
    expect(screen.getByText('Paga con: $ 5.000')).toBeDefined();
    expect(screen.getByText('Paga con: $ 10.000')).toBeDefined();
  });

  it('permite seleccionar el tamaño del paquete entre sobre, chico, mediano y grande', () => {
    render(<CreateRequestForm zones={mockZones} />);

    expect(screen.getByText('Sobre')).toBeDefined();
    expect(screen.getByText('Chico')).toBeDefined();
    expect(screen.getByText('Mediano')).toBeDefined();
    expect(screen.getByText('Grande')).toBeDefined();
  });

  it('bloquea el submit si no se marca la declaración de consentimiento del destinatario', async () => {
    const { container } = render(<CreateRequestForm zones={mockZones} />);

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    if (!form) return;
    fireEvent.submit(form);

    expect(
      await screen.findByText('Debés declarar que contás con la autorización del destinatario.')
    ).toBeDefined();
    expect(actions.createDeliveryRequestAction).not.toHaveBeenCalled();
  });

  it('PR67-H01: muestra la confirmación de pin fijado usando el token válido text-primary y no text-success', () => {
    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: mockZones[0]?.id ?? 'zone-centro',
          defaultPickupLat: -27.43,
          defaultPickupLng: -65.61,
          notes: '',
        }}
      />
    );

    const pinBadge = screen.getByText('Pin de retiro fijado').closest('span');
    expect(pinBadge).not.toBeNull();
    expect(pinBadge?.className).toContain('text-primary');
    expect(pinBadge?.className).not.toContain('text-success');
  });
});

