// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { AdminAnnouncementItem } from '@/domain';
import { AnnouncementsHistory } from './announcements-history';

const ITEM: AdminAnnouncementItem = {
  id: '90000000-0000-4000-8000-000000000001',
  audience: 'merchants',
  title: 'Promo de hoy',
  body: 'Los viajes múltiples cuestan 1 crédito',
  cta: 'merchant_plan',
  visibleUntil: '2026-10-29T15:00:00.000000Z',
  createdAt: '2026-10-22T15:00:00.000000Z',
  createdByName: 'Admin',
  pushTargets: 6,
  pushSent: 5,
  pushFailed: 1,
};

describe('T-414: historial de novedades', () => {
  afterEach(cleanup);

  it('lista cada novedad con público, vigencia, push y quién la envió', () => {
    render(
      <AnnouncementsHistory
        result={{ ok: true, data: { items: [ITEM, { ...ITEM, id: '90000000-0000-4000-8000-000000000002', audience: 'all', pushTargets: null, pushSent: null, pushFailed: null, createdByName: '' }], nextCursor: null } }}
        isFirstPage
      />
    );
    const rows = within(screen.getByRole('table', { name: 'Novedades enviadas' })).getAllByRole('row').slice(1);
    expect(rows[0]?.textContent).toContain('Promo de hoy');
    expect(rows[0]?.textContent).toContain('Comercios');
    expect(rows[0]?.textContent).toContain('5 de 6 · 1 fallidos');
    expect(rows[0]?.textContent).toContain('Admin');
    expect(rows[1]?.textContent).toContain('Comercios y repartidores');
    expect(rows[1]?.textContent).toContain('Sin registrar');
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('pagina por keyset y ofrece volver al principio', () => {
    const cursor = { createdAt: '2026-10-22T15:00:00.000000Z', id: ITEM.id };
    render(<AnnouncementsHistory result={{ ok: true, data: { items: [ITEM], nextCursor: cursor } }} isFirstPage={false} />);
    const nav = screen.getByRole('navigation', { name: 'Paginación de novedades' });
    expect(within(nav).getByRole('link', { name: 'Siguientes' }).getAttribute('href')).toBe(
      `/admin/announcements?cursor=${encodeURIComponent(`${cursor.createdAt}_${cursor.id}`)}`
    );
    expect(within(nav).getByRole('link', { name: 'Volver al principio' }).getAttribute('href')).toBe('/admin/announcements');
  });

  it('vacío y error', () => {
    render(<AnnouncementsHistory result={{ ok: true, data: { items: [], nextCursor: null } }} isFirstPage />);
    expect(screen.getByText('Todavía no se envió ninguna novedad.')).toBeTruthy();
    cleanup();
    render(<AnnouncementsHistory result={{ ok: false, code: 'INTERNAL_ERROR' }} isFirstPage />);
    expect(screen.getByRole('alert').textContent).toContain('No pudimos cargar las novedades enviadas.');
  });
});
