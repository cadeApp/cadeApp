import { describe, expect, it } from 'vitest';
import { adminTripsHref, parseAdminTripsSearchParams, serializeAdminTripsCursor } from './schemas';

const CURSOR = { createdAt: '2026-10-22T03:00:00.123456Z', id: '00000000-0000-4000-8000-000000370001' };

describe('T-410: searchParams de /admin/trips', () => {
  it('sin parámetros abre «Con problemas»', () => {
    expect(parseAdminTripsSearchParams({})).toEqual({ filter: 'problems' });
  });

  it('lee filter=all y el cursor compuesto con microsegundos', () => {
    expect(parseAdminTripsSearchParams({ filter: 'all', cursor: serializeAdminTripsCursor(CURSOR) })).toEqual({
      filter: 'all',
      cursor: CURSOR,
    });
  });

  it('un filtro o un cursor inválidos vuelven al valor por defecto', () => {
    expect(parseAdminTripsSearchParams({ filter: 'open', cursor: 'basura' })).toEqual({ filter: 'problems' });
    expect(parseAdminTripsSearchParams({ filter: ['all', 'problems'] })).toEqual({ filter: 'problems' });
  });

  it('arma los enlaces de pestañas y paginación', () => {
    expect(adminTripsHref('problems')).toBe('/admin/trips');
    expect(adminTripsHref('all')).toBe('/admin/trips?filter=all');
    expect(adminTripsHref('problems', CURSOR)).toBe(
      `/admin/trips?cursor=${encodeURIComponent(serializeAdminTripsCursor(CURSOR))}`
    );
  });
});
