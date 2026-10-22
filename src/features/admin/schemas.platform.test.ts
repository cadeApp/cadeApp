import { describe, it, expect } from 'vitest';
import { parseAdminAuditSearchParams, parseAdminMerchantsSearchParams } from './schemas';

const UUID = 'a0000000-0000-4000-8000-000000000001';

describe('T-123: parseAdminMerchantsSearchParams', () => {
  it('sin parámetros devuelve la primera página', () => {
    expect(parseAdminMerchantsSearchParams({})).toEqual({});
  });

  it('acepta un cursor uuid', () => {
    expect(parseAdminMerchantsSearchParams({ cursor: UUID })).toEqual({ cursor: UUID });
  });

  it.each(['abc', '1', "'; drop table merchants;--", ['x', 'y']])(
    'descarta el cursor inválido %s',
    (cursor) => {
      expect(parseAdminMerchantsSearchParams({ cursor })).toEqual({});
    }
  );
});

describe('T-123: parseAdminAuditSearchParams', () => {
  it('sin parámetros devuelve la primera página sin filtros', () => {
    expect(parseAdminAuditSearchParams({})).toEqual({});
  });

  it('parsea cursor numérico, operador, evento y entidad válidos', () => {
    expect(
      parseAdminAuditSearchParams({
        cursor: '120',
        actor: UUID,
        action: 'admin_update_setting',
        entity: 'platform_setting',
      })
    ).toEqual({
      cursor: 120,
      actorId: UUID,
      action: 'admin_update_setting',
      targetType: 'platform_setting',
    });
  });

  it.each(['0', '-3', '1.5', 'Infinity', 'abc', ''])('descarta el cursor inválido %s', (cursor) => {
    expect(parseAdminAuditSearchParams({ cursor })).toEqual({});
  });

  it('descarta operador que no es uuid', () => {
    expect(parseAdminAuditSearchParams({ actor: 'lautaro' })).toEqual({});
  });

  it('descarta entidad desconocida', () => {
    expect(parseAdminAuditSearchParams({ entity: 'settlement' })).toEqual({});
  });

  it('descarta un tipo de evento con caracteres fuera de snake_case', () => {
    expect(parseAdminAuditSearchParams({ action: 'admin_update_setting)' })).toEqual({});
    expect(parseAdminAuditSearchParams({ action: 'x'.repeat(200) })).toEqual({});
  });
});
