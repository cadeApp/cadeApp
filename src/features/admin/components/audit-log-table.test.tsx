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
      targetName: null,
      reason: null,
    },
    {
      id: 89,
      createdAt: '2026-09-27T10:00:00.000Z',
      actorName: null,
      action: 'admin_update_setting',
      targetType: 'platform_setting',
      targetRef: 'min_offer_ars',
      changes: [{ field: 'value', before: 1000, after: 1500 }],
      targetName: null,
      reason: null,
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

describe('T-400: AuditLogTable (auditoría legible)', () => {
  const reason =
    '  Primera línea <script>alert(1)</script>\nSegunda línea del motivo, que es larga y no se corta en el DOM.\n';
  const readable: AuditLogResult = {
    items: [
      {
        id: 12,
        createdAt: '2026-10-21T12:00:00.000Z',
        actorName: 'Lautaro',
        action: 'admin_reinstate_courier',
        targetType: 'courier',
        targetRef: 'b0000000',
        targetName: 'Ana Gómez',
        changes: [{ field: 'status', before: 'suspended', after: 'approved' }],
        reason,
      },
      {
        id: 11,
        createdAt: '2026-10-21T11:00:00.000Z',
        actorName: 'Lautaro',
        action: 'admin_verify_document',
        targetType: 'courier_document',
        targetRef: 'd0000000',
        targetName: 'Bruno Díaz · Licencia de Conducir',
        changes: [
          { field: 'status', before: 'submitted', after: 'verified' },
          { field: 'kind', before: 'license' },
          { field: 'docLevel', after: 2 },
        ],
        reason: null,
      },
      {
        id: 10,
        createdAt: '2026-10-21T10:00:00.000Z',
        actorName: null,
        action: 'push_subscription_reassigned',
        targetType: 'push_subscription',
        targetRef: '70000000',
        targetName: null,
        changes: [],
        reason: null,
      },
    ],
    pageSize: 20,
    nextCursor: null,
    hasNextPage: false,
  };

  function rowWith(text: string): HTMLElement {
    const row = screen.getAllByRole('row').find((candidate) => candidate.textContent?.includes(text));
    if (!row) throw new Error(`falta la fila con «${text}»`);
    return row;
  }

  it('muestra el nombre del afectado y su id corto', () => {
    render(<AuditLogTable result={readable} filters={{}} actors={[]} />);
    const row = rowWith('Ana Gómez');
    expect(within(row).getByText('Ana Gómez')).toBeTruthy();
    expect(within(row).getByText('b0000000')).toBeTruthy();
  });

  it('muestra el motivo escapado, completo y con saltos de línea', () => {
    const { container } = render(<AuditLogTable result={readable} filters={{}} actors={[]} />);
    const reasonNode = within(rowWith('Ana Gómez')).getByText((_, node) => node?.textContent === reason && node.tagName === 'P');
    expect(reasonNode.className).toMatch(/whitespace-pre-wrap/);
    expect(reasonNode.className).not.toMatch(/truncate|line-clamp/);
    expect(container.querySelector('script')).toBeNull();
    expect(screen.queryByText(/con motivo registrado/i)).toBeNull();
  });

  it('etiqueta acciones y entidades nuevas en vez de «Otro evento» / «Otra entidad»', () => {
    render(<AuditLogTable result={readable} filters={{}} actors={[]} />);
    const table = screen.getByRole('table');
    expect(within(table).queryByText(/otro evento/i)).toBeNull();
    expect(within(table).queryByText(/otra entidad/i)).toBeNull();
    expect(within(rowWith('70000000')).getByText('70000000')).toBeTruthy();
  });

  it('un valor de un solo lado se lee como dato o contexto, sin «→ —»', () => {
    render(<AuditLogTable result={readable} filters={{}} actors={[]} />);
    const items = within(rowWith('Bruno Díaz')).getAllByRole('listitem').map((item) => item.textContent ?? '');
    expect(items).toContain('Documento: Licencia de Conducir');
    expect(items).toContain('Nivel: 2');
    expect(items.some((text) => text.includes('→ —'))).toBe(false);
    expect(items.find((text) => text.startsWith('Estado'))).toMatch(/Enviado[\s\S]*→[\s\S]*Verificado/);
  });
});
