import { describe, expect, it } from 'vitest';
import { isoTimestampSchema, uuidSchema } from './rpc-contracts';

/**
 * T-416: la migración a Zod 4 no cambia qué acepta cada contrato. Estas pruebas fijan los formatos que Zod 4 trata
 * distinto por defecto.
 */
describe('T-416: semántica de los contratos con Zod 4', () => {
  it('un id con formato 8-4-4-4-12 hexadecimal sigue siendo válido aunque no sea UUID RFC', () => {
    // Ids que la base puede tener sin ser UUID RFC 9562 (seeds, fixtures, ids generados fuera de gen_random_uuid).
    const ids = [
      '11111111-1111-1111-1111-111111111111',
      '00000000-0000-0000-0000-000000000001',
      'ABCDEF00-1111-4111-8111-111111111111',
      crypto.randomUUID(),
    ];
    for (const id of ids) expect(uuidSchema.safeParse(id).success, id).toBe(true);
  });

  it('lo que no tiene ese formato se sigue rechazando', () => {
    for (const id of ['', 'not-a-uuid', '11111111111111111111111111111111', '11111111-1111-1111-1111-11111111111g']) {
      expect(uuidSchema.safeParse(id).success, id).toBe(false);
    }
  });

  it('las fechas que devuelven Postgres y JS siguen siendo válidas y las que no tienen zona, no', () => {
    for (const value of ['2026-10-26T10:00:00.123456+00:00', '2026-10-26T10:00:00-03:00', new Date().toISOString()]) {
      expect(isoTimestampSchema.safeParse(value).success, value).toBe(true);
    }
    for (const value of ['2026-10-26T10:00:00', '2026-10-26 10:00:00+00', 'ayer']) {
      expect(isoTimestampSchema.safeParse(value).success, value).toBe(false);
    }
  });
});
