import { describe, expect, it, vi } from 'vitest';
import { computeDniHmac } from './dni-hmac';

vi.mock('server-only', () => ({}));

const SECRET = 'super-secret-hmac-key-for-test-32bytes';
// Mismo vector que las pruebas del alta (actions.test.ts): el hash no cambia al extraer el helper.
const EXPECTED = '593c04e9d598a3bef0bbefa513180b4225b33b31f4682d9d44d81805e15c01e2';

describe('CC-050: computeDniHmac', () => {
  it('calcula el HMAC-SHA256 del DNI normalizado', () => {
    expect(computeDniHmac('38123456', SECRET)).toBe(EXPECTED);
  });

  it('normaliza puntos y espacios', () => {
    expect(computeDniHmac('38.123.456', SECRET)).toBe(EXPECTED);
    expect(computeDniHmac(' 38 123 456 ', SECRET)).toBe(EXPECTED);
  });

  it('otro secreto da otro hash', () => {
    expect(computeDniHmac('38123456', `${SECRET}x`)).not.toBe(EXPECTED);
  });
});
