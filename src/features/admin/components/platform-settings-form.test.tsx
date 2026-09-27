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

describe('T-123: PlatformSettingsForm (A04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('muestra los valores vigentes recibidos del servidor', () => {
    render(<PlatformSettingsForm settings={settings} />);
    expect(inputFor(/oferta m[ií]nima/i).value).toBe('1500');
    expect(inputFor(/vencimiento/i).value).toBe('45');
    expect(inputFor(/d[ií]as de gracia/i).value).toBe('3');
    expect(inputFor(/versi[oó]n de t[eé]rminos/i).value).toBe('1.1');
  });

  it('guarda el piso con admin_update_setting y refresca', async () => {
    vi.mocked(updatePlatformSettingAction).mockResolvedValue({
      ok: true,
      data: { key: 'min_offer_ars', value: 1800 },
    });
    render(<PlatformSettingsForm settings={settings} />);

    fireEvent.change(inputFor(/oferta m[ií]nima/i), { target: { value: '1800' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar oferta m[ií]nima/i }));

    await waitFor(() => {
      expect(updatePlatformSettingAction).toHaveBeenCalledWith({ key: 'min_offer_ars', value: 1800 });
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('no envía un piso inválido y explica el error en el campo', async () => {
    render(<PlatformSettingsForm settings={settings} />);

    fireEvent.change(inputFor(/oferta m[ií]nima/i), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar oferta m[ií]nima/i }));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(updatePlatformSettingAction).not.toHaveBeenCalled();
  });

  it('muestra el error del servidor si la sesión perdió aal2', async () => {
    vi.mocked(updatePlatformSettingAction).mockResolvedValue({ ok: false, code: 'AAL2_REQUIRED' });
    render(<PlatformSettingsForm settings={settings} />);

    fireEvent.change(inputFor(/d[ií]as de gracia/i), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar d[ií]as de gracia/i }));

    await waitFor(() => {
      expect(updatePlatformSettingAction).toHaveBeenCalledWith({
        key: 'subscription_grace_days',
        value: 5,
      });
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });
});
