import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { requiredError } from './zod-messages';

describe('T-416: requiredError', () => {
  const schema = z.object({ value: z.number(requiredError('Falta el número.', 'Tiene que ser un número.')) });
  const onlyRequired = z.object({ value: z.string(requiredError('Falta el texto.')) });

  it('usa el mensaje de obligatorio solo cuando falta el valor', () => {
    expect(schema.safeParse({}).error?.issues[0]?.message).toBe('Falta el número.');
    expect(onlyRequired.safeParse({}).error?.issues[0]?.message).toBe('Falta el texto.');
  });

  it('con otro tipo usa el mensaje de tipo inválido o el de Zod si no hay', () => {
    expect(schema.safeParse({ value: 'diez' }).error?.issues[0]?.message).toBe('Tiene que ser un número.');
    expect(schema.safeParse({ value: null }).error?.issues[0]?.message).toBe('Tiene que ser un número.');
    const fallback = onlyRequired.safeParse({ value: 10 }).error?.issues[0]?.message;
    expect(fallback).toBeTruthy();
    expect(fallback).not.toBe('Falta el texto.');
  });

  it('no cambia la validación del valor', () => {
    expect(schema.safeParse({ value: 3 }).success).toBe(true);
    expect(onlyRequired.safeParse({ value: 'ok' }).success).toBe(true);
  });
});
