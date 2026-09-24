import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { RPC_CONTRACTS } from '@/domain';
import { callRequestRpc, createRequestsRpcServerClient } from './requests';

const requestId = '10300000-0000-4000-8000-000000000020';
const offerId = '10300000-0000-4000-8000-000000000030';
const time = '2026-09-23T18:00:00.000Z';
const cases = [
  {
    name: 'publish_request',
    input: { requestId },
    args: { p_request_id: requestId },
    output: {
      requestId,
      status: 'published',
      publishedAt: time,
      expiresAt: time,
      routeDistanceM: 2000,
    },
  },
  {
    name: 'cancel_request',
    input: { requestId },
    args: { p_request_id: requestId, p_reason: null },
    output: { requestId, status: 'cancelled', cancelledAt: time },
  },
  {
    name: 'mark_picked_up',
    input: { requestId },
    args: { p_request_id: requestId },
    output: { requestId, status: 'in_transit', pickedUpAt: time },
  },
  {
    name: 'mark_delivered',
    input: { requestId },
    args: { p_request_id: requestId },
    output: { requestId, status: 'delivered', deliveredAt: time },
  },
  {
    name: 'report_no_show',
    input: { requestId },
    args: { p_request_id: requestId, p_republish: true },
    output: { requestId, status: 'published', cancelledOfferId: offerId, expiresAt: time },
  },
  {
    name: 'courier_cancel_match',
    input: { requestId, reason: '  Pinchadura  ' },
    args: { p_request_id: requestId, p_reason: 'Pinchadura' },
    output: { requestId, status: 'published', cancelledOfferId: offerId, expiresAt: time },
  },
  {
    name: 'republish_request',
    input: { requestId },
    args: { p_request_id: requestId, p_reason: null },
    output: { requestId, status: 'published', publishedAt: time, expiresAt: time },
  },
  {
    name: 'report_incident',
    input: { requestId, kind: ' demora ', description: ' Demora de prueba ' },
    args: { p_request_id: requestId, p_kind: 'demora', p_description: 'Demora de prueba' },
    output: { requestId, incidentId: offerId, status: 'open', createdAt: time },
  },
] as const;

describe('T-103 — Wrapper de RPC de solicitudes', () => {
  it('la matriz pgTAP contrasta los errores reales con los contratos vigentes', () => {
    const sql = readFileSync('supabase/tests/rpc_requests.sql', 'utf8');
    for (const c of cases) {
      const declaration = sql.match(new RegExp(`\\('${c.name}', array\\[([^\\]]+)\\]\\)`));
      expect(declaration, c.name).not.toBeNull();
      const codes = [...(declaration?.[1] ?? '').matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
      expect(codes.sort(), c.name).toEqual([...RPC_CONTRACTS[c.name].errorCodes].sort());
    }
    expect(sql).toContain("result->>'error' = any");
  });
  for (const c of cases) {
    it(`${c.name}: valida, convierte los argumentos y parsea la respuesta`, async () => {
      const rpc = vi.fn().mockResolvedValue({ data: c.output, error: null });
      expect(await callRequestRpc({ rpc }, c.name, c.input)).toEqual({ ok: true, data: c.output });
      expect(rpc).toHaveBeenCalledExactlyOnceWith(c.name, c.args);
    });

    it(`${c.name}: entrada inválida no llega a la base`, async () => {
      const rpc = vi.fn();
      expect(await callRequestRpc({ rpc }, c.name, { requestId: 'bad' })).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
      });
      expect(rpc).not.toHaveBeenCalled();
    });

    it(`${c.name}: preserva todos los códigos declarados`, async () => {
      for (const code of RPC_CONTRACTS[c.name].errorCodes) {
        const rpc = vi
          .fn()
          .mockResolvedValue({ data: null, error: { code: 'P0001', message: code } });
        expect(await callRequestRpc({ rpc }, c.name, c.input)).toEqual({ ok: false, code });
      }
    });

    it(`${c.name}: respuestas inválidas, errores inesperados y fallos de red son INTERNAL_ERROR`, async () => {
      for (const response of [
        { data: { requestId, status: 'not-a-status' }, error: null },
        { data: null, error: null },
        {
          data: null,
          error: { code: 'XX000', message: 'UNAUTHORIZED_ACTOR inside an unexpected error' },
        },
        { data: null, error: { code: 'P0001', message: 'NOT_A_DOMAIN_ERROR' } },
      ]) {
        const rpc = vi.fn().mockResolvedValue(response);
        expect(await callRequestRpc({ rpc }, c.name, c.input)).toEqual({
          ok: false,
          code: 'INTERNAL_ERROR',
        });
      }
      const rpc = vi.fn().mockRejectedValue(new Error('Network failure'));
      expect(await callRequestRpc({ rpc }, c.name, c.input)).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
      });
    });
  }

  it('report_no_show conserva false y el cliente implementa las ocho RPC del contrato', async () => {
    const output = { requestId, status: 'cancelled', cancelledOfferId: offerId, expiresAt: null };
    const rpc = vi.fn().mockResolvedValue({ data: output, error: null });
    const client = createRequestsRpcServerClient({ rpc });
    expect(Object.keys(client).sort()).toEqual(cases.map((c) => c.name).sort());
    expect(await client.report_no_show({ requestId, republish: false })).toEqual({
      ok: true,
      data: output,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('report_no_show', {
      p_request_id: requestId,
      p_republish: false,
    });
  });
});
