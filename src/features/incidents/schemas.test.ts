import { describe, it, expect } from 'vitest';
import { parseIncidentsSearchParams } from './schemas';

describe('T-124: parseIncidentsSearchParams (A05)', () => {
  it('sin parámetros abre la pestaña de abiertos, primera página', () => {
    expect(parseIncidentsSearchParams({})).toEqual({ tab: 'open' });
  });

  it('acepta la pestaña cerrados y un cursor ISO', () => {
    expect(
      parseIncidentsSearchParams({ tab: 'closed', cursor: '2026-09-27T12:00:00.000Z' })
    ).toEqual({ tab: 'closed', cursor: '2026-09-27T12:00:00.000Z' });
  });

  it.each(['resolved', 'OPEN', '', ['open', 'closed']])('una pestaña inválida (%s) vuelve a abiertos', (tab) => {
    expect(parseIncidentsSearchParams({ tab })).toEqual({ tab: 'open' });
  });

  it.each(['ayer', '2026-13-40', "1' or '1'='1", ['2026-09-27T12:00:00.000Z']])(
    'descarta el cursor inválido %s sin afectar la pestaña',
    (cursor) => {
      expect(parseIncidentsSearchParams({ tab: 'closed', cursor })).toEqual({ tab: 'closed' });
    }
  );
});
