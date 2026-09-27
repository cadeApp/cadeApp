// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PlatformSettingsForm } from './platform-settings-form';
import { updatePlatformSettingAction } from '../actions';
import type { PlatformSettingsSnapshot } from '../types';

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

  it('muestra los cinco parámetros vigentes recibidos del servidor', () => {
    render(<PlatformSettingsForm settings={settings} />);
    expect(inputFor(/oferta m[ií]nima/i).value).toBe('1500');
    expect(inputFor(/vencimiento/i).value).toBe('45');
    expect(inputFor(/d[ií]as de gracia/i).value).toBe('3');
    expect(inputFor(/versi[oó]n de t[eé]rminos/i).value).toBe('1.1');
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
