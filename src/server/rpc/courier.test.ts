import { describe, expect, it, vi } from 'vitest';
import * as courierRpc from './courier';
import {
  courierVehicleRpc,
  mapCourierVehicleRpcError,
  mapReplaceCourierDocumentRpcError,
  replaceCourierDocumentRpc,
} from './courier';
import type { SupabaseRpcCaller } from './admin';

describe('CC-025 — replaceCourierDocumentRpc', () => {
  it('valida el schema de entrada y rechaza payload inválido', async () => {
    const caller: SupabaseRpcCaller = {
      async rpc() {
        return { data: null, error: null };
      },
    };

    const res = await replaceCourierDocumentRpc(caller, {
      kind: 'invalid_kind',
      storagePath: '',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('VALIDATION_ERROR');
    }
  });

  it('mapea errores de Postgres conocidos', () => {
    expect(
      mapReplaceCourierDocumentRpcError({ message: 'UNAUTHENTICATED' }),
    ).toBe('UNAUTHENTICATED');
    expect(
      mapReplaceCourierDocumentRpcError({ message: 'UNAUTHORIZED_ACTOR' }),
    ).toBe('UNAUTHORIZED_ACTOR');
    expect(
      mapReplaceCourierDocumentRpcError({ message: 'NOT_FOUND' }),
    ).toBe('NOT_FOUND');
    expect(
      mapReplaceCourierDocumentRpcError({ message: 'details: NOT_FOUND in table' }),
    ).toBe('NOT_FOUND');
    expect(
      mapReplaceCourierDocumentRpcError({ message: 'INVALID_STATE_TRANSITION' }),
    ).toBe('INVALID_STATE_TRANSITION');
    expect(
      mapReplaceCourierDocumentRpcError({ message: 'VALIDATION_ERROR' }),
    ).toBe('VALIDATION_ERROR');
    expect(
      mapReplaceCourierDocumentRpcError({
        code: '42501',
        message: 'permission denied',
      }),
    ).toBe('UNAUTHORIZED_ACTOR');
    expect(
      mapReplaceCourierDocumentRpcError({
        message: 'CONSENT_REQUIRED',
      }),
    ).toBe('UNAUTHORIZED_ACTOR');
    expect(
      mapReplaceCourierDocumentRpcError({ message: 'unexpected database failure' }),
    ).toBe('INTERNAL_ERROR');
  });

  it('invoca la RPC y devuelve resultado exitoso con idempotencyKey opcional', async () => {
    const caller: SupabaseRpcCaller = {
      async rpc(fn, args) {
        expect(fn).toBe('replace_courier_document');
        expect(args).toEqual({
          p_payload: {
            kind: 'license',
            storagePath:
              'courier/00000000-0000-4000-8000-0000000000c1/license_123.jpg',
            idempotencyKey: '00000000-0000-4000-8000-0000000000e1',
          },
        });
        return {
          data: {
            documentId: '00000000-0000-4000-8000-0000000000d2',
            kind: 'license',
            status: 'submitted',
            replacedDocumentId: '00000000-0000-4000-8000-0000000000d1',
            isCurrent: true,
            idempotent: false,
          },
          error: null,
        };
      },
    };

    const res = await replaceCourierDocumentRpc(caller, {
      kind: 'license',
      storagePath:
        'courier/00000000-0000-4000-8000-0000000000c1/license_123.jpg',
      idempotencyKey: '00000000-0000-4000-8000-0000000000e1',
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.status).toBe('submitted');
    expect(res.data.isCurrent).toBe(true);
    expect(res.data.replacedDocumentId).toBe(
      '00000000-0000-4000-8000-0000000000d1',
    );
  });

  it('devuelve error si client.rpc retorna un error de Postgres', async () => {
    const caller: SupabaseRpcCaller = {
      async rpc() {
        return {
          data: null,
          error: { message: 'NOT_FOUND' },
        };
      },
    };

    const res = await replaceCourierDocumentRpc(caller, {
      kind: 'license',
      storagePath: 'courier/00000000-0000-4000-8000-0000000000c1/license_1.jpg',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('NOT_FOUND');
    }
  });

  it('devuelve INTERNAL_ERROR si la salida no cumple el esquema o la llamada lanza excepción', async () => {
    const malformedCaller: SupabaseRpcCaller = {
      async rpc() {
        return {
          data: { invalid: true },
          error: null,
        };
      },
    };

    const resMalformed = await replaceCourierDocumentRpc(malformedCaller, {
      kind: 'license',
      storagePath: 'courier/00000000-0000-4000-8000-0000000000c1/license_1.jpg',
    });
    expect(resMalformed.ok).toBe(false);
    if (!resMalformed.ok) {
      expect(resMalformed.code).toBe('INTERNAL_ERROR');
    }

    const throwingCaller: SupabaseRpcCaller = {
      async rpc() {
        throw new Error('network dead');
      },
    };

    const resThrowing = await replaceCourierDocumentRpc(throwingCaller, {
      kind: 'license',
      storagePath: 'courier/00000000-0000-4000-8000-0000000000c1/license_1.jpg',
    });
    expect(resThrowing.ok).toBe(false);
    if (!resThrowing.ok) {
      expect(resThrowing.code).toBe('INTERNAL_ERROR');
    }
  });
});

describe('CC-033 — addCourierOptionalDocumentRpc', () => {
  const storagePath = 'courier/00000000-0000-4000-8000-0000000000c1/insurance_123.jpg';

  function invokeAddOptionalDocument(
    caller: SupabaseRpcCaller,
    rawInput: unknown,
  ): Promise<unknown> {
    const candidate = courierRpc as Record<string, unknown>;
    return (candidate.addCourierOptionalDocumentRpc as (
      rpcCaller: SupabaseRpcCaller,
      input: unknown,
    ) => Promise<unknown>)(caller, rawInput);
  }

  it('expone el wrapper tipado para la RPC nueva', () => {
    expect(courierRpc).toHaveProperty('addCourierOptionalDocumentRpc');
  });

  it('rechaza entrada inválida antes de llamar a Supabase', async () => {
    let calls = 0;
    const caller: SupabaseRpcCaller = {
      async rpc() {
        calls += 1;
        throw new Error('no debe invocarse');
      },
    };

    await expect(
      invokeAddOptionalDocument(caller, { kind: 'dni_front', storagePath: '' }),
    ).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
    expect(calls).toBe(0);
  });

  it.each([
    'UNAUTHENTICATED',
    'UNAUTHORIZED_ACTOR',
    'NOT_FOUND',
    'INVALID_STATE_TRANSITION',
    'VALIDATION_ERROR',
  ])('preserva el código público %s devuelto por Postgres', async (code) => {
    const caller: SupabaseRpcCaller = {
      async rpc() {
        return { data: null, error: { message: code } };
      },
    };

    await expect(
      invokeAddOptionalDocument(caller, { kind: 'insurance', storagePath }),
    ).resolves.toMatchObject({ ok: false, code });
  });

  it('devuelve la salida válida de una alta nueva', async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
    const caller: SupabaseRpcCaller = {
      async rpc(fn, args) {
        calls.push({ fn, args });
        return {
          data: {
            documentId: '00000000-0000-4000-8000-0000000000d1',
            kind: 'insurance',
            status: 'submitted',
            isCurrent: true,
            idempotent: false,
          },
          error: null,
        };
      },
    };

    await expect(
      invokeAddOptionalDocument(caller, { kind: 'insurance', storagePath }),
    ).resolves.toMatchObject({
      ok: true,
      data: { kind: 'insurance', status: 'submitted', idempotent: false },
    });
    expect(calls).toEqual([
      {
        fn: 'add_courier_optional_document',
        args: { p_payload: { kind: 'insurance', storagePath } },
      },
    ]);
  });

  it('preserva una idempotencyKey válida en el payload exacto de PostgREST', async () => {
    const idempotencyKey = '00000000-0000-4000-8000-0000000000d2';
    const calls: Array<{ fn: string; args: Record<string, unknown> | undefined }> = [];
    const caller: SupabaseRpcCaller = {
      async rpc(fn, args) {
        calls.push({ fn, args });
        return {
          data: {
            documentId: '00000000-0000-4000-8000-0000000000d1',
            kind: 'insurance',
            status: 'submitted',
            isCurrent: true,
            idempotent: false,
          },
          error: null,
        };
      },
    };

    await expect(
      invokeAddOptionalDocument(caller, { kind: 'insurance', storagePath, idempotencyKey }),
    ).resolves.toMatchObject({ ok: true });
    expect(calls).toEqual([
      {
        fn: 'add_courier_optional_document',
        args: { p_payload: { kind: 'insurance', storagePath, idempotencyKey } },
      },
    ]);
  });

  it.each([
    { response: { data: { documentId: 'not-a-uuid' }, error: null }, label: 'salida malformada' },
    { response: new Error('red caída'), label: 'excepción del cliente' },
  ])('convierte %s en INTERNAL_ERROR', async ({ response }) => {
    const caller: SupabaseRpcCaller = {
      async rpc() {
        if (response instanceof Error) throw response;
        return response;
      },
    };

    await expect(
      invokeAddOptionalDocument(caller, { kind: 'insurance', storagePath }),
    ).resolves.toMatchObject({ ok: false, code: 'INTERNAL_ERROR' });
  });
});

describe('CC-042: courierVehicleRpc', () => {
  const VEHICLE = 'c0000000-0000-4000-8000-000000000042';

  it('arma los argumentos de cada RPC de vehículos y valida la salida', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { vehicleId: VEHICLE }, error: null });
    expect(await courierVehicleRpc({ rpc }, 'add_courier_vehicle', { vehicleType: 'bike', plate: null })).toEqual({
      ok: true,
      data: { vehicleId: VEHICLE },
    });
    expect(rpc).toHaveBeenLastCalledWith('add_courier_vehicle', { p_vehicle_type: 'bike', p_plate: null, p_make_active: false });

    await courierVehicleRpc({ rpc }, 'update_courier_vehicle', { vehicleId: VEHICLE, plate: 'AB 123 CD' });
    expect(rpc).toHaveBeenLastCalledWith('update_courier_vehicle', { p_vehicle_id: VEHICLE, p_plate: 'AB 123 CD' });

    rpc.mockResolvedValueOnce({ data: { vehicleId: 'no-es-uuid' }, error: null });
    expect(await courierVehicleRpc({ rpc }, 'remove_courier_vehicle', { vehicleId: VEHICLE })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it('mapea los errores del contrato y rechaza la entrada inválida sin llamar a la RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'P0001', message: 'VEHICLE_SWITCH_BLOCKED' } });
    expect(await courierVehicleRpc({ rpc }, 'set_active_courier_vehicle', { vehicleId: VEHICLE })).toEqual({
      ok: false,
      code: 'VEHICLE_SWITCH_BLOCKED',
    });
    expect(mapCourierVehicleRpcError('remove_courier_vehicle', { code: '42501', message: 'permission denied' })).toBe(
      'UNAUTHORIZED_ACTOR'
    );
    expect(mapCourierVehicleRpcError('get_my_courier_vehicles', { code: 'XX000', message: 'boom' })).toBe('INTERNAL_ERROR');

    const untouched = vi.fn();
    expect(await courierVehicleRpc({ rpc: untouched }, 'set_active_courier_vehicle', { vehicleId: 'x' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(untouched).not.toHaveBeenCalled();
  });
});

describe('CC-052 — resubmitCourierRequiredDocumentRpc', () => {
  const COURIER = '20000000-0000-4000-8000-0000000052c2';
  const input = {
    kind: 'selfie',
    storagePath: `courier/${COURIER}/selfie_1730000000001.png`,
    idempotencyKey: '00000000-0000-4000-8000-000000005201',
  };

  it('rechaza un opcional o sin clave antes de llamar a la RPC', async () => {
    const rpc = vi.fn();
    const caller = { rpc } as unknown as SupabaseRpcCaller;
    expect(await courierRpc.resubmitCourierRequiredDocumentRpc(caller, { ...input, kind: 'license' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(
      await courierRpc.resubmitCourierRequiredDocumentRpc(caller, { kind: input.kind, storagePath: input.storagePath })
    ).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('llama a la RPC con el payload validado y parsea la salida', async () => {
    const data = {
      documentId: '00000000-0000-4000-8000-0000000052d1',
      kind: 'selfie',
      status: 'submitted',
      replacedDocumentId: null,
      idempotent: false,
    };
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    const result = await courierRpc.resubmitCourierRequiredDocumentRpc({ rpc } as unknown as SupabaseRpcCaller, input);
    expect(rpc).toHaveBeenCalledWith('resubmit_courier_required_document', { p_payload: input });
    expect(result).toEqual({ ok: true, data });
  });

  it('mapea los códigos de la RPC y lo desconocido a INTERNAL_ERROR', () => {
    for (const code of ['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'NOT_FOUND', 'INVALID_STATE_TRANSITION', 'VALIDATION_ERROR']) {
      expect(courierRpc.mapResubmitCourierRequiredDocumentRpcError({ message: code })).toBe(code);
    }
    expect(courierRpc.mapResubmitCourierRequiredDocumentRpcError({ message: 'permission denied', code: '42501' })).toBe(
      'UNAUTHORIZED_ACTOR'
    );
    expect(courierRpc.mapResubmitCourierRequiredDocumentRpcError({ message: 'boom' })).toBe('INTERNAL_ERROR');
  });

  it('una salida con un campo inválido es INTERNAL_ERROR', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { documentId: 'x' }, error: null });
    expect(await courierRpc.resubmitCourierRequiredDocumentRpc({ rpc } as unknown as SupabaseRpcCaller, input)).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });
});
