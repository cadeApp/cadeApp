// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MerchantOnboardingForm } from './onboarding-form';
import { merchantOnboardingAction } from '../actions';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock('../actions', () => ({
  merchantOnboardingAction: vi.fn(),
}));

interface MockMapPickerProps {
  readonly value?: { lat: number; lng: number } | null;
  readonly onChange?: (coords: { lat: number; lng: number }) => void;
  readonly defaultZoneCenter?: { lat: number; lng: number } | null;
}

let mockOnChange: ((coords: { lat: number; lng: number }) => void) | undefined;

vi.mock('@/ui/map', () => ({
  MapPicker: ({ value, onChange, defaultZoneCenter }: MockMapPickerProps) => {
    mockOnChange = onChange;
    return (
      <div data-testid="map-picker">
        <span data-testid="map-value">{JSON.stringify(value)}</span>
        <span data-testid="map-default-zone-center">{JSON.stringify(defaultZoneCenter)}</span>
        <button
          type="button"
          data-testid="simulate-map-pin"
          onClick={() => onChange?.({ lat: -27.435, lng: -65.615 })}
        >
          Mover pin
        </button>
      </div>
    );
  },
  AGUILARES_CENTER: { lat: -27.4341, lng: -65.6144 },
}));

describe('T-116 / T-111: MerchantOnboardingForm con componente de mapa', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnChange = undefined;
  });

  const zoneA = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Centro',
    centroidLat: -27.431111,
    centroidLng: -65.611111,
  };
  const zoneB = {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Barrio Sur',
    centroidLat: -27.441222,
    centroidLng: -65.621222,
  };
  const zoneC = {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Barrio Sin Centroide',
    centroidLat: null,
    centroidLng: null,
  };
  const mockZones = [zoneA, zoneB, zoneC];

  function fillBaseForm() {
    fireEvent.change(screen.getByLabelText(/nombre del negocio/i), {
      target: { value: 'Comercio Aguilares' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3865123456' },
    });
    fireEvent.change(screen.getByLabelText(/dirección de retiro habitual/i), {
      target: { value: 'Av. Sarmiento 123' },
    });
    const termsCheckbox = screen.getByRole('checkbox');
    fireEvent.click(termsCheckbox);
  }

  it('renderiza el formulario de alta de comercio con los campos y el selector de mapa', () => {
    render(<MerchantOnboardingForm zones={mockZones} />);

    expect(screen.getByLabelText(/nombre del negocio/i)).toBeDefined();
    expect(screen.getByLabelText(/teléfono de contacto/i)).toBeDefined();
    expect(screen.getByLabelText(/barrio de retiro/i)).toBeDefined();
    expect(screen.getByLabelText(/dirección de retiro habitual/i)).toBeDefined();
  });

  it('permite ingresar la dirección manualmente aun sin interactuar con el mapa', () => {
    render(<MerchantOnboardingForm zones={mockZones} />);

    const addressInput = screen.getByLabelText(/dirección de retiro habitual/i);
    fireEvent.change(addressInput, { target: { value: 'San Martín 450' } });

    expect(addressInput).toHaveProperty('value', 'San Martín 450');
  });

  it('H04 (Caso A): si el usuario selecciona Zona Centro con centroide y no fija pin, el submit envía el centroide de Zona Centro', async () => {
    vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
      ok: true,
      data: { redirectTo: '/merchant/dashboard' },
    });
    render(<MerchantOnboardingForm zones={mockZones} />);
    await screen.findByTestId('map-picker');

    fillBaseForm();

    const zoneSelect = screen.getByLabelText(/barrio de retiro/i);
    fireEvent.change(zoneSelect, { target: { value: zoneA.id } });

    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));

    await waitFor(() => {
      expect(merchantOnboardingAction).toHaveBeenCalledTimes(1);
    });

    const firstCall = vi.mocked(merchantOnboardingAction).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const callArgs = firstCall[0] as Record<string, unknown>;
    expect(callArgs['defaultPickupZoneId']).toBe(zoneA.id);
    expect(callArgs['defaultPickupLat']).toBe(zoneA.centroidLat);
    expect(callArgs['defaultPickupLng']).toBe(zoneA.centroidLng);
  });

  it('H04 (Caso B): si el usuario cambia a Barrio Sur, el submit envía el centroide de Barrio Sur', async () => {
    vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
      ok: true,
      data: { redirectTo: '/merchant/dashboard' },
    });
    render(<MerchantOnboardingForm zones={mockZones} />);
    await screen.findByTestId('map-picker');

    fillBaseForm();

    const zoneSelect = screen.getByLabelText(/barrio de retiro/i);
    fireEvent.change(zoneSelect, { target: { value: zoneA.id } });
    fireEvent.change(zoneSelect, { target: { value: zoneB.id } });

    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));

    await waitFor(() => {
      expect(merchantOnboardingAction).toHaveBeenCalledTimes(1);
    });

    const firstCall = vi.mocked(merchantOnboardingAction).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const callArgs = firstCall[0] as Record<string, unknown>;
    expect(callArgs['defaultPickupZoneId']).toBe(zoneB.id);
    expect(callArgs['defaultPickupLat']).toBe(zoneB.centroidLat);
    expect(callArgs['defaultPickupLng']).toBe(zoneB.centroidLng);
  });

  it('H04 (Caso C): si el usuario fija un pin en el mapa, las coordenadas del pin anulan el centroide de la zona', async () => {
    vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
      ok: true,
      data: { redirectTo: '/merchant/dashboard' },
    });
    render(<MerchantOnboardingForm zones={mockZones} />);
    const pinBtn = await screen.findByTestId('simulate-map-pin');

    fillBaseForm();

    const zoneSelect = screen.getByLabelText(/barrio de retiro/i);
    fireEvent.change(zoneSelect, { target: { value: zoneA.id } });

    // Fija pin explícito (-27.435, -65.615)
    fireEvent.click(pinBtn);

    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));

    await waitFor(() => {
      expect(merchantOnboardingAction).toHaveBeenCalledTimes(1);
    });

    const firstCall = vi.mocked(merchantOnboardingAction).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const callArgs = firstCall[0] as Record<string, unknown>;
    expect(callArgs['defaultPickupLat']).toBe(-27.435);
    expect(callArgs['defaultPickupLng']).toBe(-65.615);
  });

  it('H04 (Caso D): si la zona no tiene centroide definido y no se fija pin, el submit envía null en coordenadas', async () => {
    vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
      ok: true,
      data: { redirectTo: '/merchant/dashboard' },
    });
    render(<MerchantOnboardingForm zones={mockZones} />);
    await screen.findByTestId('map-picker');

    fillBaseForm();

    const zoneSelect = screen.getByLabelText(/barrio de retiro/i);
    fireEvent.change(zoneSelect, { target: { value: zoneC.id } });

    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));

    await waitFor(() => {
      expect(merchantOnboardingAction).toHaveBeenCalledTimes(1);
    });

    const firstCall = vi.mocked(merchantOnboardingAction).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const callArgs = firstCall[0] as Record<string, unknown>;
    expect(callArgs['defaultPickupZoneId']).toBe(zoneC.id);
    expect(callArgs['defaultPickupLat']).toBeNull();
    expect(callArgs['defaultPickupLng']).toBeNull();
  });

  it('H05: el evento onChange de MapPicker actualiza el formulario y las coordenadas exactas persisten en el submit', async () => {
    vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
      ok: true,
      data: { redirectTo: '/merchant/dashboard' },
    });
    render(<MerchantOnboardingForm zones={mockZones} />);
    await screen.findByTestId('map-picker');

    fillBaseForm();

    expect(mockOnChange).toBeDefined();
    await act(async () => {
      mockOnChange?.({ lat: -27.4365, lng: -65.6165 });
    });

    expect(await screen.findByText(/ubicación marcada:/i)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /empezar/i }));

    await waitFor(() => {
      expect(merchantOnboardingAction).toHaveBeenCalledTimes(1);
    });

    const firstCall = vi.mocked(merchantOnboardingAction).mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) return;
    const callArgs = firstCall[0] as Record<string, unknown>;
    expect(callArgs['defaultPickupLat']).toBe(-27.4365);
    expect(callArgs['defaultPickupLng']).toBe(-65.6165);
  });

  it('H09: el formulario de alta presenta exactamente un input de dirección y una sola acción de GPS en toda la vista', async () => {
    render(<MerchantOnboardingForm zones={mockZones} />);
    await screen.findByTestId('map-picker');

    const addressInputs = screen.getAllByLabelText(/dirección de retiro habitual/i);
    expect(addressInputs).toHaveLength(1);

    const gpsButtons = screen.getAllByRole('button', { name: /usar mi ubicación actual/i });
    expect(gpsButtons).toHaveLength(1);
  });
});
