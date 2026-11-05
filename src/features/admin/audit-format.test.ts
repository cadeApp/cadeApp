import { describe, it, expect } from 'vitest';
import { auditActionTone, describeAuditChange } from './audit-format';
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

describe('T-407: auditActionTone (etiqueta de acción por tipo)', () => {
  const status = (after: string): AuditChange[] => [{ field: 'status', before: 'pending', after }];

  it('aprobar y verificar son positivas; rechazar es negativa', () => {
    expect(auditActionTone({ action: 'admin_decide_courier', changes: status('approved') })).toBe('positive');
    expect(auditActionTone({ action: 'admin_decide_courier', changes: status('rejected') })).toBe('negative');
    expect(auditActionTone({ action: 'admin_verify_document', changes: status('verified') })).toBe('positive');
    expect(auditActionTone({ action: 'admin_verify_document', changes: status('rejected') })).toBe('negative');
  });

  it('una decisión sin estado legible queda neutra', () => {
    expect(auditActionTone({ action: 'admin_decide_courier', changes: [] })).toBe('neutral');
    expect(auditActionTone({ action: 'admin_decide_courier', changes: status('raro') })).toBe('neutral');
  });

  it('ver un documento es acceso a datos; suspender es negativa; reactivar, positiva', () => {
    expect(auditActionTone({ action: 'view_courier_document', changes: [] })).toBe('access');
    expect(auditActionTone({ action: 'admin_suspend_courier', changes: status('suspended') })).toBe('negative');
    expect(auditActionTone({ action: 'admin_reinstate_courier', changes: status('approved') })).toBe('positive');
  });

  it('los cambios de configuración y las acciones desconocidas son neutras', () => {
    expect(auditActionTone({ action: 'admin_update_setting', changes: [] })).toBe('neutral');
    expect(auditActionTone({ action: 'admin_set_subscription', changes: [] })).toBe('neutral');
    expect(auditActionTone({ action: 'constructor', changes: [] })).toBe('neutral');
  });
});
