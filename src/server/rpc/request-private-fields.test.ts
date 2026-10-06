import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getMerchantRequestPrivateFieldsRpc } from './request-private-fields';

const requestId = '00000000-0000-4000-8000-0000000023e1';
const otherRequestId = '00000000-0000-4000-8000-0000000023e2';

const privateFields = { requestId, notes: 'Tocar timbre 2B', cashChangeAmount: 5000 };

describe('CC-023 — get_merchant_request_private_fields server boundary', () => {
  it('valida el input y llama a la RPC con nombre y argumentos exactos', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: privateFields, error: null });

    expect(await getMerchantRequestPrivateFieldsRpc({ rpc }, { requestId })).toEqual({
      ok: true,
      data: privateFields,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_merchant_request_private_fields', {
      p_request_id: requestId,
    });

    const badRpc = vi.fn();
    expect(await getMerchantRequestPrivateFieldsRpc({ rpc: badRpc }, { requestId: 'bad' })).toEqual(
      { ok: false, code: 'VALIDATION_ERROR' }
    );
    expect(badRpc).not.toHaveBeenCalled();
  });

  it('devuelve los null explícitos de una solicitud sin indicaciones ni cambio', async () => {
    const empty = { requestId, notes: null, cashChangeAmount: null };
    const rpc = vi.fn().mockResolvedValue({ data: empty, error: null });

    expect(await getMerchantRequestPrivateFieldsRpc({ rpc }, { requestId })).toEqual({
      ok: true,
      data: empty,
    });
  });

  it('preserva los códigos de dominio de la RPC', async () => {
    for (const code of [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'NOT_FOUND',
      'VALIDATION_ERROR',
    ] as const) {
      const rpc = vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: 'P0001', message: code } });
      expect(await getMerchantRequestPrivateFieldsRpc({ rpc }, { requestId })).toEqual({
        ok: false,
        code,
      });
    }
  });

  it('un rechazo de permisos de Postgres se informa como UNAUTHORIZED_ACTOR y lo desconocido como INTERNAL_ERROR', async () => {
    const denied = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied for function' },
    });
    expect(await getMerchantRequestPrivateFieldsRpc({ rpc: denied }, { requestId })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    const unknown = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'OFFER_BELOW_MINIMUM' },
    });
    expect(await getMerchantRequestPrivateFieldsRpc({ rpc: unknown }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    const thrown = vi.fn().mockRejectedValue(new Error('network'));
    expect(await getMerchantRequestPrivateFieldsRpc({ rpc: thrown }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('rechaza una salida de otra solicitud, con campos de más o con un monto inválido', async () => {
    for (const data of [
      { ...privateFields, requestId: otherRequestId },
      { ...privateFields, recipientPhone: '3865000000' },
      { ...privateFields, cashChangeAmount: 0 },
      { requestId, notes: 'sin monto' },
      null,
    ]) {
      const rpc = vi.fn().mockResolvedValue({ data, error: null });
      expect(await getMerchantRequestPrivateFieldsRpc({ rpc }, { requestId })).toEqual({
        ok: false,
        code: 'INTERNAL_ERROR',
      });
    }
  });

  it('no usa el cliente con service role: la autorización la decide la RPC con la sesión del comercio', () => {
    const source = readFileSync('src/server/rpc/request-private-fields.ts', 'utf8');
    expect(source).toContain("import 'server-only'");
    expect(source).not.toContain('supabase/admin');
  });
});
