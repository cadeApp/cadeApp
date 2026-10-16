import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { updateMyMerchantProfileRpc } from './merchants';

const profileId = '00000000-0000-4000-8000-000000000281';
const zoneId = '00000000-0000-4000-8000-000000000285';

const canonicalProfile = {
  profileId,
  businessName: 'Pizzería Don Yisus',
  phone: '3865112233',
  defaultPickupAddress: 'Av. Sarmiento 123',
  defaultPickupZoneId: zoneId,
  defaultPickupLat: -27.432,
  defaultPickupLng: -65.616,
  notes: 'Tocar timbre',
};

describe('CC-028 — update_my_merchant_profile server boundary', () => {
  it('valida el input y llama a la RPC con nombre y argumentos exactos', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: canonicalProfile, error: null });

    const patch = { businessName: 'Pizzería Don Yisus' };
    const result = await updateMyMerchantProfileRpc({ rpc }, patch);

    expect(result).toEqual({
      ok: true,
      data: canonicalProfile,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('update_my_merchant_profile', {
      p_patch: patch,
    });
  });

  it('rechaza input vacío o inválido sin llamar a la RPC', async () => {
    const badRpc = vi.fn();

    // Payload vacío
    expect(await updateMyMerchantProfileRpc({ rpc: badRpc }, {})).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    // Coordenadas asimétricas
    expect(
      await updateMyMerchantProfileRpc({ rpc: badRpc }, { defaultPickupLat: -27.432 })
    ).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    // Coordenadas fuera de Aguilares
    expect(
      await updateMyMerchantProfileRpc(
        { rpc: badRpc },
        { defaultPickupLat: -34.6, defaultPickupLng: -58.3 }
      )
    ).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });

    expect(badRpc).not.toHaveBeenCalled();
  });

  it('admite borrado explícito de pin y notas con null', async () => {
    const unpinnedProfile = {
      ...canonicalProfile,
      defaultPickupLat: null,
      defaultPickupLng: null,
      notes: null,
    };
    const rpc = vi.fn().mockResolvedValue({ data: unpinnedProfile, error: null });

    const patch = {
      defaultPickupLat: null,
      defaultPickupLng: null,
      notes: null,
    };
    const result = await updateMyMerchantProfileRpc({ rpc }, patch);

    expect(result).toEqual({
      ok: true,
      data: unpinnedProfile,
    });
    expect(rpc).toHaveBeenCalledExactlyOnceWith('update_my_merchant_profile', {
      p_patch: patch,
    });
  });

  it('preserva los códigos de dominio de la RPC', async () => {
    for (const code of [
      'UNAUTHENTICATED',
      'UNAUTHORIZED_ACTOR',
      'VALIDATION_ERROR',
      'OUT_OF_BOUNDS_AGUILARES',
      'NOT_FOUND',
    ] as const) {
      const rpc = vi
        .fn()
        .mockResolvedValue({ data: null, error: { code: 'P0001', message: code } });
      expect(
        await updateMyMerchantProfileRpc({ rpc }, { businessName: 'Nuevo Nombre' })
      ).toEqual({
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
    expect(
      await updateMyMerchantProfileRpc({ rpc: denied }, { businessName: 'Test' })
    ).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });

    const unknown = vi.fn().mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'OFFER_BELOW_MINIMUM' },
    });
    expect(
      await updateMyMerchantProfileRpc({ rpc: unknown }, { businessName: 'Test' })
    ).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });

    const thrown = vi.fn().mockRejectedValue(new Error('network'));
    expect(
      await updateMyMerchantProfileRpc({ rpc: thrown }, { businessName: 'Test' })
    ).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('no usa el cliente con service role: la autorización la decide la RPC con la sesión del comercio', () => {
    const source = readFileSync('src/server/rpc/merchants.ts', 'utf8');
    expect(source).toContain("import 'server-only'");
    expect(source).not.toContain('supabase/admin');
  });
});
