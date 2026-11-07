// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { IncidentsInbox } from './incidents-inbox';
import { parseIncidentsSearchParams } from '../schemas';
import type { IncidentsQueueResult } from '../types';

const INCIDENT_ID = 'e0000000-0000-4000-8000-000000000002';
const NEXT_CURSOR = { createdAt: '2026-09-27T12:00:00.123456Z', id: INCIDENT_ID };

const result: IncidentsQueueResult = {
  items: [
    {
      id: INCIDENT_ID,
      requestId: 'd0000000-0000-4000-8000-000000000001',
      kind: 'damaged_goods',
      description: 'La caja llegó abierta y faltaba una docena de facturas.',
      status: 'open',
      resolution: null,
      createdAt: '2026-09-27T12:00:00.123456Z',
      reporterId: 'f0000000-0000-4000-8000-00000000000a',
      reporterRole: 'merchant',
      reporterName: 'Panadería La Espiga',
    },
  ],
  pageSize: 20,
  nextCursor: NEXT_CURSOR,
};

const counts = { open: 3, resolved: 12, dismissed: 0 };

describe('T-124: IncidentsInbox (A05)', () => {
  it('muestra cada reporte con tipo, quién reportó, relato, fecha y estado en lenguaje humano', () => {
    render(<IncidentsInbox result={result} tab="open" counts={counts} />);

    expect(screen.getByRole('heading', { level: 1, name: /incidentes/i })).toBeTruthy();
    const item = screen.getByRole('listitem');
    expect(within(item).getByText(/mercader[ií]a da[ñn]ada/i)).toBeTruthy();
    expect(within(item).getByText(/panader[ií]a la espiga/i)).toBeTruthy();
    expect(within(item).getByText(/comercio/i)).toBeTruthy();
    expect(within(item).getByText(/faltaba una docena de facturas/i)).toBeTruthy();
    const time = item.querySelector('time');
    expect(time?.getAttribute('dateTime')).toBe('2026-09-27T12:00:00.123456Z');
    expect(time?.textContent).toBe('27/09/2026 09:00');
    expect(within(item).getByText(/^abierto$/i)).toBeTruthy();

    const text = document.body.textContent ?? '';
    expect(text).not.toContain('damaged_goods');
    expect(text).not.toMatch(/\bopen\b|\bmerchant\b/);
  });

  it('lleva al detalle de cada incidente con un nombre accesible propio', () => {
    render(<IncidentsInbox result={result} tab="open" counts={counts} />);
    const link = screen.getByRole('link', { name: /ver detalle.*mercader[ií]a da[ñn]ada.*panader[ií]a la espiga/i });
    expect(link.getAttribute('href')).toBe(`/admin/incidents/${INCIDENT_ID}`);
  });

  it('T-406: ofrece «Abiertos (N)», «Resueltos (N)» y «Desestimados (N)» como links y marca la actual', () => {
    render(<IncidentsInbox result={result} tab="resolved" counts={counts} />);
    const tabs = screen.getByRole('navigation', { name: /estado de los incidentes/i });
    const links = within(tabs).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Abiertos (3)', '/admin/incidents'],
      ['Resueltos (12)', '/admin/incidents?tab=resolved'],
      ['Desestimados (0)', '/admin/incidents?tab=dismissed'],
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'page', null]);
    expect(within(tabs).queryByText(/cerrados/i)).toBeNull();
  });

  it('pagina con el cursor compuesto conservando la pestaña', () => {
    render(<IncidentsInbox result={result} tab="resolved" counts={counts} />);
    const href = screen.getByRole('link', { name: /siguiente/i }).getAttribute('href') ?? '';
    const url = new URL(href, 'http://localhost');
    expect(url.pathname).toBe('/admin/incidents');
    expect(
      parseIncidentsSearchParams({
        tab: url.searchParams.get('tab'),
        cursor: url.searchParams.get('cursor'),
      })
    ).toEqual({ tab: 'resolved', cursor: NEXT_CURSOR });
  });

  it('en una página intermedia ofrece volver al inicio de la misma pestaña', () => {
    render(
      <IncidentsInbox result={{ ...result, nextCursor: null }} tab="resolved" counts={counts} currentCursor={NEXT_CURSOR} />
    );
    expect(screen.getByRole('link', { name: /volver al inicio/i }).getAttribute('href')).toBe(
      '/admin/incidents?tab=resolved'
    );
    expect(screen.queryByRole('link', { name: /siguiente/i })).toBeNull();
  });

  it('muestra un estado vacío por pestaña sin paginación', () => {
    render(<IncidentsInbox result={{ items: [], pageSize: 20, nextCursor: null }} tab="dismissed" counts={counts} />);
    expect(screen.getByText(/no hay incidentes desestimados/i)).toBeTruthy();
    expect(screen.queryByRole('listitem')).toBeNull();
    expect(screen.queryByRole('link', { name: /siguiente/i })).toBeNull();
  });
});
