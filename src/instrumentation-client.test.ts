import { afterEach, describe, expect, it, vi } from 'vitest';

describe('T-436 (D5-C): Zod sin JIT desde instrumentation-client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('activa jitless antes de construir esquemas y Zod nunca prueba new Function', async () => {
    const probe = vi.spyOn(globalThis, 'Function');
    await import('./instrumentation-client');
    const { z } = await import('zod');

    const schema = z.object({ a: z.string() });

    expect(z.config().jitless).toBe(true);
    expect(schema.parse({ a: 'x' })).toEqual({ a: 'x' });
    expect(probe).not.toHaveBeenCalled();
  });
});
