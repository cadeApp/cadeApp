import { describe, it, expect } from 'vitest';
import { auditActionLabel, auditActionTone, auditFieldLabel, describeAuditChange } from './audit-format';
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

  it('PR617-H01: resolver un incidente es positiva; desestimarlo es neutra', () => {
    const incident = (after: string): AuditChange[] => [{ field: 'status', before: 'open', after }];
    expect(auditActionTone({ action: 'admin_resolve_incident', changes: incident('resolved') })).toBe('positive');
    expect(auditActionTone({ action: 'admin_resolve_incident', changes: incident('dismissed') })).toBe('neutral');
    expect(auditActionTone({ action: 'admin_resolve_incident', changes: [] })).toBe('neutral');
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

describe('PR617-H03: estados de incidentes en español', () => {
  const incident = { targetType: 'incident', targetRef: 'd0000000' } as const;

  it('open → resolved y open → dismissed se leen como en A05', () => {
    expect(describeAuditChange(incident, { field: 'status', before: 'open', after: 'resolved' })).toEqual({
      before: 'Abierto',
      after: 'Resuelto',
    });
    expect(describeAuditChange(incident, { field: 'status', before: 'reviewing', after: 'dismissed' })).toEqual({
      before: 'En revisión',
      after: 'Cerrado sin sanción',
    });
  });
});

describe('CC-050 (D5-A): etiqueta y valores de la liberación de DNI', () => {
  it('etiqueta la acción y muestra dni_registered como sí → no', () => {
    expect(auditActionLabel('courier_dni_released')).toBe('Liberó el DNI reservado');
    expect(auditFieldLabel('dni_registered')).toBe('DNI registrado');
    expect(
      describeAuditChange(
        { targetType: 'courier', targetRef: '12345678' },
        { field: 'dni_registered', before: true, after: false }
      )
    ).toEqual({ before: 'sí', after: 'no' });
  });
});
