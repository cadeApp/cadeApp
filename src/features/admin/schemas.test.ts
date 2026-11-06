import { describe, it, expect } from 'vitest';
import { ADMIN_COPY } from './copy';
import {
  AUDIT_TARGET_TYPES,
  auditDateRangeBounds,
  parseAdminApplicantsSearchParams,
  parseAdminAuditSearchParams,
} from './schemas';

describe('parseAdminApplicantsSearchParams (PR106-H07)', () => {
  it('retorna tab pending y cursor undefined para un objeto vacío {}', () => {
    const parsed = parseAdminApplicantsSearchParams({});
    expect(parsed).toEqual({ tab: 'pending', cursor: undefined, direction: 'next', query: undefined });
  });

  it('retorna tab approved y cursor undefined para { tab: "approved" }', () => {
    const parsed = parseAdminApplicantsSearchParams({ tab: 'approved' });
    expect(parsed).toEqual({ tab: 'approved', cursor: undefined, direction: 'next', query: undefined });
  });

  it('retorna tab pending cuando recibe tab desconocido "ghost"', () => {
    const parsed = parseAdminApplicantsSearchParams({ tab: 'ghost' });
    expect(parsed.tab).toBe('pending');
  });

  it('T-420: acepta un cursor «fecha de alta~id» válido', () => {
    const cursor = '2026-11-03T16:22:06.662075+00:00~a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    expect(parseAdminApplicantsSearchParams({ cursor }).cursor).toBe(cursor);
  });

  it.each([
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    '2026-11-03T16:22:06Z',
    '2026-11-03T16:22:06Z~no-es-uuid',
    '2026-11-03T16:22:06Z~a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11~extra',
    'x),id.gt.0~a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  ])('T-420: descarta el cursor %s (sus partes van al filtro de PostgREST)', (cursor) => {
    expect(parseAdminApplicantsSearchParams({ cursor }).cursor).toBeUndefined();
  });

  it('retorna cursor undefined cuando recibe cursor inválido "abc"', () => {
    const parsed = parseAdminApplicantsSearchParams({ cursor: 'abc' });
    expect(parsed.cursor).toBeUndefined();
  });

  it('retorna cursor undefined cuando recibe cursor malicioso "javascript:alert(1)"', () => {
    const parsed = parseAdminApplicantsSearchParams({ cursor: 'javascript:alert(1)' });
    expect(parsed.cursor).toBeUndefined();
  });

  it('T-403: q se recorta y llega como término; vacío o en blanco es sin búsqueda', () => {
    expect(parseAdminApplicantsSearchParams({ q: '  jose  ' }).query).toBe('jose');
    expect(parseAdminApplicantsSearchParams({ q: '   ' }).query).toBeUndefined();
    expect(parseAdminApplicantsSearchParams({ q: '' }).query).toBeUndefined();
  });

  it('T-403: q de más de 80 caracteres o de otro tipo se descarta', () => {
    expect(parseAdminApplicantsSearchParams({ q: 'a'.repeat(80) }).query).toHaveLength(80);
    expect(parseAdminApplicantsSearchParams({ q: 'a'.repeat(81) }).query).toBeUndefined();
    expect(parseAdminApplicantsSearchParams({ q: ['jose', 'ana'] }).query).toBeUndefined();
  });

  it('T-403: dir=prev solo vale con cursor; cualquier otro valor es next', () => {
    const cursor = '2026-11-03T16:22:06.662075+00:00~a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    expect(parseAdminApplicantsSearchParams({ cursor, dir: 'prev' }).direction).toBe('prev');
    expect(parseAdminApplicantsSearchParams({ dir: 'prev' }).direction).toBe('next');
    expect(parseAdminApplicantsSearchParams({ cursor, dir: 'atras' }).direction).toBe('next');
    expect(parseAdminApplicantsSearchParams({ cursor }).direction).toBe('next');
  });
});

describe('T-400: AUDIT_TARGET_TYPES (filtro de entidades)', () => {
  it('ofrece todas las entidades con etiqueta, ni más ni menos', () => {
    expect([...AUDIT_TARGET_TYPES].sort()).toEqual(Object.keys(ADMIN_COPY.audit.entities).sort());
  });

  it('acepta una entidad nueva del catálogo y descarta una desconocida', () => {
    expect(parseAdminAuditSearchParams({ entity: 'incident' }).targetType).toBe('incident');
    expect(parseAdminAuditSearchParams({ entity: 'ghost' }).targetType).toBeUndefined();
  });

  it('PR607-D02: courier acepta solo un UUID', () => {
    const id = 'c0000000-0000-4000-8000-000000000404';
    expect(parseAdminAuditSearchParams({ courier: id }).courierId).toBe(id);
    expect(parseAdminAuditSearchParams({ courier: 'x),or(id.gt.0' }).courierId).toBeUndefined();
  });

  it('PR607-D02: courier convive con cursor, operador y entidad', () => {
    const courier = 'c0000000-0000-4000-8000-000000000404';
    const actor = 'a0000000-0000-4000-8000-000000000001';
    expect(parseAdminAuditSearchParams({ courier, cursor: '90', actor, entity: 'courier_document' })).toEqual({
      cursor: 90,
      actorId: actor,
      targetType: 'courier_document',
      courierId: courier,
    });
  });
});

describe('T-407: rango de fechas, targetId y dirección de A06', () => {
  const TARGET = 'c0000000-0000-4000-8000-000000000407';

  it('Desde = Hasta = 21/10/2026 es el día de Argentina [03:00Z, 03:00Z del día siguiente)', () => {
    const filters = parseAdminAuditSearchParams({ from: '2026-10-21', to: '2026-10-21' });
    expect(filters).toMatchObject({ from: '2026-10-21', to: '2026-10-21' });
    expect(auditDateRangeBounds(filters)).toEqual({
      gte: '2026-10-21T03:00:00.000Z',
      lt: '2026-10-22T03:00:00.000Z',
    });
  });

  it('el borde superior es semiabierto: 02:59:59.999Z entra y 03:00:00Z no', () => {
    const { gte, lt } = auditDateRangeBounds({ from: '2026-10-21', to: '2026-10-21' });
    const inRange = (iso: string) =>
      (gte === undefined || iso >= gte) && (lt === undefined || iso < lt);
    expect(inRange('2026-10-22T02:59:59.999Z')).toBe(true);
    expect(inRange('2026-10-22T03:00:00.000Z')).toBe(false);
    expect(inRange('2026-10-21T02:59:59.999Z')).toBe(false);
  });

  it('el fin de mes y de año pasa al día civil siguiente', () => {
    expect(auditDateRangeBounds({ to: '2026-12-31' })).toEqual({ lt: '2027-01-01T03:00:00.000Z' });
    expect(auditDateRangeBounds({ from: '2026-03-01' })).toEqual({ gte: '2026-03-01T03:00:00.000Z' });
    expect(auditDateRangeBounds({})).toEqual({});
  });

  it('acepta un solo borde', () => {
    expect(parseAdminAuditSearchParams({ from: '2026-10-21' })).toEqual({ from: '2026-10-21' });
    expect(parseAdminAuditSearchParams({ to: '2026-10-21' })).toEqual({ to: '2026-10-21' });
  });

  it('descarta el rango y lo marca inválido si Hasta < Desde, pasa de 366 días o una fecha no existe', () => {
    for (const raw of [
      { from: '2026-10-22', to: '2026-10-21' },
      { from: '2025-10-21', to: '2026-10-22' },
      { from: '2026-02-30' },
      { to: '21/10/2026' },
    ]) {
      const filters = parseAdminAuditSearchParams(raw);
      expect(filters.from).toBeUndefined();
      expect(filters.to).toBeUndefined();
      expect(filters.invalidDateRange).toBe(true);
    }
  });

  it('366 días contando ambos extremos es el máximo válido', () => {
    expect(parseAdminAuditSearchParams({ from: '2025-10-22', to: '2026-10-22' })).toEqual({
      from: '2025-10-22',
      to: '2026-10-22',
    });
    expect(parseAdminAuditSearchParams({ from: '2025-10-21', to: '2026-10-21' })).toEqual({
      from: '2025-10-21',
      to: '2026-10-21',
    });
  });

  it('un campo de fecha vacío (formulario sin completar) no es un error', () => {
    expect(parseAdminAuditSearchParams({ from: '', to: '' })).toEqual({});
  });

  it('target acepta solo un UUID; uno inválido se descarta sin tocar el resto', () => {
    expect(parseAdminAuditSearchParams({ target: TARGET, entity: 'courier' })).toEqual({
      targetId: TARGET,
      targetType: 'courier',
    });
    expect(parseAdminAuditSearchParams({ target: 'x),or(id.gt.0', entity: 'courier' })).toEqual({
      targetType: 'courier',
    });
  });

  it('dir=prev solo vale con cursor', () => {
    expect(parseAdminAuditSearchParams({ cursor: '90', dir: 'prev' })).toEqual({ cursor: 90, direction: 'prev' });
    expect(parseAdminAuditSearchParams({ dir: 'prev' })).toEqual({});
    expect(parseAdminAuditSearchParams({ cursor: '90', dir: 'atras' })).toEqual({ cursor: 90 });
  });
});
