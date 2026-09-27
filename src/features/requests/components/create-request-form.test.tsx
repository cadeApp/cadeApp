// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

interface MockMapPickerProps {
  readonly value?: { lat: number; lng: number } | null;
  readonly onChange?: (coords: { lat: number; lng: number }) => void;
  readonly defaultZoneCenter?: { lat: number; lng: number } | null;
}

let mockDropoffOnChange: ((coords: { lat: number; lng: number }) => void) | undefined;

vi.mock('@/ui/map', () => ({
  MapPicker: ({ value, onChange, defaultZoneCenter }: MockMapPickerProps) => {
    mockDropoffOnChange = onChange;
    return (
      <div data-testid="dropoff-map-picker">
        <span data-testid="dropoff-map-value">{JSON.stringify(value)}</span>
        <span data-testid="dropoff-default-zone">{JSON.stringify(defaultZoneCenter)}</span>
        <button
          type="button"
          data-testid="simulate-dropoff-pin"
          onClick={() => onChange?.({ lat: -27.4385, lng: -65.6185 })}
        >
          Mover pin entrega
        </button>
      </div>
    );
  },
  AGUILARES_CENTER: { lat: -27.4341, lng: -65.6144 },
}));

describe('T-112: CreateRequestForm', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mockDropoffOnChange = undefined;
  });

  const zoneCentro = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Barrio Centro',
    centroidLat: -27.43,
    centroidLng: -65.61,
  };
  const zoneSanMartin = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Barrio San Martín',
    centroidLat: -27.44,
    centroidLng: -65.62,
  };
  const mockZones = [zoneCentro, zoneSanMartin];

  it('renderiza todos los campos principales y precarga datos del comercio', () => {
    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: zoneCentro.id,
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
          defaultPickupZoneId: zoneCentro.id,
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

  it('T-116: permite alternar la vista del mapa interactivo para fijar el pin de entrega', () => {
    render(<CreateRequestForm zones={mockZones} />);

    const toggleBtn = screen.getByRole('button', { name: /fijar en mapa interactivo/i });
    expect(toggleBtn).toBeDefined();

    fireEvent.click(toggleBtn);
    expect(screen.getByRole('button', { name: /ocultar mapa/i })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /ocultar mapa/i }));
    expect(screen.getByRole('button', { name: /fijar en mapa interactivo/i })).toBeDefined();
  });

  it('H05: el evento onChange de MapPicker actualiza dropoffLat y dropoffLng y persisten en createDeliveryRequestAction', async () => {
    vi.mocked(actions.createDeliveryRequestAction).mockResolvedValueOnce({
      ok: true,
      data: { requestId: 'req-123', redirectTo: '/merchant/requests/req-123' },
    });

    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: zoneCentro.id,
          defaultPickupLat: -27.43,
          defaultPickupLng: -65.61,
          notes: 'Timbre blanco',
        }}
      />
    );

    // Abrir mapa de entrega
    const toggleMapBtn = screen.getByRole('button', { name: /fijar en mapa interactivo/i });
    fireEvent.click(toggleMapBtn);

    const pinBtn = await screen.findByTestId('simulate-dropoff-pin');

    // Completar campos obligatorios de entrega y destinatario
    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Sarmiento 1200' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'Lucía Gómez' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3815551234' },
    });
    const consentCheckbox = screen.getByRole('checkbox');
    fireEvent.click(consentCheckbox);

    // Mover pin de entrega
    fireEvent.click(pinBtn);

    // Verificar indicador de pin fijado
    expect(await screen.findByText('Pin fijado')).toBeDefined();

    // Enviar solicitud
    fireEvent.click(screen.getByRole('button', { name: /publicar solicitud/i }));

    await waitFor(() => {
      expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(1);
    });

    const firstCall = vi.mocked(actions.createDeliveryRequestAction).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const callArgs = firstCall[0] as Record<string, unknown>;
    expect(callArgs['dropoffLat']).toBe(-27.4385);
    expect(callArgs['dropoffLng']).toBe(-65.6185);
  });

  it('H09: con el mapa de entrega abierto, la vista presenta exactamente un input de dirección de entrega y una sola acción de GPS para entrega', async () => {
    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: zoneCentro.id,
          defaultPickupLat: -27.43,
          defaultPickupLng: -65.61,
          notes: '',
        }}
      />
    );

    // Abrir mapa interactivo
    fireEvent.click(screen.getByRole('button', { name: /fijar en mapa interactivo/i }));
    await screen.findByTestId('dropoff-map-picker');

    // Exactamente 1 input para dirección de entrega
    const dropoffAddressInputs = screen.getAllByLabelText(/dirección de entrega/i);
    expect(dropoffAddressInputs).toHaveLength(1);

    // Botones de geolocalización: exactamente 2 en total (uno en retiro, uno en entrega), ninguno duplicado por el mapa
    const gpsButtons = screen.getAllByRole('button', { name: /usar mi ubicación/i });
    expect(gpsButtons).toHaveLength(2);

    // Verificamos que dropoffAddress es único
    const allInputs = screen.getAllByRole('textbox');
    const dropoffAddressInputMatch = allInputs.filter(
      (input) => input.getAttribute('id') === 'dropoff-address'
    );
    expect(dropoffAddressInputMatch).toHaveLength(1);
  });
});
