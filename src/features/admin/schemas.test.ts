import { describe, it, expect } from 'vitest';
import { ADMIN_COPY } from './copy';
import {
  AUDIT_TARGET_TYPES,
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
