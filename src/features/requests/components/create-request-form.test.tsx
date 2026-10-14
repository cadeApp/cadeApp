// @vitest-environment jsdom
import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
});
