import { describe, expect, it } from 'vitest';
import { publicEnvSchema, getPublicEnv } from './env.public';

describe('Public Environment Schema Mapping', () => {
  it('getPublicEnv mapea explícitamente todas las claves del schema para inlineado de webpack', () => {
    const claves = Object.keys(publicEnvSchema.shape);
    const fuente = getPublicEnv.toString();
    for (const clave of claves) {
      expect(fuente, `falta process.env.${clave} en getPublicEnv`).toContain(`process.env.${clave}`);
    }
  });
});
