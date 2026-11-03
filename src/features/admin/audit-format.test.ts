import { describe, it, expect } from 'vitest';
import { describeAuditChange } from './audit-format';
import type { AuditChange } from './types';

const courierDoc = { targetType: 'courier_document', targetRef: 'c0000000' } as const;
const courier = { targetType: 'courier', targetRef: 'b0000000' } as const;

describe('T-400: describeAuditChange (valores de un solo lado)', () => {
  it('un campo solo en after se muestra como dato, sin flecha', () => {
    const change: AuditChange = { field: 'docLevel', after: 2 };
    expect(describeAuditChange(courierDoc, change)).toEqual({ value: '2' });
    expect(describeAuditChange(courier, { field: 'withdrawnOffersCount', after: 0 })).toEqual({
      value: '0',
    });
  });

  it('un campo solo en before se muestra como contexto, nunca como «→ —»', () => {
    const change: AuditChange = { field: 'kind', before: 'license' };
    expect(describeAuditChange(courierDoc, change)).toEqual({ value: 'Licencia de Conducir' });
  });

  it('el mismo valor de los dos lados se muestra una sola vez', () => {
    const change: AuditChange = { field: 'kind', before: 'license', after: 'license' };
    expect(describeAuditChange(courierDoc, change)).toEqual({ value: 'Licencia de Conducir' });
  });

  it('un cambio real conserva antes y después, incluido el vacío explícito', () => {
    expect(
      describeAuditChange(courier, { field: 'status', before: 'pending', after: 'rejected' })
    ).toEqual({
      before: 'Pendiente',
      after: 'Rechazado',
    });
    expect(
      describeAuditChange(
        { targetType: 'merchant', targetRef: 'f0000000' },
        { field: 'paid_until', before: null, after: '2026-10-31' }
      )
    ).toEqual({ before: '—', after: '31/10/2026' });
  });
});
