// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlatformSettingsForm } from './platform-settings-form';
import { updatePlatformSettingAction } from '../actions';
import type { PlatformSettingsSnapshot } from '../types';
import { courierOnlineWindowFormSchema } from '../schemas';
import { adminUpdateSettingInputSchema } from '@/domain';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

vi.mock('../actions', () => ({
  updatePlatformSettingAction: vi.fn(),
}));

const settings: PlatformSettingsSnapshot = {
  minOfferArs: 1500,
  requestTtlMinutes: 45,
  pilotActive: true,
  pilotTermsVersion: '1.1',
  subscriptionGraceDays: 3,
  maxDropsPerRequest: 5,
  courierOnlineWindowMinutes: 10,
  publicationDropsPerCredit: 2,
  carryoverBasePct: 5,
  carryoverStepPct: 5,
  carryoverCapPct: 35,
  launchDiscountPct: 0,
  looseCreditReferencePriceArs: null,
};

function inputFor(label: RegExp): HTMLInputElement {
  const element = screen.getByLabelText(label);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`${String(label)} no es un input`);
  }
  return element;
}

function pilotSwitch(): HTMLElement {
  return screen.getByRole('switch', { name: /piloto activo/i });
}

describe('T-123: PlatformSettingsForm (A04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra los parámetros vigentes recibidos del servidor', () => {
    render(<PlatformSettingsForm settings={settings} />);
    expect(inputFor(/oferta m[ií]nima/i).value).toBe('1500');
    expect(inputFor(/vencimiento/i).value).toBe('45');
    expect(inputFor(/d[ií]as de gracia/i).value).toBe('3');
    expect(inputFor(/versi[oó]n de t[eé]rminos/i).value).toBe('1.1');
    expect(inputFor(/m[aá]ximo de entregas/i).value).toBe('5');
    expect(pilotSwitch().getAttribute('aria-checked')).toBe('true');
  });

  it('refleja el piloto apagado cuando el servidor lo informa', () => {
    render(<PlatformSettingsForm settings={{ ...settings, pilotActive: false }} />);
    expect(pilotSwitch().getAttribute('aria-checked')).toBe('false');
  });

  // PR112-H02: cada parámetro se guarda por interacción real y con el tipo correcto.
  it.each([
    {
      name: 'oferta mínima',
      save: /guardar oferta m[ií]nima/i,
      change: () => fireEvent.change(inputFor(/oferta m[ií]nima/i), { target: { value: '1800' } }),
      payload: { key: 'min_offer_ars', value: 1800 },
    },
    {
      name: 'vencimiento de solicitudes',
      save: /guardar vencimiento/i,
      change: () => fireEvent.change(inputFor(/vencimiento/i), { target: { value: '60' } }),
      payload: { key: 'request_ttl_minutes', value: 60 },
    },
    {
      name: 'piloto activo',
      save: /guardar piloto activo/i,
      change: () => fireEvent.click(pilotSwitch()),
      payload: { key: 'pilot_active', value: false },
    },
    {
      name: 'versión de términos',
      save: /guardar versi[oó]n de t[eé]rminos/i,
      change: () =>
        fireEvent.change(inputFor(/versi[oó]n de t[eé]rminos/i), { target: { value: '1.2' } }),
      payload: { key: 'pilot_terms_version', value: '1.2' },
    },
    {
      name: 'días de gracia',
      save: /guardar d[ií]as de gracia/i,
      change: () => fireEvent.change(inputFor(/d[ií]as de gracia/i), { target: { value: '5' } }),
      payload: { key: 'subscription_grace_days', value: 5 },
    },
    {
      name: 'máximo de entregas',
      save: /guardar m[aá]ximo de entregas/i,
      change: () => fireEvent.change(inputFor(/m[aá]ximo de entregas/i), { target: { value: '8' } }),
      payload: { key: 'max_drops_per_request', value: 8 },
    },
    {
      name: 'ventana de repartidores conectados',
      save: /guardar ventana de repartidores conectados/i,
      change: () => fireEvent.change(inputFor(/ventana de repartidores conectados/i), { target: { value: '15' } }),
      payload: { key: 'courier_online_window_minutes', value: 15 },
    },
  ] as const)('guarda $name con admin_update_setting y refresca', async ({ save, change, payload }) => {
    vi.mocked(updatePlatformSettingAction).mockResolvedValue({ ok: true, data: payload });
    render(<PlatformSettingsForm settings={settings} />);

    change();
    fireEvent.click(screen.getByRole('button', { name: save }));

    await waitFor(() => {
      expect(updatePlatformSettingAction).toHaveBeenCalledWith(payload);
    });
    expect(updatePlatformSettingAction).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('el switch de piloto cambia su estado visible antes de guardar', () => {
    render(<PlatformSettingsForm settings={settings} />);
    fireEvent.click(pilotSwitch());
    expect(pilotSwitch().getAttribute('aria-checked')).toBe('false');
  });

  it('no envía un piso inválido y explica el error en el campo', async () => {
    render(<PlatformSettingsForm settings={settings} />);

    fireEvent.change(inputFor(/oferta m[ií]nima/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar oferta m[ií]nima/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(updatePlatformSettingAction).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'días de gracia',
      save: /guardar d[ií]as de gracia/i,
      change: () => fireEvent.change(inputFor(/d[ií]as de gracia/i), { target: { value: '5' } }),
      payload: { key: 'subscription_grace_days', value: 5 },
    },
    {
      name: 'piloto activo',
      save: /guardar piloto activo/i,
      change: () => fireEvent.click(pilotSwitch()),
      payload: { key: 'pilot_active', value: false },
    },
  ] as const)(
    'si la sesión perdió aal2 al guardar $name muestra el error y no refresca',
    async ({ save, change, payload }) => {
      vi.mocked(updatePlatformSettingAction).mockResolvedValue({ ok: false, code: 'AAL2_REQUIRED' });
      render(<PlatformSettingsForm settings={settings} />);

      change();
      fireEvent.click(screen.getByRole('button', { name: save }));

      await waitFor(() => {
        expect(updatePlatformSettingAction).toHaveBeenCalledWith(payload);
      });
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(refresh).not.toHaveBeenCalled();
    }
  );
});

describe('T-369 / CC-029: parámetros de créditos, arrastre y descuento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra los valores actuales y el precio de referencia vacío cuando no está cargado', () => {
    render(<PlatformSettingsForm settings={settings} />);
    expect(screen.getByRole('heading', { name: 'Créditos de publicación' })).toBeTruthy();
    expect(inputFor(/entregas incluidas por crédito/i).value).toBe('2');
    expect(inputFor(/arrastre inicial/i).value).toBe('5');
    expect(inputFor(/aumento del arrastre/i).value).toBe('5');
    expect(inputFor(/tope del arrastre/i).value).toBe('35');
    expect(inputFor(/descuento de lanzamiento/i).value).toBe('0');
    const price = inputFor(/precio de referencia del crédito suelto/i);
    expect(price.value).toBe('');
    expect(price.placeholder).toBe('Sin cargar');
  });

  it('guarda cada clave con su valor numérico y valida el rango antes de enviar', async () => {
    vi.mocked(updatePlatformSettingAction).mockResolvedValue({
      ok: true,
      data: { key: 'launch_discount_pct', value: 0 },
    });
    render(<PlatformSettingsForm settings={settings} />);

    fireEvent.change(inputFor(/descuento de lanzamiento/i), { target: { value: '101' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar descuento de lanzamiento/i }));
    expect(await screen.findByText('Ingresá un porcentaje entero entre 0 y 100.')).toBeTruthy();
    expect(updatePlatformSettingAction).not.toHaveBeenCalled();

    fireEvent.change(inputFor(/descuento de lanzamiento/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar descuento de lanzamiento/i }));
    await waitFor(() =>
      expect(updatePlatformSettingAction).toHaveBeenCalledWith({ key: 'launch_discount_pct', value: 0 })
    );

    fireEvent.change(inputFor(/precio de referencia del crédito suelto/i), { target: { value: '900' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar precio de referencia del crédito suelto/i }));
    await waitFor(() =>
      expect(updatePlatformSettingAction).toHaveBeenCalledWith({
        key: 'loose_credit_reference_price_ars',
        value: 900,
      })
    );
  });

  it('el rechazo de la RPC (base por encima del tope) queda visible en la fila', async () => {
    vi.mocked(updatePlatformSettingAction).mockResolvedValue({ ok: false, code: 'INVALID_SETTING_VALUE' });
    render(<PlatformSettingsForm settings={settings} />);
    fireEvent.change(inputFor(/arrastre inicial/i), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar arrastre inicial/i }));
    expect(await screen.findByText('El valor ingresado no es válido para este parámetro.')).toBeTruthy();
    expect(updatePlatformSettingAction).toHaveBeenCalledWith({ key: 'carryover_base_pct', value: 40 });
  });
});

describe('PR551-H04: ventana de repartidores conectados', () => {
  const ERROR = 'Ingresá una cantidad entera de minutos entre 2 y 60.';
  const field = () => inputFor(/ventana de repartidores conectados/i);
  const save = () => fireEvent.click(screen.getByRole('button', { name: /guardar ventana de repartidores conectados/i }));

  beforeEach(() => vi.clearAllMocks());

  it('el formulario arranca con el valor guardado', () => {
    render(<PlatformSettingsForm settings={{ ...settings, courierOnlineWindowMinutes: 15 }} />);
    expect(field().value).toBe('15');
  });

  it.each([2, 60])('acepta el extremo %i y lo guarda', async (value) => {
    vi.mocked(updatePlatformSettingAction).mockResolvedValue({
      ok: true,
      data: { key: 'courier_online_window_minutes', value },
    });
    render(<PlatformSettingsForm settings={settings} />);
    fireEvent.change(field(), { target: { value: String(value) } });
    save();
    await waitFor(() =>
      expect(updatePlatformSettingAction).toHaveBeenCalledWith({ key: 'courier_online_window_minutes', value })
    );
  });

  it.each(['1', '61', '2.5', '', 'diez'])('rechaza %j con un error accesible y sin llamar a la acción', async (value) => {
    render(<PlatformSettingsForm settings={settings} />);
    fireEvent.change(field(), { target: { value } });
    save();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe(ERROR);
    expect(field().getAttribute('aria-invalid')).toBe('true');
    expect(updatePlatformSettingAction).not.toHaveBeenCalled();
  });

  it('el formulario acepta exactamente lo que acepta el contrato de la RPC', () => {
    for (const value of [-1, 0, 1, 2, 3, 27, 59, 60, 61, 62, 2.5, NaN, Infinity]) {
      const form = courierOnlineWindowFormSchema.safeParse({ value: String(value) }).success;
      const contract = adminUpdateSettingInputSchema.safeParse({ key: 'courier_online_window_minutes', value }).success;
      expect(form, String(value)).toBe(contract);
    }
    expect(courierOnlineWindowFormSchema.safeParse({ value: '27' }).success).toBe(true);
    for (const value of ['', 'diez', ' ']) {
      expect(courierOnlineWindowFormSchema.safeParse({ value }).success, JSON.stringify(value)).toBe(false);
    }
  });
});
