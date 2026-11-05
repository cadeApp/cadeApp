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
  prevCursor: null,
  hasPrevPage: false,
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
        result={{ items: [], pageSize: 20, nextCursor: null, hasNextPage: false, prevCursor: null, hasPrevPage: false }}
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
    prevCursor: null,
    hasPrevPage: false,
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

describe('PR607-D02: filtro por repartidor', () => {
  const COURIER = 'c0000000-0000-4000-8000-000000000607';

  function courierOf(href: string | null): string | null {
    return new URL(href ?? '', 'http://localhost').searchParams.get('courier');
  }

  it('«Siguiente» y «Anterior» conservan ?courier= y el formulario lo reenvía oculto', () => {
    const { container } = render(
      <AuditLogTable
        result={{ ...result, prevCursor: 90, hasPrevPage: true }}
        filters={{ courierId: COURIER, action: 'admin_suspend_courier', cursor: 95 }}
        actors={[]}
      />
    );
    const links = screen.getAllByRole('link').map((link) => link.getAttribute('href'));
    const paging = links.filter((href) => href !== '/admin/audit');
    expect(paging.length).toBeGreaterThanOrEqual(2);
    for (const href of paging) expect(courierOf(href)).toBe(COURIER);

    const form = screen.getByRole('search', { name: 'Filtros de auditoría' });
    expect(form.getAttribute('method')).toBe('get');
    expect(container.querySelector('input[type="hidden"][name="courier"]')?.getAttribute('value')).toBe(COURIER);
    expect(screen.getByText('Mostrando los eventos de un repartidor y de sus documentos.')).toBeTruthy();
  });

  it('«Limpiar filtros» saca también el filtro por repartidor', () => {
    render(<AuditLogTable result={result} filters={{ courierId: COURIER }} actors={[]} />);
    expect(screen.getByRole('link', { name: 'Limpiar filtros' }).getAttribute('href')).toBe('/admin/audit');
  });

  it('sin filtro por repartidor no hay campo oculto ni aviso', () => {
    const { container } = render(<AuditLogTable result={result} filters={{}} actors={[]} />);
    expect(container.querySelector('input[name="courier"]')).toBeNull();
    expect(screen.queryByText(/eventos de un repartidor/i)).toBeNull();
  });
});

describe('T-407: AuditLogTable (A06: fechas, entidad, etiquetas y paginación)', () => {
  const TARGET = 'c0000000-0000-4000-8000-000000000407';
  const filters = {
    action: 'admin_update_setting',
    targetType: 'courier',
    targetId: TARGET,
    from: '2026-10-21',
    to: '2026-10-22',
  } as const;
  const middle: AuditLogResult = { ...result, prevCursor: 90, hasPrevPage: true };

  function params(name: RegExp): URLSearchParams {
    const href = screen.getByRole('link', { name }).getAttribute('href') ?? '';
    return new URL(href, 'http://localhost').searchParams;
  }

  it('«Anterior» y «Siguiente» llevan el cursor en ambos sentidos sin perder ningún filtro', () => {
    render(<AuditLogTable result={middle} filters={{ ...filters, cursor: 91 }} actors={[]} />);

    const prev = params(/anterior/i);
    expect(prev.get('cursor')).toBe('90');
    expect(prev.get('dir')).toBe('prev');
    const next = params(/siguiente/i);
    expect(next.get('cursor')).toBe('89');
    expect(next.get('dir')).toBeNull();
    for (const search of [prev, next]) {
      expect(search.get('action')).toBe('admin_update_setting');
      expect(search.get('entity')).toBe('courier');
      expect(search.get('target')).toBe(TARGET);
      expect(search.get('from')).toBe('2026-10-21');
      expect(search.get('to')).toBe('2026-10-22');
    }
  });

  it('la primera página no muestra «Anterior»', () => {
    render(<AuditLogTable result={result} filters={{}} actors={[]} />);
    expect(screen.queryByRole('link', { name: /anterior/i })).toBeNull();
    expect(screen.getByRole('link', { name: /siguiente/i })).toBeTruthy();
  });

  it('Desde y Hasta son campos de fecha del formulario GET con los valores activos', () => {
    const { container } = render(<AuditLogTable result={result} filters={filters} actors={[]} />);
    expect(screen.getByLabelText('Desde').getAttribute('type')).toBe('date');
    expect((screen.getByLabelText('Desde') as HTMLInputElement).value).toBe('2026-10-21');
    expect((screen.getByLabelText('Hasta') as HTMLInputElement).value).toBe('2026-10-22');
    expect(container.querySelector('input[type="hidden"][name="target"]')?.getAttribute('value')).toBe(TARGET);
    expect(screen.getByText('Mostrando los eventos de una sola entidad.')).toBeTruthy();
  });

  it('un rango inválido se avisa con texto y deja ofrecer «Limpiar filtros»', () => {
    render(<AuditLogTable result={result} filters={{ invalidDateRange: true }} actors={[]} />);
    expect(screen.getByRole('alert').textContent).toMatch(/366 días/);
    expect(screen.getByRole('link', { name: 'Limpiar filtros' })).toBeTruthy();
  });

  it('T-407-D01: no promete inmutabilidad mientras audit_log siga editable (SEC-02, T-408)', () => {
    render(<AuditLogTable result={result} filters={{}} actors={[]} />);
    expect(screen.queryByText(/no se puede editar ni borrar/i)).toBeNull();
  });

  it('la acción es una etiqueta con su texto visible y una variante por tipo', () => {
    const [base] = result.items;
    if (!base) throw new Error('fixture vacío');
    const items: AuditLogResult['items'] = [
      { ...base, id: 3, action: 'admin_decide_courier', changes: [{ field: 'status', before: 'pending', after: 'rejected' }] },
      { ...base, id: 2, action: 'view_courier_document', changes: [] },
      { ...base, id: 1, action: 'admin_reinstate_courier', changes: [] },
    ];
    render(<AuditLogTable result={{ ...result, items }} filters={{}} actors={[]} />);

    const badge = (label: string) => {
      const cell = screen.getAllByRole('cell').find((node) => node.textContent === label);
      return cell?.querySelector('span');
    };
    expect(badge('Decidió una postulación')?.className).toMatch(/badge-danger/);
    expect(badge('Vio un documento')?.className).toMatch(/bg-secondary/);
    expect(badge('Reactivó un repartidor')?.className).toMatch(/badge-success/);
  });
});
