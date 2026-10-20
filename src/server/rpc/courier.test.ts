import { describe, expect, it } from 'vitest';
import * as courierRpc from './courier';
import {
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
    const caller: SupabaseRpcCaller = {
      async rpc() {
        throw new Error('no debe invocarse');
      },
    };

    await expect(
      invokeAddOptionalDocument(caller, { kind: 'dni_front', storagePath: '' }),
    ).resolves.toMatchObject({ ok: false, code: 'VALIDATION_ERROR' });
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
    const caller: SupabaseRpcCaller = {
      async rpc() {
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
  });
});
