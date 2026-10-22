// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /api/health', () => {
  it('responde 200 OK con el estado del servicio', async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const json = await response.json();
    expect(json).toEqual({ status: 'ok' });
  });
});
