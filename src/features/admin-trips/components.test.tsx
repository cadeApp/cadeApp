// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { AdminTripsList } from './components/admin-trips-list';
import { AdminTripDetailView } from './components/admin-trip-detail';
import { AdminTripsListSkeleton, AdminTripDetailSkeleton } from './components/admin-trips-skeleton';
import type { AdminTripDetail, AdminTripListItem } from './types';

const partial: AdminTripListItem = {
  id: '00000000-0000-4000-8000-000000370002',
  code: 'REQ-00000000',
  status: 'delivered',
  createdAt: '2026-10-22T04:41:00.000000Z',
  publishedAt: '2026-10-22T04:00:00.000000Z',
  deliveredAt: '2026-10-22T05:00:00.000000Z',
  cancelledAt: null,
  merchantId: '00000000-0000-4000-8000-0000000370b1',
  merchantName: 'Pellegrini Store',
  courierId: '00000000-0000-4000-8000-0000000370c1',
  courierName: 'Mateo Sanchez',
  dropsCount: 2,
  deliveredDrops: 1,
  failedDrops: 1,
  courierReleases: 0,
  noShowReports: 0,
  cancelled: false,
  incidents: 0,
  openIncidents: 0,
};

const released: AdminTripListItem = {
  ...partial,
  id: '00000000-0000-4000-8000-000000370003',
  code: 'REQ-00000003',
  status: 'published',
  deliveredAt: null,
  courierId: null,
  courierName: null,
  dropsCount: 1,
  deliveredDrops: 0,
  failedDrops: 0,
  courierReleases: 1,
};

describe('T-410: AdminTripsList', () => {
  it('lista cada viaje con código, partes, estado, etiquetas de problema y resumen de entregas', () => {
    render(<AdminTripsList result={{ items: [partial, released], pageSize: 20, nextCursor: null }} filter="problems" />);

    const list = screen.getByRole('list', { name: 'Lista de viajes' });
    const rows = within(list).getAllByRole('listitem').filter((li) => li.parentElement === list);
    expect(rows).toHaveLength(2);

    const first = rows[0];
    if (!first) throw new Error('sin fila');
    expect(within(first).getByText('REQ-00000000')).toBeDefined();
    expect(within(first).getByText('Pellegrini Store → Mateo Sanchez')).toBeDefined();
    expect(within(first).getByText('Finalizada')).toBeDefined();
    expect(within(first).getByText('Entrega no realizada (1)')).toBeDefined();
    expect(within(first).getByText(/1 de 2 entregadas/)).toBeDefined();
    expect(
      within(first).getByRole('link', { name: 'Ver detalle del viaje REQ-00000000' }).getAttribute('href')
    ).toBe(`/admin/trips/${partial.id}`);

    const second = rows[1];
    if (!second) throw new Error('sin fila');
    expect(within(second).getByText('Pellegrini Store → Sin repartidor')).toBeDefined();
    expect(within(second).getByText('Repartidor soltó el viaje (1)')).toBeDefined();
  });

  it('marca la pestaña activa y enlaza las dos', () => {
    render(<AdminTripsList result={{ items: [], pageSize: 20, nextCursor: null }} filter="all" />);

    const nav = screen.getByRole('navigation', { name: 'Filtro de viajes' });
    const problems = within(nav).getByRole('link', { name: 'Con problemas' });
    const all = within(nav).getByRole('link', { name: 'Todos' });
    expect(problems.getAttribute('href')).toBe('/admin/trips');
    expect(problems.getAttribute('aria-current')).toBeNull();
    expect(all.getAttribute('href')).toBe('/admin/trips?filter=all');
    expect(all.getAttribute('aria-current')).toBe('page');
  });

  it('vacío: mensaje según la pestaña', () => {
    render(<AdminTripsList result={{ items: [], pageSize: 20, nextCursor: null }} filter="problems" />);
    expect(screen.getByText('No hay viajes con problemas')).toBeDefined();
  });

  it('paginación por cursor: «Siguiente» con el keyset y «Volver al inicio» desde otra página', () => {
    const cursor = { createdAt: '2026-10-22T04:41:00.123456Z', id: partial.id };
    render(
      <AdminTripsList
        result={{ items: [partial], pageSize: 1, nextCursor: cursor }}
        filter="all"
        currentCursor={{ createdAt: '2026-10-22T05:00:00.000000Z', id: released.id }}
      />
    );

    const nav = screen.getByRole('navigation', { name: 'Paginación de viajes' });
    expect(within(nav).getByRole('link', { name: 'Siguiente' }).getAttribute('href')).toBe(
      `/admin/trips?filter=all&cursor=${encodeURIComponent(`${cursor.createdAt}_${cursor.id}`)}`
    );
    expect(within(nav).getByRole('link', { name: 'Volver al inicio' }).getAttribute('href')).toBe(
      '/admin/trips?filter=all'
    );
  });
});

const detail: AdminTripDetail = {
  id: partial.id,
  code: partial.code,
  status: 'delivered',
  createdAt: '2026-10-22T04:41:00Z',
  merchant: { id: partial.merchantId, name: 'Pellegrini Store', phone: '3865111111' },
  courier: { id: '00000000-0000-4000-8000-0000000370c1', name: 'Mateo Sanchez', phone: null },
  timeline: {
    publishedAt: '2026-10-22T04:00:00Z',
    matchedAt: '2026-10-22T04:10:00Z',
    pickedUpAt: '2026-10-22T04:20:00Z',
    deliveredAt: '2026-10-22T05:00:00Z',
    cancelledAt: null,
  },
  drops: [
    { position: 1, zoneName: 'Villa Nueva', status: 'delivered', deliveredAt: '2026-10-22T04:40:00Z', failedReason: null },
    { position: 2, zoneName: 'Independencia', status: 'failed', deliveredAt: null, failedReason: 'El destinatario no responde' },
  ],
  events: [
    {
      id: '00000000-0000-4000-8000-0000000371a1',
      action: 'courier_cancel_match',
      reason: 'Se me rompió la moto',
      createdAt: '2026-10-22T04:05:00Z',
      actorName: 'Juan Pérez',
      actorRole: 'courier',
    },
  ],
  incidents: [
    { id: '00000000-0000-4000-8000-0000000372a1', kind: 'damaged_goods', status: 'open', createdAt: '2026-10-22T05:10:00Z' },
  ],
};

describe('T-410: AdminTripDetailView', () => {
  it('muestra el resultado de cada entrega y el motivo de la no realizada', () => {
    render(<AdminTripDetailView trip={detail} />);

    expect(screen.getByRole('heading', { level: 1, name: 'REQ-00000000' })).toBeDefined();
    expect(screen.getByText(/1 de 2 entregadas/)).toBeDefined();
    const second = screen.getByRole('heading', { level: 3, name: /Entrega 2/ }).closest('li');
    if (!(second instanceof HTMLElement)) throw new Error('sin entrega 2');
    expect(within(second).getByText('No entregada')).toBeDefined();
    expect(within(second).getByText('Motivo: El destinatario no responde')).toBeDefined();
  });

  it('la cronología incluye quién soltó el viaje y su motivo', () => {
    render(<AdminTripDetailView trip={detail} />);

    expect(screen.getByText('Juan Pérez soltó el viaje')).toBeDefined();
    expect(screen.getByText('Motivo: Se me rompió la moto')).toBeDefined();
    expect(screen.getByText('Entrega 1 entregada')).toBeDefined();
  });

  it('muestra las partes con teléfono y enlaza los incidentes', () => {
    render(<AdminTripDetailView trip={detail} />);

    expect(screen.getByRole('link', { name: 'Llamar a Pellegrini Store' }).getAttribute('href')).toBe('tel:3865111111');
    expect(screen.getByText('Mateo Sanchez')).toBeDefined();
    expect(screen.getByText('Sin teléfono')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Ver incidente' }).getAttribute('href')).toBe(
      '/admin/incidents/00000000-0000-4000-8000-0000000372a1'
    );
  });

  it('sin repartidor ni incidentes lo dice explícitamente', () => {
    render(<AdminTripDetailView trip={{ ...detail, courier: null, incidents: [] }} />);

    expect(screen.getByText('Este viaje no tiene un repartidor asignado.')).toBeDefined();
    expect(screen.getByText('Este viaje no tiene incidentes.')).toBeDefined();
  });
});

describe('PR510-H01: entregas legacy y solicitudes cerradas sin entregar', () => {
  it('una solicitud legacy entregada sin filas de entregas muestra su única entrega como entregada', () => {
    render(<AdminTripDetailView trip={{ ...detail, drops: [] }} />);

    const drop = screen.getByRole('heading', { level: 3, name: /Entrega 1/ }).closest('li');
    if (!(drop instanceof HTMLElement)) throw new Error('sin entrega');
    expect(within(drop).getByText('Entregada')).toBeDefined();
    expect(screen.getByText(/1 de 1 entregadas/)).toBeDefined();
  });

  it('una solicitud legacy no entregada no inventa un resultado: «Sin resultado individual registrado»', () => {
    render(
      <AdminTripDetailView
        trip={{
          ...detail,
          status: 'cancelled',
          timeline: { ...detail.timeline, deliveredAt: null, cancelledAt: '2026-10-22T05:00:00Z' },
          drops: [],
        }}
      />
    );

    const drop = screen.getByRole('heading', { level: 3, name: /Entrega 1/ }).closest('li');
    if (!(drop instanceof HTMLElement)) throw new Error('sin entrega');
    expect(within(drop).getByText('Sin resultado individual registrado')).toBeDefined();
    expect(within(drop).queryByText(/Entregada|No entregada|Pendiente|Sin entregar/)).toBeNull();
  });

  it('una entrega pendiente de una solicitud cancelada se muestra como «Sin entregar»', () => {
    render(
      <AdminTripDetailView
        trip={{
          ...detail,
          status: 'cancelled',
          timeline: { ...detail.timeline, deliveredAt: null, cancelledAt: '2026-10-22T05:00:00Z' },
          drops: [{ position: 1, zoneName: 'Centro', status: 'pending', deliveredAt: null, failedReason: null }],
        }}
      />
    );

    expect(screen.getByText('Sin entregar')).toBeDefined();
    expect(screen.queryByText('Pendiente')).toBeNull();
  });
});

describe('T-410: skeletons', () => {
  it('lista y detalle anuncian la carga y tienen la forma final', () => {
    const { unmount } = render(<AdminTripsListSkeleton />);
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
    expect(document.querySelectorAll('[data-skeleton="row"]')).toHaveLength(4);
    unmount();

    render(<AdminTripDetailSkeleton />);
    expect(document.querySelector('[data-skeleton="drops"]')).not.toBeNull();
    expect(document.querySelector('[data-skeleton="timeline"]')).not.toBeNull();
  });
});
