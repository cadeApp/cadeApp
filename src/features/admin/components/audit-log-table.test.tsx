// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AuditLogTable } from './audit-log-table';
import type { AuditLogResult } from '../types';

const ACTOR_ID = 'a0000000-0000-4000-8000-000000000001';

const result: AuditLogResult = {
  items: [
    {
      id: 90,
      createdAt: '2026-09-27T12:00:00.000Z',
      actorName: 'Lautaro',
      action: 'admin_set_subscription',
      targetType: 'merchant',
      targetRef: 'f0000000',
      changes: [{ field: 'subscription_status', before: 'pilot', after: 'active' }],
      hasReason: false,
    },
    {
      id: 89,
      createdAt: '2026-09-27T10:00:00.000Z',
      actorName: null,
      action: 'admin_update_setting',
      targetType: 'platform_setting',
      targetRef: 'min_offer_ars',
      changes: [{ field: 'value', before: 1000, after: 1500 }],
      hasReason: false,
    },
  ],
  pageSize: 2,
  nextCursor: 89,
  hasNextPage: true,
};

describe('T-123: AuditLogTable (A06)', () => {
  it('muestra fecha, operador, acción, entidad y detalle', () => {
    render(<AuditLogTable result={result} filters={{}} actors={[{ id: ACTOR_ID, name: 'Lautaro' }]} />);

    const table = screen.getByRole('table');
    for (const header of [/fecha/i, /operador/i, /acci[oó]n/i, /entidad/i, /detalle/i]) {
      expect(within(table).getByRole('columnheader', { name: header })).toBeTruthy();
    }
    expect(within(table).getByText('Lautaro')).toBeTruthy();
    expect(within(table).getByText(/sistema/i)).toBeTruthy();
    expect(table.textContent ?? '').not.toContain('admin_set_subscription');
  });

  it('es de solo lectura: no ofrece editar ni borrar', () => {
    render(<AuditLogTable result={result} filters={{}} actors={[]} />);
    expect(screen.queryByRole('button', { name: /editar|eliminar|borrar/i })).toBeNull();
  });

  it('pagina server-side con cursor y conserva todos los filtros en el link', () => {
    render(
      <AuditLogTable
        result={result}
        filters={{
          actorId: ACTOR_ID,
          action: 'admin_update_setting',
          targetType: 'platform_setting',
        }}
        actors={[{ id: ACTOR_ID, name: 'Lautaro' }]}
      />
    );

    const href =
      screen.getByRole('link', { name: /siguiente/i }).getAttribute('href') ?? '';

    const url = new URL(href, 'http://localhost');

    expect(url.pathname).toBe('/admin/audit');
    expect(url.searchParams.get('cursor')).toBe('89');
    expect(url.searchParams.get('actor')).toBe(ACTOR_ID);
    expect(url.searchParams.get('action')).toBe('admin_update_setting');
    expect(url.searchParams.get('entity')).toBe('platform_setting');
  });

  function fieldValue(form: HTMLElement, name: string): string | null {
    const field = form.querySelector(`[name="${name}"]`);
    if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement) {
      return field.value;
    }
    return null;
  }

  it('los filtros se envían por GET a la misma ruta (filtrado en el servidor)', () => {
    render(<AuditLogTable result={result} filters={{}} actors={[{ id: ACTOR_ID, name: 'Lautaro' }]} />);

    const form = screen.getByRole('search');
    expect(form.getAttribute('method')?.toLowerCase()).toBe('get');
    expect(form.getAttribute('action')).toBe('/admin/audit');
    for (const name of ['actor', 'action', 'entity']) {
      expect(form.querySelector(`[name="${name}"]`)).not.toBeNull();
    }
  });

  it('con filtros activos, los controles del formulario reflejan operador, evento y entidad', () => {
    render(
      <AuditLogTable
        result={result}
        filters={{
          actorId: ACTOR_ID,
          action: 'admin_update_setting',
          targetType: 'platform_setting',
        }}
        actors={[{ id: ACTOR_ID, name: 'Lautaro' }]}
      />
    );

    const form = screen.getByRole('search');
    expect(fieldValue(form, 'actor')).toBe(ACTOR_ID);
    expect(fieldValue(form, 'action')).toBe('admin_update_setting');
    expect(fieldValue(form, 'entity')).toBe('platform_setting');
  });

  it('muestra un estado vacío sin link de siguiente página', () => {
    render(
      <AuditLogTable
        result={{ items: [], pageSize: 20, nextCursor: null, hasNextPage: false }}
        filters={{}}
        actors={[]}
      />
    );
    expect(screen.queryByRole('link', { name: /siguiente/i })).toBeNull();
    expect(screen.getByText(/no hay registros/i)).toBeTruthy();
  });
});
