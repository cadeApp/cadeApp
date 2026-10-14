// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  function zoneTrigger() {
    return screen.getByLabelText(/barrio de retiro/i);
  }

  /** Elige un barrio como lo hace una persona: abre el combobox y toca la opción del listbox. */
  function chooseZone(zone: { readonly name: string }) {
    fireEvent.click(zoneTrigger());
    fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: zone.name }));
  }

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

    chooseZone(zoneA);

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

    chooseZone(zoneA);
    chooseZone(zoneB);

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

    chooseZone(zoneA);

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

    chooseZone(zoneC);

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

    expect(screen.queryByText(/ubicación marcada:/i)).toBeNull();

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

  it('el input de teléfono de contacto declara inputmode="tel"', () => {
    render(<MerchantOnboardingForm zones={mockZones} />);
    const phoneInput = screen.getByLabelText(/teléfono de contacto/i);
    expect(phoneInput.getAttribute('inputmode')).toBe('tel');
  });

  describe('T-323 DoD: Degradación graceful de mapa y geolocalización', () => {
    it('si la geolocalización falla, muestra aviso de fallback pero NO deshabilita el botón Empezar y permite submit con dirección escrita', async () => {
      vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
        ok: true,
        data: { redirectTo: '/merchant/dashboard' },
      });

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn((_success, error) => {
            error({ code: 1, message: 'User denied geolocation' });
          }),
        },
        writable: true,
        configurable: true,
      });

      render(<MerchantOnboardingForm zones={mockZones} />);
      await screen.findByTestId('map-picker');

      fillBaseForm();

      // Usuario intenta usar GPS
      const gpsBtn = screen.getByRole('button', { name: /usar mi ubicación actual/i });
      fireEvent.click(gpsBtn);

      // Muestra el aviso que dice que puede continuar con la dirección escrita
      expect(
        await screen.findByText(/no pudimos obtener tu ubicación actual\. podés continuar con la dirección escrita\./i)
      ).toBeDefined();

      // El botón de submit NO debe estar deshabilitado
      const submitBtn = screen.getByRole('button', { name: /empezar/i });
      expect(submitBtn).not.toHaveProperty('disabled', true);

      // El usuario hace submit con la dirección escrita
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(merchantOnboardingAction).toHaveBeenCalledTimes(1);
      });

      const firstCall = vi.mocked(merchantOnboardingAction).mock.calls[0];
      expect(firstCall).toBeDefined();
      if (!firstCall) return;
      const callArgs = firstCall[0] as Record<string, unknown>;
      expect(callArgs['defaultPickupAddress']).toBe('Av. Sarmiento 123');
      expect(callArgs['defaultPickupLat']).toBeNull();
      expect(callArgs['defaultPickupLng']).toBeNull();
    });

    it('una falla de mapa o geolocalización no muestra falsamente el errorGeneric de guardar datos', async () => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn((_success, error) => {
            error({ code: 2, message: 'Position unavailable' });
          }),
        },
        writable: true,
        configurable: true,
      });

      render(<MerchantOnboardingForm zones={mockZones} />);
      await screen.findByTestId('map-picker');

      const gpsBtn = screen.getByRole('button', { name: /usar mi ubicación actual/i });
      fireEvent.click(gpsBtn);

      await screen.findByText(/no pudimos obtener tu ubicación actual/i);

      // NO debe mostrarse el mensaje de error al crear/guardar comercio
      expect(screen.queryByText(/ocurrió un error al guardar los datos/i)).toBeNull();
    });

    it('Caso A: GPS fuera -> handler descarta lat/lng -> completar dirección manual -> botón habilitado -> submit llama merchantOnboardingAction con lat/lng nulas', async () => {
      vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
        ok: true,
        data: { redirectTo: '/merchant/dashboard' },
      });

      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: vi.fn((success) => {
            success({
              coords: { latitude: -26.83, longitude: -65.20 }, // Fuera de Aguilares
            });
          }),
        },
        writable: true,
        configurable: true,
      });

      render(<MerchantOnboardingForm zones={mockZones} />);
      await screen.findByTestId('map-picker');

      fillBaseForm();

      const gpsBtn = screen.getByRole('button', { name: /usar mi ubicación actual/i });
      fireEvent.click(gpsBtn);

      expect(
        await screen.findByText(/ubicación fuera de aguilares/i)
      ).toBeDefined();

      const submitBtn = screen.getByRole('button', { name: /empezar/i });
      // El botón debe estar HABILITADO porque lat/lng fueron descartadas a null
      expect(submitBtn).not.toHaveProperty('disabled', true);

      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(merchantOnboardingAction).toHaveBeenCalledTimes(1);
      });

      const firstCall = vi.mocked(merchantOnboardingAction).mock.calls[0];
      expect(firstCall).toBeDefined();
      if (!firstCall) return;
      const callArgs = firstCall[0] as Record<string, unknown>;
      expect(callArgs['defaultPickupAddress']).toBe('Av. Sarmiento 123');
      expect(callArgs['defaultPickupLat']).toBeNull();
      expect(callArgs['defaultPickupLng']).toBeNull();
    });

    it('Caso B: pin o centroide realmente fuera y todavía presente -> submit bloqueado', async () => {
      const zoneOutOfBounds = {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Zona Fuera',
        centroidLat: -26.83,
        centroidLng: -65.20,
      };

      render(<MerchantOnboardingForm zones={[...mockZones, zoneOutOfBounds]} />);
      await screen.findByTestId('map-picker');

      fillBaseForm();

      // B1. Con pin fuera de Aguilares
      expect(mockOnChange).toBeDefined();
      await act(async () => {
        mockOnChange?.({ lat: -26.83, lng: -65.20 });
      });

      const submitBtn = screen.getByRole('button', { name: /empezar/i });
      expect(submitBtn).toHaveProperty('disabled', true);

      // B2. Con zona cuyo centroide está fuera de Aguilares
      chooseZone(zoneOutOfBounds);
      expect(submitBtn).toHaveProperty('disabled', true);
    });

    it('Caso C: tras un error fuera de rango, corregir a coordenadas o centroide válido -> se puede enviar', async () => {
      vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
        ok: true,
        data: { redirectTo: '/merchant/dashboard' },
      });

      render(<MerchantOnboardingForm zones={mockZones} />);
      await screen.findByTestId('map-picker');

      fillBaseForm();

      // Inicialmente fija un pin inválido fuera de Aguilares
      expect(mockOnChange).toBeDefined();
      await act(async () => {
        mockOnChange?.({ lat: -26.83, lng: -65.20 });
      });

      const submitBtn = screen.getByRole('button', { name: /empezar/i });
      expect(submitBtn).toHaveProperty('disabled', true);

      // Corrige a coordenadas válidas dentro de Aguilares
      await act(async () => {
        mockOnChange?.({ lat: -27.435, lng: -65.615 });
      });

      // Ahora el botón debe estar habilitado
      expect(submitBtn).not.toHaveProperty('disabled', true);

      fireEvent.click(submitBtn);

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
  });

  describe('T-326: selector de barrio con el Select del proyecto', () => {
    const barrios = [
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', name: 'Aguilares - Centro', centroidLat: null, centroidLng: null },
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', name: 'Chacarita', centroidLat: null, centroidLng: null },
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', name: 'Evita', centroidLat: null, centroidLng: null },
      { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', name: 'San Martín', centroidLat: null, centroidLng: null },
    ];

    async function submitAndReadPayload() {
      vi.mocked(merchantOnboardingAction).mockResolvedValueOnce({
        ok: true,
        data: { redirectTo: '/merchant/dashboard' },
      });
      fireEvent.click(screen.getByRole('button', { name: /empezar/i }));
      await waitFor(() => {
        expect(merchantOnboardingAction).toHaveBeenCalledTimes(1);
      });
      return vi.mocked(merchantOnboardingAction).mock.calls[0]?.[0] as Record<string, unknown>;
    }

    it('no renderiza un <select> nativo operable: el barrio se elige con un combobox', () => {
      const { container } = render(<MerchantOnboardingForm zones={barrios} />);

      const trigger = zoneTrigger();
      expect(trigger.tagName).toBe('BUTTON');
      expect(trigger.getAttribute('role')).toBe('combobox');
      expect(trigger.getAttribute('aria-haspopup')).toBe('listbox');
      // Radix deja un <select aria-hidden tabindex=-1> interno; lo que no puede haber es uno operable.
      expect(container.querySelector('select:not([aria-hidden="true"])')).toBeNull();
    });

    it('muestra el placeholder y, al abrir, un listbox con todos los barrios en el orden recibido', () => {
      render(<MerchantOnboardingForm zones={barrios} />);

      const trigger = zoneTrigger();
      expect(trigger.textContent).toContain('Seleccioná un barrio');
      expect(trigger.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByRole('listbox')).toBeNull();

      fireEvent.click(trigger);

      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      const listbox = screen.getByRole('listbox');
      expect(trigger.getAttribute('aria-controls')).toBe(listbox.id);
      expect(within(listbox).getAllByRole('option').map((o) => o.textContent)).toEqual([
        'Aguilares - Centro',
        'Chacarita',
        'Evita',
        'San Martín',
      ]);
    });

    it('al elegir un barrio lo muestra en el control, cierra el listbox y marca la opción elegida', () => {
      render(<MerchantOnboardingForm zones={barrios} />);

      chooseZone({ name: 'Evita' });

      const trigger = zoneTrigger();
      expect(trigger.textContent).toContain('Evita');
      expect(trigger.textContent).not.toContain('Seleccioná un barrio');
      expect(screen.queryByRole('listbox')).toBeNull();

      fireEvent.click(trigger);
      const selected = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .filter((o) => o.getAttribute('aria-selected') === 'true');
      expect(selected.map((o) => o.textContent)).toEqual(['Evita']);
    });

    it('persiste en el submit el UUID del barrio elegido, también después de cambiar de barrio', async () => {
      render(<MerchantOnboardingForm zones={barrios} />);
      await screen.findByTestId('map-picker');
      fillBaseForm();

      chooseZone({ name: 'Chacarita' });
      chooseZone({ name: 'San Martín' });

      const payload = await submitAndReadPayload();
      expect(payload['defaultPickupZoneId']).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4');
    });

    it('un barrio sin centroide no fabrica coordenadas: ni en el mapa ni en el submit', async () => {
      render(<MerchantOnboardingForm zones={barrios} />);
      await screen.findByTestId('map-picker');
      fillBaseForm();

      chooseZone({ name: 'Aguilares - Centro' });

      expect(screen.getByTestId('map-default-zone-center').textContent).toBe('null');
      expect(screen.getByTestId('map-value').textContent).toBe('null');

      const payload = await submitAndReadPayload();
      expect(payload['defaultPickupZoneId']).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1');
      expect(payload['defaultPickupLat']).toBeNull();
      expect(payload['defaultPickupLng']).toBeNull();
    });

    it('con un barrio sin centroide, el pin del mapa sigue siendo la ubicación precisa', async () => {
      render(<MerchantOnboardingForm zones={barrios} />);
      await screen.findByTestId('map-picker');
      fillBaseForm();

      chooseZone({ name: 'Evita' });
      fireEvent.click(screen.getByTestId('simulate-map-pin'));

      const payload = await submitAndReadPayload();
      expect(payload['defaultPickupZoneId']).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3');
      expect(payload['defaultPickupLat']).toBe(-27.435);
      expect(payload['defaultPickupLng']).toBe(-65.615);
    });

    it('sin elegir barrio el alta sigue siendo posible y no se envía un barrio inventado', async () => {
      render(<MerchantOnboardingForm zones={barrios} />);
      await screen.findByTestId('map-picker');
      fillBaseForm();

      const payload = await submitAndReadPayload();
      expect(payload['defaultPickupZoneId']).toBeUndefined();
    });
  });
});
