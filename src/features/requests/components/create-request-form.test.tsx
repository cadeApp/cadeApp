// @vitest-environment jsdom
import * as React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDomainErrorMessage } from '@/lib/error-messages';
import { notify } from '@/ui/notify';
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

describe('T-340: CreateRequestForm multi-drop', () => {
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
  const pickupZone = mockZones[0];
  if (!pickupZone) throw new Error('El fixture requiere al menos una zona');

  it('renderiza todos los campos principales, 1 entrega por defecto y precarga datos del comercio', () => {
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
    expect(screen.getByText('Precargado editable')).toBeDefined();
    // 1 entrega por defecto
    expect(screen.getByText('Entrega 1')).toBeDefined();
    expect(screen.getByText(/1 \/ 5 entregas/i)).toBeDefined();
  });

  it('el botón «Quitar entrega» está deshabilitado cuando hay exactamente 1 entrega', () => {
    render(<CreateRequestForm zones={mockZones} />);

    const removeBtn = screen.getByRole('button', { name: /quitar entrega 1/i });
    expect(removeBtn).toBeDefined();
    expect((removeBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('botón «Agregar otra entrega» añade una nueva tarjeta con valores independientes', () => {
    render(<CreateRequestForm zones={mockZones} />);

    // Inicia con 1 entrega
    expect(screen.getAllByTestId(/^drop-card-/)).toHaveLength(1);

    // Escribir datos en drop 1
    const drop1Address = screen.getByLabelText(/dirección de entrega/i);
    fireEvent.change(drop1Address, { target: { value: 'Av. Sarmiento 100' } });

    // Agregar segunda entrega
    const addBtn = screen.getByRole('button', { name: /agregar otra entrega/i });
    fireEvent.click(addBtn);

    // Ahora hay 2 entregas
    const cards = screen.getAllByTestId(/^drop-card-/);
    expect(cards).toHaveLength(2);
    expect(screen.getByText('Entrega 1')).toBeDefined();
    expect(screen.getByText('Entrega 2')).toBeDefined();
    expect(screen.getByText(/2 \/ 5 entregas/i)).toBeDefined();

    // La segunda tarjeta tiene la dirección vacía y no afecta a la primera
    const addressInputs = screen.getAllByLabelText(/dirección de entrega/i);
    expect(addressInputs).toHaveLength(2);
    expect((addressInputs[0] as HTMLInputElement).value).toBe('Av. Sarmiento 100');
    expect((addressInputs[1] as HTMLInputElement).value).toBe('');
  });

  it('«Quitar entrega» borra solo la entrega indicada y conserva los datos de las demás', () => {
    render(<CreateRequestForm zones={mockZones} />);

    const addBtn = screen.getByRole('button', { name: /agregar otra entrega/i });
    fireEvent.click(addBtn); // Drop 2
    fireEvent.click(addBtn); // Drop 3

    expect(screen.getAllByTestId(/^drop-card-/)).toHaveLength(3);

    const addressInputs = screen.getAllByLabelText(/dirección de entrega/i);
    const in0 = addressInputs[0];
    const in1 = addressInputs[1];
    const in2 = addressInputs[2];
    if (!in0 || !in1 || !in2) throw new Error('Inputs missing');
    fireEvent.change(in0, { target: { value: 'Calle Primera 111' } });
    fireEvent.change(in1, { target: { value: 'Calle Segunda 222' } });
    fireEvent.change(in2, { target: { value: 'Calle Tercera 333' } });

    // Quitar la segunda entrega (index 1)
    const removeBtnDrop2 = screen.getByRole('button', { name: /quitar entrega 2/i });
    fireEvent.click(removeBtnDrop2);

    // Ahora quedan 2 entregas
    expect(screen.getAllByTestId(/^drop-card-/)).toHaveLength(2);
    const remainingInputs = screen.getAllByLabelText(/dirección de entrega/i);
    expect(remainingInputs).toHaveLength(2);
    expect((remainingInputs[0] as HTMLInputElement | undefined)?.value).toBe('Calle Primera 111');
    expect((remainingInputs[1] as HTMLInputElement | undefined)?.value).toBe('Calle Tercera 333');
  });

  it('respeta el tope dinámico recibido por props deshabilitando el botón agregar al alcanzarlo', () => {
    render(<CreateRequestForm zones={mockZones} maxDrops={2} />);

    const addBtn = screen.getByRole('button', { name: /agregar otra entrega/i });
    expect((addBtn as HTMLButtonElement).disabled).toBe(false);

    // Agregar segunda entrega (alcanza tope de 2)
    fireEvent.click(addBtn);

    expect(screen.getAllByTestId(/^drop-card-/)).toHaveLength(2);
    expect((addBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/alcanzaste el límite de 2 entregas/i)).toBeDefined();
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
      data: { requestId: 'req-123', redirectTo: '/merchant/dashboard' },
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
    const callArgs = firstCall[0] as { drops: Array<Record<string, unknown>> };
    expect(callArgs.drops).toHaveLength(1);
    expect(callArgs.drops[0]?.['dropoffLat']).toBe(-27.4385);
    expect(callArgs.drops[0]?.['dropoffLng']).toBe(-65.6185);
  });

  it('#209: si la publicación es rechazada muestra el error de dominio y no anuncia éxito', async () => {
    vi.mocked(actions.createDeliveryRequestAction).mockResolvedValueOnce({
      ok: false,
      code: 'SUBSCRIPTION_INACTIVE',
    });

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

    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Sarmiento 1200' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'Lucía Gómez' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3815551234' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /publicar solicitud/i }));

    const expected = getDomainErrorMessage('SUBSCRIPTION_INACTIVE');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(expected);
    expect(notify.error).toHaveBeenCalledWith(expected);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('T-371: si la publicación es rechazada por PUBLICATION_CREDITS_EXHAUSTED muestra la alerta correspondiente', async () => {
    vi.mocked(actions.createDeliveryRequestAction).mockResolvedValueOnce({
      ok: false,
      code: 'PUBLICATION_CREDITS_EXHAUSTED',
    });

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

    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Sarmiento 1200' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'Lucía Gómez' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3815551234' },
    });
    fireEvent.click(screen.getByRole('checkbox'));

    fireEvent.click(screen.getByRole('button', { name: /publicar solicitud/i }));

    const expected = getDomainErrorMessage('PUBLICATION_CREDITS_EXHAUSTED');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(expected);
    // No alcanza con mostrar el mismo texto: el submit válido tiene que invocar la Action.
    await waitFor(() => {
      expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(1);
      expect(actions.createDeliveryRequestAction).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: expect.any(String),
          drops: expect.arrayContaining([
            expect.objectContaining({
              dropoffAddress: 'Av. Sarmiento 1200',
              recipientConsentDeclared: true,
            }),
          ]),
        })
      );
    });
    expect(notify.error).toHaveBeenCalledWith(expected);
    expect(notify.success).not.toHaveBeenCalled();
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
  });

  it('los inputs de teléfono y cambio numérico declaran inputmode adecuado ("tel" y "numeric")', () => {
    render(<CreateRequestForm zones={mockZones} />);

    // 1. Teléfono del destinatario: inputmode="tel"
    const phoneInput = screen.getByLabelText(/teléfono de contacto/i);
    expect(phoneInput.getAttribute('inputmode')).toBe('tel');

    // 2. Activar cambio en efectivo para desplegar input libre de cambio
    const yesChangeBtn = screen.getByRole('button', { name: /^sí$/i });
    fireEvent.click(yesChangeBtn);

    const customChangeInput = screen.getByPlaceholderText('Otro monto en efectivo');
    expect(customChangeInput.getAttribute('inputmode')).toBe('numeric');
  });

  it('muestra el precio total multiplicado por la cantidad de entregas (fixedPriceArs × drops.length)', () => {
    render(<CreateRequestForm zones={mockZones} />);

    const priceInput = screen.getByLabelText(/precio del envío acordado/i);
    fireEvent.change(priceInput, { target: { value: '1500' } });

    // 1 entrega: 1500
    expect(screen.getByText(/Total cotizado al repartidor:/i)).toBeDefined();
    expect(screen.getByText(/1 entrega\)/i)).toBeDefined();

    // Añadir segunda entrega
    const addBtn = screen.getByRole('button', { name: /agregar otra entrega/i });
    fireEvent.click(addBtn);

    // 2 entregas: total 3000
    expect(screen.getByText(/2 entregas\)/i)).toBeDefined();
    expect(screen.getByText(/\$ 3\.000/i)).toBeDefined();
  });

  it('no muestra el switch de asignación automática cuando no hay precio fijo cargado (DoD T-339)', () => {
    render(<CreateRequestForm zones={mockZones} />);

    expect(screen.queryByRole('switch', { name: /asignar al primer repartidor que tome/i })).toBeNull();
    expect(screen.getByLabelText(/precio del envío acordado/i)).toBeDefined();
  });

  it('muestra el switch de asignación automática cuando se ingresa un precio y permite cambiar su estado (DoD T-339)', () => {
    render(<CreateRequestForm zones={mockZones} />);

    const priceInput = screen.getByLabelText(/precio del envío acordado/i);
    expect(screen.queryByRole('switch', { name: /asignar al primer repartidor que tome/i })).toBeNull();

    // Ingresar precio fijo
    fireEvent.change(priceInput, { target: { value: '1500' } });

    // El switch aparece
    const switchBtn = screen.getByRole('switch', { name: /asignar al primer repartidor que tome/i });
    expect(switchBtn).toBeDefined();
    expect(switchBtn.getAttribute('aria-checked')).toBe('false');

    // Click activa el switch
    fireEvent.click(switchBtn);
    expect(switchBtn.getAttribute('aria-checked')).toBe('true');

    // Borrar el precio oculta el switch
    fireEvent.change(priceInput, { target: { value: '' } });
    expect(screen.queryByRole('switch', { name: /asignar al primer repartidor que tome/i })).toBeNull();
  });

  it('geolocalización diferida en tarjeta 2 actualiza la tarjeta correcta si se elimina tarjeta 1 previamente (R1 riesgo GPS)', async () => {
    let geoSuccessCallback: ((pos: { coords: { latitude: number; longitude: number } }) => void) | undefined;
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        geoSuccessCallback = success;
      }),
    };
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: mockGeolocation,
    });

    render(<CreateRequestForm zones={mockZones} />);

    // Agregar segunda entrega
    const addBtn = screen.getByRole('button', { name: /agregar otra entrega/i });
    fireEvent.click(addBtn);

    const cards = screen.getAllByTestId(/^drop-card-/);
    expect(cards).toHaveLength(2);

    // Clic en "Usar mi ubicación" en la segunda entrega (index 1)
    const useLocationButtons = screen.getAllByRole('button', { name: /usar mi ubicación/i });
    // el botón 0 es retiro, el botón 1 es drop 1, el botón 2 es drop 2
    expect(useLocationButtons.length).toBeGreaterThanOrEqual(3);
    const drop2GpsBtn = useLocationButtons[2];
    expect(drop2GpsBtn).toBeDefined();
    if (!drop2GpsBtn) throw new Error('Missing drop2 GPS button');
    fireEvent.click(drop2GpsBtn);

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);

    // Mientras el GPS está pendiente, eliminar la primera entrega (Drop 1)
    const removeButtons = screen.getAllByRole('button', { name: /quitar entrega/i });
    expect(removeButtons).toHaveLength(2);
    const removeBtn0 = removeButtons[0];
    expect(removeBtn0).toBeDefined();
    if (!removeBtn0) throw new Error('Missing remove button');
    fireEvent.click(removeBtn0);

    // Ahora solo queda 1 tarjeta de entrega (la que era drop 2, ahora es drop 1)
    expect(screen.getAllByTestId(/^drop-card-/)).toHaveLength(1);

    // Ahora se resuelve la geolocalización pendiente
    act(() => {
      geoSuccessCallback?.({
        coords: {
          latitude: -27.4341,
          longitude: -65.6144,
        },
      });
    });

    // El pin de la entrega sobreviviente debe haberse fijado correctamente
    await waitFor(() => {
      expect(screen.getByText('Pin fijado')).toBeDefined();
    });

    vi.unstubAllGlobals();
  });

  it('reutiliza el mismo requestId en un reintento tras fallo (CC-024 / Decisión B)', async () => {
    const capturedRequestIds: string[] = [];
    vi.mocked(actions.createDeliveryRequestAction).mockImplementation(async (input: unknown) => {
      const data = input as { requestId?: string };
      if (data?.requestId) {
        capturedRequestIds.push(data.requestId);
      }
      // Primer intento falla
      if (capturedRequestIds.length === 1) {
        return { ok: false, code: 'INTERNAL_ERROR' };
      }
      // Reintento tiene éxito
      return { ok: true, data: { requestId: data.requestId ?? '', redirectTo: '/merchant/dashboard' } };
    });

    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: pickupZone.id,
          defaultPickupLat: -27.43,
          defaultPickupLng: -65.61,
          notes: null,
        }}
      />
    );

    // Llenar campos requeridos de la entrega 1
    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Sarmiento 100' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'Juan Destinatario' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3865123456' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /autorización del destinatario/i }));

    const submitBtn = screen.getByRole('button', { name: /publicar solicitud/i });

    // Intento 1
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(getDomainErrorMessage('INTERNAL_ERROR'))).toBeDefined();
    });
    expect(capturedRequestIds).toHaveLength(1);

    // Reintento (mismo formulario, mismo submit)
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(capturedRequestIds).toHaveLength(2);
    });

    // Invariante CC-024: el requestId DEBE ser idéntico entre el intento original y el reintento
    expect(capturedRequestIds[0]).toBe(capturedRequestIds[1]);
  });

  it('dos formularios montados independientemente no comparten identificador de solicitud', async () => {
    const ids: string[] = [];
    vi.mocked(actions.createDeliveryRequestAction).mockImplementation(async (input: unknown) => {
      const data = input as { requestId?: string };
      if (data?.requestId) ids.push(data.requestId);
      return { ok: false, code: 'INTERNAL_ERROR' };
    });

    const { unmount: unmount1 } = render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: pickupZone.id,
          defaultPickupLat: null,
          defaultPickupLng: null,
          notes: null,
        }}
      />
    );
    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Sarmiento 100' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'Juan Destinatario' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3865123456' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /autorización del destinatario/i }));
    fireEvent.click(screen.getByRole('button', { name: /publicar solicitud/i }));

    await waitFor(() => {
      expect(ids).toHaveLength(1);
    });
    unmount1();

    const { unmount: unmount2 } = render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: pickupZone.id,
          defaultPickupLat: null,
          defaultPickupLng: null,
          notes: null,
        }}
      />
    );
    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Mitre 200' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'María Destinataria' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3865654321' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /autorización del destinatario/i }));
    fireEvent.click(screen.getByRole('button', { name: /publicar solicitud/i }));

    await waitFor(() => {
      expect(ids).toHaveLength(2);
    });
    unmount2();

    expect(ids[0]).not.toBe(ids[1]);
  });

  it('éxito en la publicación genera un nuevo requestId para una próxima intención (CC-024)', async () => {
    const ids: string[] = [];
    vi.mocked(actions.createDeliveryRequestAction).mockImplementation(async (input: unknown) => {
      const data = input as { requestId?: string };
      if (data?.requestId) ids.push(data.requestId);
      return { ok: true, data: { requestId: data?.requestId ?? '', redirectTo: '/merchant/dashboard' } };
    });

    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: pickupZone.id,
          defaultPickupLat: null,
          defaultPickupLng: null,
          notes: null,
        }}
      />
    );

    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Sarmiento 100' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'Juan Destinatario' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3865123456' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /autorización del destinatario/i }));

    const submitBtn = screen.getByRole('button', { name: /publicar solicitud/i });

    // Envío 1 (exitoso)
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ids).toHaveLength(1);
    });

    // Envío 2 posterior (nueva intención)
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(ids).toHaveLength(2);
    });

    // Debe haberse generado un UUID nuevo tras el éxito
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('CC-024: edición tras respuesta HTTP incierta exige decisión explícita y permite reintentar original', async () => {
    vi.mocked(actions.createDeliveryRequestAction)
      .mockRejectedValueOnce(new Error('network lost'))
      .mockImplementationOnce(async (input: unknown) => {
        const data = input as { requestId?: string; drops: Array<{ dropoffAddress: string }> };
        return { ok: true, data: { requestId: data?.requestId ?? '', redirectTo: '/merchant/dashboard' } };
      });

    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: pickupZone.id,
          defaultPickupLat: null,
          defaultPickupLng: null,
          notes: null,
        }}
      />
    );

    // Llenar formulario válido
    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Sarmiento 100' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'Juan Destinatario' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3865123456' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /autorización del destinatario/i }));

    const submitBtn = screen.getByRole('button', { name: /publicar solicitud/i });

    // Intento 1: falla con error de red
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(1);
    });

    const firstCallArgs = vi.mocked(actions.createDeliveryRequestAction).mock.calls[0]?.[0] as {
      requestId: string;
      drops: Array<{ dropoffAddress: string }>;
    };
    expect(firstCallArgs).toBeDefined();
    const originalRequestId = firstCallArgs.requestId;
    expect(firstCallArgs.drops[0]?.dropoffAddress).toBe('Av. Sarmiento 100');

    // Editar la dirección de entrega de la entrega 1
    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Belgrano 500' },
    });

    // Intento 2 con datos editados: NO debe llamar a la acción, debe mostrar alerta
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });

    // La acción NO debe haberse llamado una segunda vez
    expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(1);

    // Debe mostrar los botones de decisión explícita
    const retryOriginalBtn = screen.getByRole('button', { name: /reintentar solicitud original/i });
    expect(retryOriginalBtn).toBeDefined();
    expect(screen.getByRole('button', { name: /comenzar otra solicitud/i })).toBeDefined();

    // Pulsar «Reintentar solicitud original»
    fireEvent.click(retryOriginalBtn);

    await waitFor(() => {
      expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(2);
    });

    // La segunda llamada debe usar el MISMO requestId y la dirección ORIGINAL ('Av. Sarmiento 100')
    const secondCallArgs = vi.mocked(actions.createDeliveryRequestAction).mock.calls[1]?.[0] as {
      requestId: string;
      drops: Array<{ dropoffAddress: string }>;
    };
    expect(secondCallArgs.requestId).toBe(originalRequestId);
    expect(secondCallArgs.drops[0]?.dropoffAddress).toBe('Av. Sarmiento 100');
  });

  it('CC-024: «Comenzar otra solicitud» tras edición requiere confirmación y usa nuevo UUID', async () => {
    vi.mocked(actions.createDeliveryRequestAction)
      .mockRejectedValueOnce(new Error('network lost'))
      .mockImplementationOnce(async (input: unknown) => {
        const data = input as { requestId?: string; drops: Array<{ dropoffAddress: string }> };
        return { ok: true, data: { requestId: data?.requestId ?? '', redirectTo: '/merchant/dashboard' } };
      });

    render(
      <CreateRequestForm
        zones={mockZones}
        defaultPickup={{
          defaultPickupAddress: 'San Martín 350',
          defaultPickupZoneId: pickupZone.id,
          defaultPickupLat: null,
          defaultPickupLng: null,
          notes: null,
        }}
      />
    );

    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Sarmiento 100' },
    });
    fireEvent.change(screen.getByLabelText(/nombre de quien recibe/i), {
      target: { value: 'Juan Destinatario' },
    });
    fireEvent.change(screen.getByLabelText(/teléfono de contacto/i), {
      target: { value: '3865123456' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /autorización del destinatario/i }));

    const submitBtn = screen.getByRole('button', { name: /publicar solicitud/i });

    // Intento 1: falla
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(1);
    });

    const firstCallArgs = vi.mocked(actions.createDeliveryRequestAction).mock.calls[0]?.[0] as {
      requestId: string;
    };
    const oldUuid = firstCallArgs.requestId;

    // Editar dirección
    fireEvent.change(screen.getByLabelText(/dirección de entrega/i), {
      target: { value: 'Av. Belgrano 500' },
    });

    // Intentar enviar con datos modificados -> bloqueado por alerta
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
    expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(1);

    // Pulsar «Comenzar otra solicitud»
    const startNewBtn = screen.getByRole('button', { name: /comenzar otra solicitud/i });
    fireEvent.click(startNewBtn);

    // No debe llamar a la acción sin confirmación previa
    expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(1);

    // Debe mostrar advertencia y botón de confirmación
    const confirmBtn = screen.getByRole('button', { name: /confirmar nueva solicitud/i });
    expect(confirmBtn).toBeDefined();

    // Confirmar la nueva solicitud
    fireEvent.click(confirmBtn);

    // Aún no envía hasta que el usuario pulse enviar
    expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(1);

    // Ahora enviar con el formulario editado
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(actions.createDeliveryRequestAction).toHaveBeenCalledTimes(2);
    });

    const secondCallArgs = vi.mocked(actions.createDeliveryRequestAction).mock.calls[1]?.[0] as {
      requestId: string;
      drops: Array<{ dropoffAddress: string }>;
    };
    // Debe usar un UUID DIFERENTE y la dirección EDITADA
    expect(secondCallArgs.requestId).not.toBe(oldUuid);
    expect(secondCallArgs.drops[0]?.dropoffAddress).toBe('Av. Belgrano 500');
  });
});
