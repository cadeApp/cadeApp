// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';
import { createClient } from '@/server/supabase/server';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

type ServerClient = Awaited<ReturnType<typeof createClient>>;

const USER_A = '00000000-0000-4000-8000-00000000000a';
const USER_B = '00000000-0000-4000-8000-00000000000b';
const ENDPOINT_A = 'https://push.example.com/sub/account-a';

interface Row {
  id: string;
  user_id: string;
  endpoint: string;
}

/**
 * Cliente de sesión falso: `push_subscriptions` filtra por cada `.eq()` encadenado, como lo haría PostgREST.
 * Si la ruta deja de acotar por `user_id`, el endpoint de otra cuenta aparece como propio.
 */
function mockSession(options: { userId: string | null; rows?: Row[]; dbError?: boolean }) {
  const filters: Array<[string, unknown]> = [];
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return query;
    }),
    maybeSingle: vi.fn(async () => {
      if (options.dbError) {
        return { data: null, error: { message: `relation failed for ${ENDPOINT_A}` } };
      }
      const match = (options.rows ?? []).find((row) =>
        filters.every(([column, value]) => row[column as keyof Row] === value)
      );
      return { data: match ? { id: match.id } : null, error: null };
    }),
  };
  const from = vi.fn(() => query);
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue(
        options.userId
          ? { data: { user: { id: options.userId } }, error: null }
          : { data: { user: null }, error: new Error('No session') }
      ),
    },
    from,
  } as unknown as ServerClient);
  return { from, query, filters };
}

function statusRequest(body: string) {
  return new NextRequest('http://localhost:3000/api/push/subscriptions/status', { method: 'POST', body });
}

describe('T-382: POST /api/push/subscriptions/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('responde 401 sin sesión y no consulta la base', async () => {
    const { from } = mockSession({ userId: null });

    const res = await POST(statusRequest(JSON.stringify({ endpoint: ENDPOINT_A })));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    ['endpoint que no es URL', JSON.stringify({ endpoint: 'no-es-url' })],
    ['endpoint ausente', JSON.stringify({})],
    ['endpoint numérico', JSON.stringify({ endpoint: 42 })],
    ['JSON inválido', '{endpoint'],
  ])('responde 400 con payload inválido (%s) sin consultar la base', async (_case, body) => {
    const { from } = mockSession({ userId: USER_A });

    const res = await POST(statusRequest(body));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid payload' });
    expect(from).not.toHaveBeenCalled();
  });

  it('responde active: true para un endpoint propio, acotado por user_id con el cliente de sesión', async () => {
    const { from, filters } = mockSession({
      userId: USER_A,
      rows: [{ id: 'sub-a', user_id: USER_A, endpoint: ENDPOINT_A }],
    });

    const res = await POST(statusRequest(JSON.stringify({ endpoint: ENDPOINT_A })));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ active: true });
    expect(from).toHaveBeenCalledWith('push_subscriptions');
    expect(filters).toEqual(expect.arrayContaining([['endpoint', ENDPOINT_A], ['user_id', USER_A]]));
  });

  it('responde active: false para el endpoint de otra cuenta, sin ids ni datos de esa cuenta', async () => {
    mockSession({
      userId: USER_B,
      rows: [{ id: 'sub-a', user_id: USER_A, endpoint: ENDPOINT_A }],
    });

    const res = await POST(statusRequest(JSON.stringify({ endpoint: ENDPOINT_A })));
    const text = await res.text();

    expect(res.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ active: false });
    expect(text).not.toContain(USER_A);
    expect(text).not.toContain('sub-a');
  });

  it('responde active: false para un endpoint sin suscripción', async () => {
    mockSession({ userId: USER_A, rows: [] });

    const res = await POST(statusRequest(JSON.stringify({ endpoint: ENDPOINT_A })));

    expect(await res.json()).toEqual({ active: false });
  });

  it('responde 500 ante error de base sin filtrar el endpoint ni el detalle', async () => {
    mockSession({ userId: USER_A, dbError: true });

    const res = await POST(statusRequest(JSON.stringify({ endpoint: ENDPOINT_A })));
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(JSON.parse(text)).toEqual({ error: 'Database error' });
    expect(text).not.toContain(ENDPOINT_A);
    expect(text).not.toContain('relation failed');
  });
});
