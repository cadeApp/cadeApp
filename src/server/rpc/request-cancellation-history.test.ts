import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getRequestCancellationHistoryRpc } from './request-cancellation-history';

const requestId = '00000000-0000-4000-8000-0000000032e1';
const otherRequestId = '00000000-0000-4000-8000-0000000032e2';
const eventId = '00000000-0000-4000-8000-0000000032a1';
const courierId = '00000000-0000-4000-8000-0000000032c1';
const offerId = '00000000-0000-4000-8000-0000000032d1';
const cursor = { beforeCreatedAt: '2026-10-18T20:30:00.123456+00:00', beforeId: eventId };

const event = {
  id: eventId,
  action: 'courier_cancel_match',
  actionLabel: 'Cancelado por el repartidor',
  category: 'vehicle_breakdown',
  categoryLabel: 'Problema con el vehículo',
  createdAt: '2026-10-18T20:30:00.123456+00:00',
  actor: { id: courierId, role: 'courier', displayName: 'Juan P.' },
  offerId,
  rawReason: null,
};

const history = {
  version: '1.0',
  requestId,
  events: [event],
  pagination: { limit: 1, hasMore: true, nextCursor: cursor },
};

describe('CC-032 — get_request_cancellation_history server boundary', () => {
  it('valida el input y llama a la RPC con nombre y argumentos exactos', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: history, error: null });

    expect(await getRequestCancellationHistoryRpc({ rpc }, { requestId, limit: 1, cursor })).toEqual({
      ok: true,
      data: history,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_request_cancellation_history', {
      p_request_id: requestId,
      p_limit: 1,
      p_before_created_at: cursor.beforeCreatedAt,
      p_before_id: cursor.beforeId,
    });
  });

  it('sin límite ni cursor manda null y la RPC aplica su default', async () => {
    const empty = {
      version: '1.0',
      requestId,
      events: [],
      pagination: { limit: 50, hasMore: false, nextCursor: null },
    };
    const rpc = vi.fn().mockResolvedValue({ data: empty, error: null });

    expect(await getRequestCancellationHistoryRpc({ rpc }, { requestId })).toEqual({ ok: true, data: empty });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_request_cancellation_history', {
      p_request_id: requestId,
      p_limit: null,
      p_before_created_at: null,
      p_before_id: null,
    });
  });

  it('rechaza sin llamar a la RPC un id inválido, un límite fuera de rango o un cursor incompleto', async () => {
    for (const input of [
      { requestId: 'bad' },
      { requestId, limit: 0 },
      { requestId, limit: 101 },
      { requestId, limit: 1.5 },
      { requestId, cursor: { beforeCreatedAt: cursor.beforeCreatedAt } },
      { requestId, cursor: { beforeId: eventId } },
      { requestId, cursor: { ...cursor, beforeCreatedAt: 'ayer' } },
    ]) {
      const rpc = vi.fn();
      expect(await getRequestCancellationHistoryRpc({ rpc }, input)).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
      });
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it('acepta un actor null y una oferta null (perfil u oferta borrados)', async () => {
    const orphan = {
      ...history,
      events: [{ ...event, actor: null, offerId: null }],
      pagination: { limit: 50, hasMore: false, nextCursor: null },
    };
    const rpc = vi.fn().mockResolvedValue({ data: orphan, error: null });
    expect(await getRequestCancellationHistoryRpc({ rpc }, { requestId })).toEqual({ ok: true, data: orphan });
  });

  it('preserva los códigos de dominio de la RPC', async () => {
    for (const code of ['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'NOT_FOUND', 'VALIDATION_ERROR'] as const) {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: code } });
      expect(await getRequestCancellationHistoryRpc({ rpc }, { requestId })).toEqual({ ok: false, code });
    }
  });

  it('un rechazo de permisos de Postgres se informa como UNAUTHORIZED_ACTOR y lo desconocido como INTERNAL_ERROR', async () => {
    const denied = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied for function get_request_cancellation_history' },
    });
    expect(await getRequestCancellationHistoryRpc({ rpc: denied }, { requestId })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    const unknown = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'OFFER_BELOW_MINIMUM' },
    });
    expect(await getRequestCancellationHistoryRpc({ rpc: unknown }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    const thrown = vi.fn().mockRejectedValue(new Error('network'));
    expect(await getRequestCancellationHistoryRpc({ rpc: thrown }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('rechaza una salida de otro pedido, con campos de más o que viola el contrato', async () => {
    for (const data of [
      { ...history, requestId: otherRequestId },
      { ...history, events: [{ ...event, recipientPhone: '3865000000' }] },
      { ...history, events: [{ ...event, action: 'cancel_request' }] },
      { ...history, events: [{ ...event, category: 'moto_rota' }] },
      { ...history, events: [{ ...event, categoryLabel: 'Otro motivo' }] },
      { ...history, events: [{ ...event, actor: { ...event.actor, role: 'merchant' } }] },
      { ...history, version: '2.0' },
      { ...history, pagination: { limit: 1, hasMore: false, nextCursor: cursor } },
      { ...history, pagination: { limit: 1, hasMore: true, nextCursor: null } },
      null,
    ]) {
      const rpc = vi.fn().mockResolvedValue({ data, error: null });
      expect(await getRequestCancellationHistoryRpc({ rpc }, { requestId })).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
      });
    }
  });

  it('no usa el cliente con service role: la autorización la decide la RPC con la sesión del usuario', () => {
    const source = readFileSync('src/server/rpc/request-cancellation-history.ts', 'utf8');
    expect(source).toContain("import 'server-only'");
    expect(source).not.toContain('supabase/admin');
  });
});
