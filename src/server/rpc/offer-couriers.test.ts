import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { getRequestOfferCouriersRpc } from './offer-couriers';

const requestId = '00000000-0000-4000-8000-0000000016e1';
const otherRequestId = '00000000-0000-4000-8000-0000000016e2';
const courierDoc2 = '00000000-0000-4000-8000-0000000016c2';
const courierDoc0 = '00000000-0000-4000-8000-0000000016c0';

const doc2 = {
  courierId: courierDoc2,
  displayName: 'Cadete Doc2',
  vehicleType: 'moto' as const,
  licenseStatus: 'verified' as const,
  insuranceStatus: 'verified' as const,
  docLevel: 2 as const,
};

const doc0 = {
  courierId: courierDoc0,
  displayName: 'Cadete Doc0',
  vehicleType: null,
  licenseStatus: 'none' as const,
  insuranceStatus: 'none' as const,
  docLevel: 0 as const,
};

describe('CC-016 — get_request_offer_couriers server boundary', () => {
  it('valida el input y llama a la RPC con nombre y argumentos exactos', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { requestId, couriers: [doc2, doc0] },
      error: null,
    });

    const result = await getRequestOfferCouriersRpc({ rpc }, { requestId });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('get_request_offer_couriers', {
      p_request_id: requestId,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.data.entries()]).toEqual([
        [courierDoc2, doc2],
        [courierDoc0, doc0],
      ]);
    }

    const badRpc = vi.fn();
    expect(await getRequestOfferCouriersRpc({ rpc: badRpc }, { requestId: 'bad' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(badRpc).not.toHaveBeenCalled();
  });

  it('preserva los códigos de dominio de la RPC', async () => {
    for (const code of ['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'NOT_FOUND'] as const) {
      const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: code } });
      expect(await getRequestOfferCouriersRpc({ rpc }, { requestId })).toEqual({ ok: false, code });
    }
  });

  it('un rechazo de permisos de Postgres se informa como UNAUTHORIZED_ACTOR y lo desconocido como INTERNAL_ERROR', async () => {
    const denied = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied for function' },
    });
    expect(await getRequestOfferCouriersRpc({ rpc: denied }, { requestId })).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    const unknown = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'OFFER_BELOW_MINIMUM' },
    });
    expect(await getRequestOfferCouriersRpc({ rpc: unknown }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    const thrown = vi.fn().mockRejectedValue(new Error('network'));
    expect(await getRequestOfferCouriersRpc({ rpc: thrown }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it.each([
    ['phone', '3865000002'],
    ['vehiclePlate', 'AA123BB'],
    ['dniHmac', 'ab'.repeat(32)],
    ['status', 'approved'],
  ])('rechaza la salida si la RPC devuelve el campo sensible %s', async (field, value) => {
    const rpc = vi.fn().mockResolvedValue({
      data: { requestId, couriers: [{ ...doc2, [field]: value }] },
      error: null,
    });
    expect(await getRequestOfferCouriersRpc({ rpc }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('rechaza una respuesta de otra solicitud y un docLevel fuera de 0..2', async () => {
    const foreign = vi.fn().mockResolvedValue({
      data: { requestId: otherRequestId, couriers: [doc2] },
      error: null,
    });
    expect(await getRequestOfferCouriersRpc({ rpc: foreign }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    const outOfRange = vi.fn().mockResolvedValue({
      data: { requestId, couriers: [{ ...doc2, docLevel: 3 }] },
      error: null,
    });
    expect(await getRequestOfferCouriersRpc({ rpc: outOfRange }, { requestId })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('no usa el cliente con service role: la autorización la decide la RPC con la sesión del comercio', () => {
    const source = readFileSync('src/server/rpc/offer-couriers.ts', 'utf8');
    expect(source).toContain("import 'server-only'");
    expect(source).not.toContain('supabase/admin');
  });
});
