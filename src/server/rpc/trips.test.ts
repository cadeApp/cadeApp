import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import {
  TRIP_AVATAR_SIGNED_URL_TTL_SECONDS,
  getTripDetailsRpc,
  getTripDetailsServer,
} from './trips';

vi.mock('@/server/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/server/supabase/admin', () => ({ createAdminClient: vi.fn() }));

const requestId = '00000000-0000-4000-8000-0000000008e1';
const merchantId = '00000000-0000-4000-8000-0000000008b1';
const courierId = '00000000-0000-4000-8000-0000000008c1';
const time = '2026-09-25T20:00:00.000Z';

const output = {
  requestId,
  code: 'REQ-00000000',
  status: 'matched' as const,
  merchantId,
  merchantName: 'Kiosco Centro',
  merchantPhone: '3865222222',
  courierId,
  courierName: 'Cadete Uno',
  courierPhone: '3865111111',
  vehicleType: 'moto' as const,
  vehiclePlate: 'AA123BB',
  amountArs: 1800,
  pickupAddress: 'San Martín 450',
  pickupZoneName: 'Centro',
  dropoffAddress: 'Belgrano 1220',
  dropoffZoneName: 'Barrio San Martín',
  deliveryNotes: 'Casa con reja negra',
  recipientName: 'Laura Gómez',
  recipientPhone: '3865123456',
  recipientPaymentMethod: 'cash' as const,
  needsChange: true,
  cashChangeAmount: 5000,
  createdAt: time,
  matchedAt: time,
  pickedUpAt: null,
  deliveredAt: null,
};

describe('CC-008 — get_trip_details server boundary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('valida el input y mapea la RPC con nombre/argumentos exactos', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: output, error: null });
    expect(await getTripDetailsRpc({ rpc }, { requestId })).toEqual({ ok: true, data: output });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_trip_details', { p_request_id: requestId });

    const badRpc = vi.fn();
    expect(await getTripDetailsRpc({ rpc: badRpc }, { requestId: 'bad' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(badRpc).not.toHaveBeenCalled();
  });

  it('preserva errores de dominio exactos y rechaza payloads imposibles', async () => {
    const denied = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'UNAUTHORIZED_ACTOR' },
    });
    expect(await getTripDetailsRpc({ rpc: denied }, { requestId })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    const invalid = vi.fn().mockResolvedValue({
      data: { ...output, status: 'published' },
      error: null,
    });
    expect(await getTripDetailsRpc({ rpc: invalid }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('firma solo el avatar verificado/no purgado del cadete y nunca otro documento', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: output, error: null });
    vi.mocked(serverSupabase.createClient).mockResolvedValue({ rpc } as never);

    const eq = vi.fn();
    const is = vi.fn();
    const order = vi.fn();
    const limit = vi.fn();
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { storage_path: `${courierId}/avatar.webp` },
      error: null,
    });
    const builder = {
      eq: (...args: unknown[]) => { eq(...args); return builder; },
      is: (...args: unknown[]) => { is(...args); return builder; },
      order: (...args: unknown[]) => { order(...args); return builder; },
      limit: (...args: unknown[]) => { limit(...args); return builder; },
      maybeSingle,
    };
    const select = vi.fn().mockReturnValue(builder);
    const from = vi.fn().mockReturnValue({ select });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.test/avatar' },
      error: null,
    });
    const storageFrom = vi.fn().mockReturnValue({ createSignedUrl });
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from,
      storage: { from: storageFrom },
    } as never);

    expect(await getTripDetailsServer({ requestId })).toEqual({
      ok: true,
      data: { ...output, avatarUrl: 'https://signed.test/avatar' },
    });
    expect(eq).toHaveBeenCalledWith('courier_id', courierId);
    expect(eq).toHaveBeenCalledWith('kind', 'avatar');
    expect(eq).toHaveBeenCalledWith('status', 'verified');
    expect(is).toHaveBeenCalledWith('purged_at', null);
    expect(storageFrom).toHaveBeenCalledExactlyOnceWith('courier-docs');
    expect(createSignedUrl).toHaveBeenCalledExactlyOnceWith(
      `${courierId}/avatar.webp`,
      TRIP_AVATAR_SIGNED_URL_TTL_SECONDS
    );
  });

  it('sin avatar verificado devuelve null y no firma ningún objeto', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: output, error: null });
    vi.mocked(serverSupabase.createClient).mockResolvedValue({ rpc } as never);

    const builder = {
      eq: vi.fn(),
      is: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as {
      eq: ReturnType<typeof vi.fn>;
      is: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
      maybeSingle: ReturnType<typeof vi.fn>;
    };
    builder.eq.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.limit.mockReturnValue(builder);

    const createSignedUrl = vi.fn();
    vi.mocked(adminSupabase.createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(builder) }),
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
    } as never);

    expect(await getTripDetailsServer({ requestId })).toEqual({
      ok: true,
      data: { ...output, avatarUrl: null },
    });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('la migración preserva consent gate, search_path y grants mínimos', () => {
    const sql = readFileSync('supabase/migrations/20260926010000_cc008_trip_details.sql', 'utf8');
    expect(sql).toMatch(/security\s+definer/i);
    expect(sql).toMatch(/set\s+search_path\s*=\s*public\s*,\s*pg_temp/i);
    expect(sql).toMatch(/app_private\.is_active_operational_actor\(\)/i);
    expect(sql).toMatch(/revoke\s+all\s+on\s+function\s+public\.get_trip_details\(uuid\)\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i);
    expect(sql).toMatch(/grant\s+execute\s+on\s+function\s+public\.get_trip_details\(uuid\)\s+to\s+authenticated/i);

    const mutated = sql.replace(/or\s+not\s+app_private\.is_active_operational_actor\(\)/i, '');
    expect(mutated).not.toMatch(/or\s+not\s+app_private\.is_active_operational_actor\(\)/i);
  });

  it('pgTAP enumera pending y reconsent_required para ambos roles', () => {
    const sql = readFileSync('supabase/tests/cc008_trip_details.sql', 'utf8');
    expect(sql).toContain('pending merchant cannot bypass consent gate');
    expect(sql).toContain('reconsent merchant cannot bypass consent gate');
    expect(sql).toContain('pending courier cannot bypass consent gate');
    expect(sql).toContain('reconsent courier cannot bypass consent gate');
  });
});
