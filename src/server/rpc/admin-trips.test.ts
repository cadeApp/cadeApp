import { describe, expect, it, vi } from 'vitest';
import type { SupabaseRpcCaller } from './admin';
import { adminListTripsRpc, mapAdminListTripsError } from './admin-trips';

vi.mock('server-only', () => ({}));

const ITEM = {
  id: '00000000-0000-4000-8000-000000370001',
  code: 'REQ-00000000',
  status: 'delivered',
  createdAt: '2026-10-22T03:00:00.000000Z',
  publishedAt: '2026-10-22T03:00:00.000000Z',
  deliveredAt: '2026-10-22T04:00:00.000000Z',
  cancelledAt: null,
  merchantId: '00000000-0000-4000-8000-0000000370b1',
  merchantName: 'Comercio',
  courierId: null,
  courierName: null,
  dropsCount: 2,
  deliveredDrops: 1,
  failedDrops: 1,
  courierReleases: 0,
  noShowReports: 0,
  cancelled: false,
  incidents: 0,
  openIncidents: 0,
};

function caller(response: { data: unknown; error: { code?: string; message: string } | null }) {
  const calls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
  const client: SupabaseRpcCaller = {
    async rpc(fn, args) {
      calls.push({ fn, args });
      return response;
    },
  };
  return { client, calls };
}

describe('CC-037: adminListTripsRpc', () => {
  it('envía el filtro, el cursor compuesto y el límite con los nombres de la RPC', async () => {
    const { client, calls } = caller({ data: { items: [ITEM], nextCursor: null }, error: null });

    const result = await adminListTripsRpc(client, {
      filter: 'problems',
      cursor: { createdAt: '2026-10-22T03:00:00.123456Z', id: ITEM.id },
      limit: 20,
    });

    expect(result).toEqual({ ok: true, data: { items: [ITEM], nextCursor: null } });
    expect(calls).toEqual([
      {
        fn: 'admin_list_trips',
        args: {
          p_filter: 'problems',
          p_cursor_created_at: '2026-10-22T03:00:00.123456Z',
          p_cursor_id: ITEM.id,
          p_limit: 20,
        },
      },
    ]);
  });

  it('sin cursor ni límite manda null', async () => {
    const { client, calls } = caller({ data: { items: [], nextCursor: null }, error: null });

    await adminListTripsRpc(client, { filter: 'all' });

    expect(calls[0]?.args).toEqual({
      p_filter: 'all',
      p_cursor_created_at: null,
      p_cursor_id: null,
      p_limit: null,
    });
  });

  it('una entrada inválida no llama a la base', async () => {
    const { client, calls } = caller({ data: null, error: null });

    expect(await adminListTripsRpc(client, { filter: 'open' })).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(calls).toHaveLength(0);
  });

  it('mapea los errores del contrato y deja lo desconocido como INTERNAL_ERROR', async () => {
    for (const code of ['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'AAL2_REQUIRED', 'VALIDATION_ERROR'] as const) {
      const { client } = caller({ data: null, error: { code: 'P0001', message: code } });
      expect(await adminListTripsRpc(client, { filter: 'all' })).toEqual({ ok: false, code });
    }
    expect(mapAdminListTripsError({ code: '42501', message: 'permission denied for function' })).toBe(
      'UNAUTHORIZED_ACTOR'
    );
    expect(mapAdminListTripsError({ code: 'XX000', message: 'boom' })).toBe('INTERNAL_ERROR');
    expect(mapAdminListTripsError({ code: 'P0001', message: 'NOT_A_CONTRACT_CODE' })).toBe('INTERNAL_ERROR');
  });

  it('una salida que no cumple el contrato (por ejemplo con datos del destinatario) es INTERNAL_ERROR', async () => {
    const { client } = caller({
      data: { items: [{ ...ITEM, recipientPhone: '3865000000' }], nextCursor: null },
      error: null,
    });

    expect(await adminListTripsRpc(client, { filter: 'all' })).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });
});
