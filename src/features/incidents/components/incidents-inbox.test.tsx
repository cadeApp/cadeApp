// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { IncidentsInbox } from './incidents-inbox';
import type { IncidentsQueueResult } from '../types';

const INCIDENT_ID = 'e0000000-0000-4000-8000-000000000002';

const result: IncidentsQueueResult = {
  items: [
    {
      id: INCIDENT_ID,
      requestId: 'd0000000-0000-4000-8000-000000000001',
      kind: 'damaged_goods',
      excerpt: 'La caja llegó abierta y faltaba una docena de facturas.',
      status: 'open',
      createdAt: '2026-09-27T12:00:00.000Z',
      reporterRole: 'merchant',
      reporterName: 'Panadería La Espiga',
    },
  ],
  pageSize: 20,
  nextCursor: '2026-09-27T12:00:00.000Z',
  hasNextPage: true,
};

describe('T-124: IncidentsInbox (A05)', () => {
  it('muestra cada reporte con tipo, quién reportó, relato, fecha y estado en lenguaje humano', () => {
    render(<IncidentsInbox result={result} tab="open" />);

    const item = screen.getByRole('listitem');
    expect(within(item).getByText(/mercader[ií]a da[ñn]ada/i)).toBeTruthy();
    expect(within(item).getByText(/panader[ií]a la espiga/i)).toBeTruthy();
    expect(within(item).getByText(/comercio/i)).toBeTruthy();
    expect(within(item).getByText(/faltaba una docena de facturas/i)).toBeTruthy();
    expect(item.querySelector('time')?.getAttribute('dateTime')).toBe('2026-09-27T12:00:00.000Z');
    expect(within(item).getByText(/abierto/i)).toBeTruthy();

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('damaged_goods');
    expect(text).not.toMatch(/\bopen\b/);
  });

  it('lleva al detalle de cada incidente', () => {
    render(<IncidentsInbox result={result} tab="open" />);
    const link = screen.getByRole('link', { name: /ver detalle/i });
    expect(link.getAttribute('href')).toBe(`/admin/incidents/${INCIDENT_ID}`);
  });

  it('ofrece pestañas Abiertos y Cerrados como links y marca la actual', () => {
    render(<IncidentsInbox result={result} tab="closed" />);
    const open = screen.getByRole('link', { name: /abiertos/i });
    const closed = screen.getByRole('link', { name: /cerrados/i });
    expect(open.getAttribute('href')).toBe('/admin/incidents');
    expect(closed.getAttribute('href')).toBe('/admin/incidents?tab=closed');
    expect(closed.getAttribute('aria-current')).toBe('page');
    expect(open.getAttribute('aria-current')).toBeNull();
  });

  it('pagina con cursor conservando la pestaña', () => {
    render(<IncidentsInbox result={result} tab="closed" />);
    const href = screen.getByRole('link', { name: /siguiente/i }).getAttribute('href') ?? '';
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/admin/incidents');
    expect(url.searchParams.get('tab')).toBe('closed');
    expect(url.searchParams.get('cursor')).toBe('2026-09-27T12:00:00.000Z');
  });

  it('muestra un estado vacío sin paginación', () => {
    render(
      <IncidentsInbox
        result={{ items: [], pageSize: 20, nextCursor: null, hasNextPage: false }}
        tab="open"
      />
    );
    expect(screen.getByText(/no hay incidentes/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /siguiente/i })).toBeNull();
  });
});
