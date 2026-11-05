// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ApplicantHistory } from './applicant-history';
import type { ApplicantHistoryEvent } from '../types';

const EVENTS: ApplicantHistoryEvent[] = [
  { kind: 'registered', id: 'registered', at: '2026-11-01T10:00:00.000Z' },
  { kind: 'submitted', id: 'submitted', at: '2026-11-01T11:00:00.000Z' },
  {
    kind: 'audit',
    id: 'audit-2',
    at: '2026-11-02T10:00:00.000Z',
    label: 'Vio un documento',
    detail: 'DNI Frente',
    reason: null,
    actorName: 'Lautaro',
  },
  {
    kind: 'audit',
    id: 'audit-3',
    at: '2026-11-03T10:00:00.000Z',
    label: 'Suspendió un repartidor',
    detail: null,
    reason: 'Reclamos reiterados',
    actorName: 'Lautaro',
  },
];

afterEach(() => cleanup());

describe('T-404: ApplicantHistory', () => {
  it('muestra los eventos en el orden que llegan, con etiqueta, fecha, quién y motivo', () => {
    render(<ApplicantHistory events={EVENTS} />);
    const items = within(screen.getByRole('list', { name: 'Historial del postulante' })).getAllByRole('listitem');

    expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual([
      'Registrado',
      'Postulación enviada',
      'Vio un documento · DNI Frente',
      'Suspendió un repartidor',
    ]);
    expect(items[3]?.textContent).toContain('por Lautaro');
    expect(items[3]?.textContent).toContain('Motivo: Reclamos reiterados');
    expect(items[0]?.querySelector('time')?.getAttribute('dateTime')).toBe('2026-11-01T10:00:00.000Z');
  });

  it('sin «Postulación enviada» no la inventa', () => {
    render(<ApplicantHistory events={EVENTS.filter((event) => event.kind !== 'submitted')} />);
    expect(screen.queryByText('Postulación enviada')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('sin eventos lo dice, y siempre ofrece «Ver todo en Auditoría»', () => {
    render(<ApplicantHistory events={[]} />);
    expect(screen.getByText('Sin eventos registrados.')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Ver todo en Auditoría' }).getAttribute('href')).toBe(
      '/admin/audit?entity=courier'
    );
  });
});
