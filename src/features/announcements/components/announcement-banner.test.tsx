// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AnnouncementBanner as AnnouncementBannerData } from '@/domain';
import { AnnouncementBanner, AnnouncementBannerView } from './announcement-banner';

const mocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  setOptIn: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('../actions', () => ({
  dismissAnnouncementAction: mocks.dismiss,
  setPromotionsOptInAction: mocks.setOptIn,
}));
vi.mock('@/ui/notify', () => ({ notify: { success: mocks.success, error: mocks.error, info: vi.fn() } }));

const BANNER: AnnouncementBannerData = {
  id: '90000000-0000-4000-8000-000000000001',
  title: 'Hoy los viajes múltiples cuestan 1 crédito',
  body: 'Aprovechá la promo de hoy para tus envíos de varias entregas.',
  cta: 'merchant_plan',
};

describe('T-414: banner de novedades', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it('muestra la etiqueta, el título, el texto y el botón hacia su pantalla', () => {
    render(<AnnouncementBanner announcement={BANNER} />);
    const region = screen.getByRole('region', { name: 'Novedad de cadeApp' });
    expect(region.textContent).toContain('Novedad');
    expect(screen.getByRole('heading', { name: BANNER.title })).toBeTruthy();
    expect(screen.getByText(BANNER.body)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver mi plan' }).getAttribute('href')).toBe('/merchant/plan');
    expect(screen.getByRole('button', { name: 'Cerrar novedad' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No recibir más promociones' })).toBeTruthy();
  });

  it('sin acción no hay botón', () => {
    render(<AnnouncementBanner announcement={{ ...BANNER, cta: 'none' }} />);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('cerrar lo oculta al instante y lo guarda en la cuenta', async () => {
    mocks.dismiss.mockResolvedValue({ ok: true, data: { dismissed: true } });
    render(<AnnouncementBanner announcement={BANNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar novedad' }));
    expect(screen.queryByRole('region', { name: 'Novedad de cadeApp' })).toBeNull();
    await waitFor(() => expect(mocks.dismiss).toHaveBeenCalledWith(BANNER.id));
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('si no se pudo guardar el cierre, vuelve a mostrarlo y avisa', async () => {
    mocks.dismiss.mockResolvedValue({ ok: false, code: 'INTERNAL_ERROR' });
    render(<AnnouncementBanner announcement={BANNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar novedad' }));
    expect(await screen.findByRole('region', { name: 'Novedad de cadeApp' })).toBeTruthy();
    expect(mocks.error).toHaveBeenCalledWith('No pudimos guardar el cambio. Reintentá en unos instantes.');
  });

  it('darse de baja de promociones lo oculta y confirma que los avisos de pedidos siguen', async () => {
    mocks.setOptIn.mockResolvedValue({ ok: true, data: { enabled: false } });
    render(<AnnouncementBanner announcement={BANNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'No recibir más promociones' }));
    expect(screen.queryByRole('region', { name: 'Novedad de cadeApp' })).toBeNull();
    await waitFor(() => expect(mocks.setOptIn).toHaveBeenCalledWith(false));
    expect(mocks.success).toHaveBeenCalledWith(
      'Listo, no vas a recibir más promociones. Los avisos de tus pedidos siguen igual.'
    );
  });

  it('una baja que falla también vuelve a mostrarlo', async () => {
    mocks.setOptIn.mockRejectedValue(new Error('offline'));
    render(<AnnouncementBanner announcement={BANNER} />);
    fireEvent.click(screen.getByRole('button', { name: 'No recibir más promociones' }));
    expect(await screen.findByRole('region', { name: 'Novedad de cadeApp' })).toBeTruthy();
    expect(mocks.error).toHaveBeenCalled();
  });

  it('la vista previa del admin no tiene acciones activas', () => {
    render(<AnnouncementBannerView title="Título" body="Texto" cta="courier_feed" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect((screen.getByRole('button', { name: 'Cerrar novedad' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Ver solicitudes' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'No recibir más promociones' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
