import { describe, expect, it } from 'vitest';
import {
  buildTripTimeline,
  dropDisplayStatus,
  tripDeliverySummary,
  tripDropsForDisplay,
  tripProblemBadges,
} from './problems';
import type { AdminTripDetail, AdminTripListItem } from './types';

const base: AdminTripListItem = {
  id: '00000000-0000-4000-8000-000000370001',
  code: 'REQ-00000000',
  status: 'delivered',
  createdAt: '2026-10-22T03:00:00.000000Z',
  publishedAt: '2026-10-22T03:00:00.000000Z',
  deliveredAt: '2026-10-22T04:00:00.000000Z',
  cancelledAt: null,
  merchantId: '00000000-0000-4000-8000-0000000370b1',
  merchantName: 'Comercio',
  courierId: null,
  courierName: null,
  dropsCount: 2,
  deliveredDrops: 2,
  failedDrops: 0,
  courierReleases: 0,
  noShowReports: 0,
  cancelled: false,
  incidents: 0,
  openIncidents: 0,
};

describe('T-410: tripProblemBadges', () => {
  it('un viaje sin problemas no tiene etiquetas', () => {
    expect(tripProblemBadges(base)).toEqual([]);
  });

  it('cada tipo de problema tiene su etiqueta con conteo, en orden fijo', () => {
    const labels = tripProblemBadges({
      ...base,
      failedDrops: 1,
      courierReleases: 2,
      noShowReports: 1,
      cancelled: true,
      incidents: 3,
      openIncidents: 1,
    }).map((badge) => badge.label);

    expect(labels).toEqual([
      'Entrega no realizada (1)',
      'Repartidor soltó el viaje (2)',
      'No-show',
      'Cancelada',
      'Incidente abierto (1)',
    ]);
  });

  it('con incidentes todos cerrados muestra «Incidente (N)» en tono neutro', () => {
    expect(tripProblemBadges({ ...base, incidents: 2, openIncidents: 0 })).toEqual([
      { key: 'incidents', label: 'Incidente (2)', variant: 'outline' },
    ]);
  });
});

describe('T-410: tripDeliverySummary', () => {
  it('al cerrar dice «N de M entregadas»', () => {
    expect(tripDeliverySummary({ status: 'delivered', dropsCount: 2, deliveredDrops: 1 })).toBe('1 de 2 entregadas');
  });

  it('antes de cerrar, con varias entregas dice cuántas son; con una, nada', () => {
    expect(tripDeliverySummary({ status: 'in_transit', dropsCount: 3, deliveredDrops: 1 })).toBe('3 entregas');
    expect(tripDeliverySummary({ status: 'published', dropsCount: 1, deliveredDrops: 0 })).toBeNull();
  });
});

describe('T-410: buildTripTimeline', () => {
  const detail: AdminTripDetail = {
    id: base.id,
    code: base.code,
    status: 'delivered',
    createdAt: '2026-10-22T03:00:00Z',
    merchant: { id: base.merchantId, name: 'Comercio', phone: null },
    courier: null,
    timeline: {
      publishedAt: '2026-10-22T03:00:00Z',
      matchedAt: '2026-10-22T03:20:00Z',
      pickedUpAt: '2026-10-22T03:30:00Z',
      deliveredAt: '2026-10-22T04:00:00Z',
      cancelledAt: null,
    },
    drops: [
      { position: 1, zoneName: 'Centro', status: 'delivered', deliveredAt: '2026-10-22T03:45:00Z', failedReason: null },
      { position: 2, zoneName: 'Sur', status: 'failed', deliveredAt: null, failedReason: 'No responde' },
    ],
    events: [
      {
        id: '00000000-0000-4000-8000-0000000371a1',
        action: 'courier_cancel_match',
        reason: 'Se me rompió la moto',
        createdAt: '2026-10-22T03:10:00Z',
        actorName: 'Juan',
        actorRole: 'courier',
      },
      {
        id: '00000000-0000-4000-8000-0000000371a2',
        action: 'report_no_show',
        reason: 'no_show',
        createdAt: '2026-10-22T03:15:00Z',
        actorName: 'Comercio',
        actorRole: 'merchant',
      },
    ],
    incidents: [],
  };

  it('ordena hitos, eventos con motivo y entregas por hora', () => {
    const entries = buildTripTimeline(detail);

    expect(entries.map((entry) => entry.title)).toEqual([
      'Publicada',
      'Juan soltó el viaje',
      'El comercio reportó que el repartidor no vino',
      'Asignada a un repartidor',
      'Retirada por el repartidor',
      'Entrega 1 entregada',
      'Finalizada',
    ]);
    expect(entries[1]?.detail).toBe('Motivo: Se me rompió la moto');
  });

  it('la cancelación dice quién canceló y su motivo', () => {
    const entries = buildTripTimeline({
      ...detail,
      status: 'cancelled',
      timeline: { ...detail.timeline, deliveredAt: null, cancelledAt: '2026-10-22T05:00:00Z' },
      drops: [],
      events: [
        {
          id: '00000000-0000-4000-8000-0000000371a3',
          action: 'cancel_request',
          reason: 'Fuera de horario',
          createdAt: '2026-10-22T05:00:00Z',
          actorName: 'Admin',
          actorRole: 'admin',
        },
      ],
    });

    const cancel = entries.find((entry) => entry.key === '00000000-0000-4000-8000-0000000371a3');
    expect(cancel).toMatchObject({ title: 'El admin canceló la solicitud', detail: 'Motivo: Fuera de horario' });
    expect(entries.some((entry) => entry.title === 'Cancelada')).toBe(true);
  });

  it('sin nombre del repartidor usa «El repartidor»', () => {
    const [release] = detail.events;
    if (!release) throw new Error('fixture sin evento');
    const entries = buildTripTimeline({ ...detail, events: [{ ...release, actorName: null }] });
    expect(entries.some((entry) => entry.title === 'El repartidor soltó el viaje')).toBe(true);
  });
});

describe('PR510-H01: tripDropsForDisplay y dropDisplayStatus', () => {
  const legacy: AdminTripDetail = {
    id: base.id,
    code: base.code,
    status: 'delivered',
    createdAt: '2026-10-22T03:00:00Z',
    merchant: { id: base.merchantId, name: 'Comercio', phone: null },
    courier: null,
    timeline: { publishedAt: null, matchedAt: null, pickedUpAt: null, deliveredAt: '2026-10-22T04:00:00Z', cancelledAt: null },
    drops: [],
    events: [],
    incidents: [],
  };

  it('legacy entregada: una entrega entregada con la hora de la solicitud', () => {
    expect(tripDropsForDisplay(legacy)).toEqual([
      { position: 1, zoneName: '', status: 'delivered', deliveredAt: '2026-10-22T04:00:00Z', failedReason: null },
    ]);
  });

  it('legacy sin cerrar: una entrega pendiente', () => {
    expect(tripDropsForDisplay({ ...legacy, status: 'in_transit' })[0]?.status).toBe('pending');
  });

  it('con entregas reales las devuelve tal cual', () => {
    const drops = [{ position: 1, zoneName: 'Centro', status: 'failed' as const, deliveredAt: null, failedReason: 'x' }];
    expect(tripDropsForDisplay({ ...legacy, drops })).toBe(drops);
  });

  it('pendiente en una solicitud cancelada o vencida es «Sin entregar»; el resto conserva su estado', () => {
    expect(dropDisplayStatus({ status: 'pending' }, 'cancelled')).toBe('notDelivered');
    expect(dropDisplayStatus({ status: 'pending' }, 'expired')).toBe('notDelivered');
    expect(dropDisplayStatus({ status: 'pending' }, 'in_transit')).toBe('pending');
    expect(dropDisplayStatus({ status: 'failed' }, 'cancelled')).toBe('failed');
  });

  it('legacy: entregada conserva su estado; cualquier otro cierre no tiene resultado individual', () => {
    expect(dropDisplayStatus({ status: 'delivered' }, 'delivered', true)).toBe('delivered');
    expect(dropDisplayStatus({ status: 'pending' }, 'cancelled', true)).toBe('noRecord');
    expect(dropDisplayStatus({ status: 'pending' }, 'in_transit', true)).toBe('noRecord');
  });
});
