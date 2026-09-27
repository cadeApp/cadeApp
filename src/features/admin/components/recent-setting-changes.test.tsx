// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RecentSettingChanges } from './recent-setting-changes';
import type { AuditLogItem } from '../types';

const items: readonly AuditLogItem[] = [
  {
    id: 91,
    createdAt: '2026-09-27T12:00:00.000Z',
    actorName: 'Lautaro',
    action: 'admin_update_setting',
    targetType: 'platform_setting',
    targetRef: 'min_offer_ars',
    changes: [{ field: 'value', before: 1000, after: 1500 }],
    hasReason: false,
  },
  {
    id: 88,
    createdAt: '2026-09-26T09:30:00.000Z',
    actorName: null,
    action: 'admin_update_setting',
    targetType: 'platform_setting',
    targetRef: 'request_ttl_minutes',
    changes: [{ field: 'value', before: 30, after: 45 }],
    hasReason: false,
  },
];

describe('T-123: RecentSettingChanges (A04, panel «Últimos cambios»)', () => {
  it('renderiza un elemento por evento', () => {
    render(<RecentSettingChanges items={items} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('muestra el parámetro, el cambio antes → después, la fecha y el operador', () => {
    render(<RecentSettingChanges items={items} />);
    const [first, second] = screen.getAllByRole('listitem');
    if (!first || !second) throw new Error('faltan eventos');

    expect(first.textContent ?? '').toMatch(/oferta m[ií]nima|min_offer_ars/i);
    expect(first.textContent ?? '').toMatch(/1\.?000[\s\S]*1\.?500/);
    expect(first.querySelector('time')?.getAttribute('dateTime')).toBe('2026-09-27T12:00:00.000Z');
    expect(within(first).getByText(/lautaro/i)).toBeTruthy();

    expect(second.textContent ?? '').toMatch(/vencimiento|request_ttl_minutes/i);
    expect(second.textContent ?? '').toMatch(/30[\s\S]*45/);
    expect(second.querySelector('time')?.getAttribute('dateTime')).toBe('2026-09-26T09:30:00.000Z');
    expect(within(second).getByText(/sistema/i)).toBeTruthy();
  });

  it('no expone identificadores internos del evento fuera de changes', () => {
    render(<RecentSettingChanges items={items} />);
    const text = document.body.textContent ?? '';
    expect(text).not.toContain('admin_update_setting');
    expect(text).not.toContain('platform_setting');
  });

  it('muestra un estado vacío sin eventos', () => {
    render(<RecentSettingChanges items={[]} />);
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByText(/sin cambios/i)).toBeTruthy();
  });
});
