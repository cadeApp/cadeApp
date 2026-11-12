import { describe, expect, it, vi } from 'vitest';
import type { SupabaseRpcCaller } from './admin';
import {
  adminFindCourierDisputeCandidatesRpc,
  adminFindCourierDniReservationRpc,
  adminListApplicantsRpc,
  mapAdminListApplicantsError,
} from './admin-applicants';

vi.mock('server-only', () => ({}));

const ITEM = {
  id: '00000000-0000-4000-8000-000000440001',
  displayName: 'José Pérez',
  phone: '+549386500441',
  vehicleType: 'bike',
  status: 'pending',
  hasDni: true,
  docLevel: 0,
  licenseStatus: 'none',
  insuranceStatus: 'none',
  createdAt: '2026-11-04T12:00:00.000000Z',
  submittedAt: null,
  documents: { dniFront: true, dniBack: true, selfie: true, license: false, insurance: false },
};
const PAGE = { items: [ITEM], total: 1, nextCursor: null, prevCursor: null };

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

describe('CC-044: adminListApplicantsRpc', () => {
  it('envía estado, búsqueda, cursor, dirección y límite con los nombres de la RPC', async () => {
    const { client, calls } = caller({ data: PAGE, error: null });

    const result = await adminListApplicantsRpc(client, {
      status: 'pending',
      query: '  jose ',
      cursor: { createdAt: '2026-11-04T12:00:00.123456Z', id: ITEM.id },
      direction: 'prev',
      limit: 20,
    });

    expect(result).toEqual({ ok: true, data: PAGE });
    expect(calls).toEqual([
      {
        fn: 'admin_list_applicants',
        args: {
          p_status: 'pending',
          p_query: 'jose',
          p_cursor_created_at: '2026-11-04T12:00:00.123456Z',
          p_cursor_id: ITEM.id,
          p_direction: 'prev',
          p_limit: 20,
        },
      },
    ]);
  });

  it('sin búsqueda, cursor ni límite manda null y la dirección next', async () => {
    const { client, calls } = caller({ data: PAGE, error: null });

    await adminListApplicantsRpc(client, { status: 'approved', query: '   ' });

    expect(calls[0]?.args).toEqual({
      p_status: 'approved',
      p_query: null,
      p_cursor_created_at: null,
      p_cursor_id: null,
      p_direction: 'next',
      p_limit: null,
    });
  });

  it('una entrada inválida no llama a la base', async () => {
    const { client, calls } = caller({ data: null, error: null });

    expect(await adminListApplicantsRpc(client, { status: 'draft' })).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(await adminListApplicantsRpc(client, { status: 'pending', direction: 'prev' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(await adminListApplicantsRpc(client, { status: 'pending', query: 'a'.repeat(81) })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(calls).toHaveLength(0);
  });

  it('mapea los errores del contrato y deja lo desconocido como INTERNAL_ERROR', async () => {
    for (const code of ['UNAUTHENTICATED', 'UNAUTHORIZED_ACTOR', 'AAL2_REQUIRED', 'VALIDATION_ERROR'] as const) {
      const { client } = caller({ data: null, error: { code: 'P0001', message: code } });
      expect(await adminListApplicantsRpc(client, { status: 'pending' })).toEqual({ ok: false, code });
    }
    expect(mapAdminListApplicantsError({ code: '42501', message: 'permission denied for function' })).toBe(
      'UNAUTHORIZED_ACTOR'
    );
    expect(mapAdminListApplicantsError({ code: 'XX000', message: 'boom' })).toBe('INTERNAL_ERROR');
    expect(mapAdminListApplicantsError({ code: 'P0001', message: 'NOT_A_CONTRACT_CODE' })).toBe('INTERNAL_ERROR');
  });

  it('una salida que no cumple el contrato (por ejemplo con el hash del DNI) es INTERNAL_ERROR', async () => {
    const { client } = caller({
      data: { ...PAGE, items: [{ ...ITEM, dniHmac: 'ab'.repeat(32) }] },
      error: null,
    });

    expect(await adminListApplicantsRpc(client, { status: 'pending' })).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
  });
});

describe('CC-050: adminFindCourierDisputeCandidatesRpc', () => {
  const CANDIDATES = {
    candidates: [
      {
        courierId: '00000000-0000-4000-8000-000000500001',
        displayName: 'Titular Real',
        phoneMasked: '•••• 1234',
        status: 'pending',
        applicationSubmitted: false,
        documentsCount: 4,
      },
    ],
  };

  it('manda p_lookup recortado y devuelve el objeto candidates', async () => {
    const { client, calls } = caller({ data: CANDIDATES, error: null });
    expect(await adminFindCourierDisputeCandidatesRpc(client, { lookup: ' +54 (381) 555-1234 ' })).toEqual({
      ok: true,
      data: CANDIDATES,
    });
    expect(calls).toEqual([
      { fn: 'admin_find_courier_dispute_candidates', args: { p_lookup: '+54 (381) 555-1234' } },
    ]);
  });

  it('una búsqueda inválida no llama a la RPC', async () => {
    const { client, calls } = caller({ data: CANDIDATES, error: null });
    for (const lookup of ['', 'juan', 'foo3815551234', '%3815551234']) {
      expect(await adminFindCourierDisputeCandidatesRpc(client, { lookup })).toEqual({
        ok: false,
        code: 'VALIDATION_ERROR',
      });
    }
    expect(calls).toEqual([]);
  });

  it('un array en la raíz es INTERNAL_ERROR', async () => {
    const { client } = caller({ data: CANDIDATES.candidates, error: null });
    expect(await adminFindCourierDisputeCandidatesRpc(client, { lookup: '3815551234' })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it.each(['AAL2_REQUIRED', 'UNAUTHORIZED_ACTOR', 'VALIDATION_ERROR'])('mapea %s', async (message) => {
    const { client } = caller({ data: null, error: { code: 'P0001', message } });
    expect(await adminFindCourierDisputeCandidatesRpc(client, { lookup: '3815551234' })).toEqual({
      ok: false,
      code: message,
    });
  });
});

describe('CC-050 (PR711-H03): adminFindCourierDniReservationRpc', () => {
  const HMAC = 'ab'.repeat(32);
  const RESERVATION = { reservation: { courierId: '00000000-0000-4000-8000-000000500002', status: 'rejected' } };

  it('manda p_dni_hmac y devuelve solo cuenta y estado', async () => {
    const { client, calls } = caller({ data: RESERVATION, error: null });
    expect(await adminFindCourierDniReservationRpc(client, { dniHmac: HMAC })).toEqual({ ok: true, data: RESERVATION });
    expect(calls).toEqual([{ fn: 'admin_find_courier_dni_reservation', args: { p_dni_hmac: HMAC } }]);
  });

  it('sin reserva devuelve reservation null', async () => {
    const { client } = caller({ data: { reservation: null }, error: null });
    expect(await adminFindCourierDniReservationRpc(client, { dniHmac: HMAC })).toEqual({
      ok: true,
      data: { reservation: null },
    });
  });

  it('un DNI en claro no llama a la RPC', async () => {
    const { client, calls } = caller({ data: RESERVATION, error: null });
    expect(await adminFindCourierDniReservationRpc(client, { dniHmac: '38123456' })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(calls).toEqual([]);
  });

  it('una salida con claves de más es INTERNAL_ERROR', async () => {
    const { client } = caller({
      data: { reservation: { ...RESERVATION.reservation, dniHmac: HMAC } },
      error: null,
    });
    expect(await adminFindCourierDniReservationRpc(client, { dniHmac: HMAC })).toEqual({
      ok: false,
      code: 'INTERNAL_ERROR',
    });
  });

  it.each(['AAL2_REQUIRED', 'UNAUTHORIZED_ACTOR'])('mapea %s', async (message) => {
    const { client } = caller({ data: null, error: { code: 'P0001', message } });
    expect(await adminFindCourierDniReservationRpc(client, { dniHmac: HMAC })).toEqual({ ok: false, code: message });
  });
});
