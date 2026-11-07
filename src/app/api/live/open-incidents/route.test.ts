import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import * as auth from '@/features/auth/server';
import * as incidents from '@/features/incidents/server';
import { liveOpenIncidentsResponseSchema } from '@/lib/live-contracts';

vi.mock('@/features/auth/server', () => ({ getServerSession: vi.fn() }));
vi.mock('@/features/incidents/server', () => ({ getOpenIncidentsCount: vi.fn() }));

const ADMIN = {
  userId: 'a0000000-0000-4000-8000-000000000001',
  email: 'admin@example.com',
  role: 'admin',
  aal: 'aal2',
  consentStatus: 'active',
} as const;

describe('T-406: GET /api/live/open-incidents', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 con el conteo validado y sin caché para admin aal2', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(ADMIN);
    vi.mocked(incidents.getOpenIncidentsCount).mockResolvedValue(4);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(liveOpenIncidentsResponseSchema.parse(await response.json())).toEqual({ count: 4 });
  });

  it.each([
    ['sin sesión', null, 401, 'UNAUTHENTICATED'],
    ['comercio', { ...ADMIN, role: 'merchant' }, 403, 'UNAUTHORIZED_ACTOR'],
    ['repartidor', { ...ADMIN, role: 'courier' }, 403, 'UNAUTHORIZED_ACTOR'],
    ['admin sin aal2', { ...ADMIN, aal: 'aal1' }, 403, 'UNAUTHORIZED_ACTOR'],
  ] as const)('%s: responde %s sin leer incidentes', async (_name, session, status, error) => {
    vi.mocked(auth.getServerSession).mockResolvedValue(session);
    const response = await GET();
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
    expect(incidents.getOpenIncidentsCount).not.toHaveBeenCalled();
  });

  it('500 sin detalles si la lectura falla', async () => {
    vi.mocked(auth.getServerSession).mockResolvedValue(ADMIN);
    vi.mocked(incidents.getOpenIncidentsCount).mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'DATABASE_ERROR' });
  });
});
