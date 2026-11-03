import { describe, it, expect } from 'vitest';
import { parseAdminApplicantsSearchParams } from './schemas';

describe('parseAdminApplicantsSearchParams (PR106-H07)', () => {
  it('retorna tab pending y cursor undefined para un objeto vacío {}', () => {
    const parsed = parseAdminApplicantsSearchParams({});
    expect(parsed).toEqual({ tab: 'pending', cursor: undefined });
  });

  it('retorna tab approved y cursor undefined para { tab: "approved" }', () => {
    const parsed = parseAdminApplicantsSearchParams({ tab: 'approved' });
    expect(parsed).toEqual({ tab: 'approved', cursor: undefined });
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
});
