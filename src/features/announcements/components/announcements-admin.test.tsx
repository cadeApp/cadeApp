// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AnnouncementsAdmin } from './announcements-admin';

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  refresh: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('../actions', () => ({
  countAnnouncementAudienceAction: mocks.count,
  createAnnouncementAction: mocks.create,
  dismissAnnouncementAction: vi.fn(),
  setPromotionsOptInAction: vi.fn(),
}));
vi.mock('@/ui/notify', () => ({ notify: { success: mocks.success, error: mocks.error, info: vi.fn() } }));

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('T-414: panel de novedades del admin', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('el botón disponible depende del público', () => {
    render(<AnnouncementsAdmin />);
    const ctaGroup = () => screen.getByRole('group', { name: 'Botón' });
    expect(within(ctaGroup()).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'none',
      'merchant_plan',
      'merchant_new_request',
    ]);

    fireEvent.click(screen.getByLabelText('Repartidores'));
    expect(within(ctaGroup()).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual([
      'none',
      'courier_feed',
    ]);

    fireEvent.click(screen.getByLabelText('Comercios y repartidores'));
    expect(within(ctaGroup()).getAllByRole('radio').map((radio) => radio.getAttribute('value'))).toEqual(['none']);
    expect(screen.getByText('Con comercios y repartidores juntos, la novedad va sin botón.')).toBeTruthy();
  });

  it('cambiar a un público sin ese botón vuelve a «Sin botón»', () => {
    render(<AnnouncementsAdmin />);
    fireEvent.click(screen.getByLabelText('Ver mi plan'));
    fireEvent.click(screen.getByLabelText('Repartidores'));
    expect((screen.getByLabelText('Sin botón') as HTMLInputElement).checked).toBe(true);
  });

  it('la vista previa y los contadores siguen lo que se escribe', () => {
    render(<AnnouncementsAdmin />);
    fill('Título', 'Promo de hoy');
    fill('Texto', 'Los viajes múltiples cuestan 1 crédito');
    const preview = screen.getByRole('region', { name: 'Novedad de cadeApp' });
    expect(within(preview).getByRole('heading', { name: 'Promo de hoy' })).toBeTruthy();
    expect(screen.getByText('12/60')).toBeTruthy();
    expect(screen.getByText('38/140')).toBeTruthy();
  });

  it('valida antes de contar destinatarios', async () => {
    render(<AnnouncementsAdmin />);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y enviar' }));
    expect(await screen.findByText('Escribí un título de hasta 60 caracteres.')).toBeTruthy();
    expect(mocks.count).not.toHaveBeenCalled();
  });

  it('confirma con los destinatarios estimados, envía y avisa el resultado del push', async () => {
    mocks.count.mockResolvedValue({ ok: true, data: { recipients: 12, pushRecipients: 5 } });
    mocks.create.mockResolvedValue({
      ok: true,
      data: {
        announcementId: '90000000-0000-4000-8000-000000000001',
        visibleUntil: '2026-10-29T12:00:00.000000Z',
        push: { targets: 6, sent: 5, failed: 1 },
      },
    });
    render(<AnnouncementsAdmin />);
    fill('Título', '  Promo de hoy ');
    fill('Texto', 'Los viajes múltiples cuestan 1 crédito');
    fireEvent.click(screen.getByLabelText('Ver mi plan'));
    fill('Días visible', '3');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y enviar' }));

    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(mocks.count).toHaveBeenCalledWith('merchants'));
    expect(
      await within(dialog).findByText(
        'La van a ver 12 cuentas en su inicio. Por push llega a 5 (quienes aceptaron novedades y tienen avisos activos).'
      )
    ).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar novedad' }));
    await waitFor(() =>
      expect(mocks.create).toHaveBeenCalledWith({
        audience: 'merchants',
        title: 'Promo de hoy',
        body: 'Los viajes múltiples cuestan 1 crédito',
        cta: 'merchant_plan',
        visibleDays: 3,
      })
    );
    expect(mocks.success).toHaveBeenCalledWith('Novedad publicada. Push: 5 enviados, 1 fallidos.');
    expect(mocks.refresh).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sin push registrado, avisa que igual se ve en el inicio', async () => {
    mocks.count.mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    mocks.create.mockResolvedValue({
      ok: true,
      data: { announcementId: '90000000-0000-4000-8000-000000000001', visibleUntil: '2026-10-29T12:00:00.000000Z', push: null },
    });
    render(<AnnouncementsAdmin />);
    fill('Título', 'Promo');
    fill('Texto', 'Texto');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y enviar' }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('No pudimos calcular los destinatarios. Igual podés enviarla.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Enviar novedad' }));
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith('Novedad publicada. El push no se pudo enviar; igual se ve en el inicio.')
    );
  });

  it('el tope diario se muestra como error y no cierra el diálogo', async () => {
    mocks.count.mockResolvedValue({ ok: true, data: { recipients: 1, pushRecipients: 0 } });
    mocks.create.mockResolvedValue({ ok: false, code: 'RATE_LIMITED' });
    render(<AnnouncementsAdmin />);
    fill('Título', 'Promo');
    fill('Texto', 'Texto');
    fireEvent.click(screen.getByRole('button', { name: 'Revisar y enviar' }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Enviar novedad' }) as HTMLButtonElement;
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    expect(await within(dialog).findByRole('alert')).toBeTruthy();
    expect(within(dialog).getByRole('alert').textContent).toBe(
      'Ya se enviaron 5 novedades en las últimas 24 horas. Probá más tarde.'
    );
    expect(mocks.error).toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
