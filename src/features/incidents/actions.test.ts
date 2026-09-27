import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revalidatePath } from 'next/cache';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import * as requestsRpc from '@/server/rpc/requests';
import * as adminRpc from '@/server/rpc/admin';
import {
  reportIncidentAction,
  resolveIncidentAction,
  suspendCourierForIncidentAction,
} from './actions';

vi.mock('@/server/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/server/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/server/rpc/requests', () => ({
  callRequestRpc: vi.fn(),
}));

vi.mock('@/server/rpc/admin', () => ({
  adminSuspendCourierRpc: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const REQUEST_ID = 'd0000000-0000-4000-8000-000000000001';
const INCIDENT_ID = 'e0000000-0000-4000-8000-000000000002';
const COURIER_ID = 'c0000000-0000-4000-8000-000000000003';
const USER = { id: 'a0000000-0000-4000-8000-000000000009', email: 'persona@cadeapp.ar' };

type ServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;

function mockSession(options: {
  user?: typeof USER | null;
  role?: string;
  aal?: 'aal1' | 'aal2';
}) {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: options.role ? { role: options.role } : null,
          error: null,
        }),
      }),
    }),
  });
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.user === undefined ? USER : options.user },
        error: null,
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: options.aal ?? 'aal2', nextLevel: 'aal2' },
          error: null,
        }),
      },
    },
    from,
    rpc: vi.fn(),
  };
  vi.mocked(serverSupabase.createClient).mockResolvedValue(client as unknown as ServerClient);
  return client;
}

function tablesTouched(client: ReturnType<typeof mockSession>): string[] {
  return client.from.mock.calls.map((call: unknown[]) => String(call[0]));
}

const FORBIDDEN_DIRECT_TABLES = ['incidents', 'audit_log', 'couriers', 'offers'];

describe('T-124 DoD: reportIncidentAction — el reporte llega a la bandeja', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    requestId: REQUEST_ID,
    kind: 'damaged_goods' as const,
    description: 'La caja llegó abierta y faltaba una docena de facturas.',
  };

  it.each(['merchant', 'courier'])(
    'el %s del viaje reporta vía report_incident con el cliente de sesión',
    async (role) => {
      const client = mockSession({ role });
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
        ok: true,
        data: {
          incidentId: INCIDENT_ID,
          requestId: REQUEST_ID,
          status: 'open',
          createdAt: '2026-09-27T12:00:00.000Z',
        },
      });

      const result = await reportIncidentAction(validInput);

      expect(result).toEqual({
        ok: true,
        data: {
          incidentId: INCIDENT_ID,
          requestId: REQUEST_ID,
          status: 'open',
          createdAt: '2026-09-27T12:00:00.000Z',
        },
      });
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledWith(client, 'report_incident', validInput);
      expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
    }
  );

  it('revalida la bandeja admin para que el reporte aparezca en A05', async () => {
    mockSession({ role: 'merchant' });
    vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
      ok: true,
      data: {
        incidentId: INCIDENT_ID,
        requestId: REQUEST_ID,
        status: 'open',
        createdAt: '2026-09-27T12:00:00.000Z',
      },
    });

    await reportIncidentAction(validInput);

    expect(revalidatePath).toHaveBeenCalledWith('/admin/incidents');
  });

  it('no escribe incidents directo: el alta pasa solo por la RPC', async () => {
    const client = mockSession({ role: 'courier' });
    vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
      ok: true,
      data: {
        incidentId: INCIDENT_ID,
        requestId: REQUEST_ID,
        status: 'open',
        createdAt: '2026-09-27T12:00:00.000Z',
      },
    });

    await reportIncidentAction(validInput);

    expect(tablesTouched(client)).not.toContain('incidents');
  });

  it('sin sesión devuelve UNAUTHENTICATED y no llama a la RPC', async () => {
    mockSession({ user: null });
    expect(await reportIncidentAction(validInput)).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
    expect(requestsRpc.callRequestRpc).not.toHaveBeenCalled();
  });

  it('un admin no reporta desde el viaje (UNAUTHORIZED_ACTOR)', async () => {
    mockSession({ role: 'admin' });
    expect(await reportIncidentAction(validInput)).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    expect(requestsRpc.callRequestRpc).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'sin tipo', patch: { kind: '' } },
    { name: 'tipo desconocido', patch: { kind: 'robbery' } },
    { name: 'relato vacío', patch: { description: '   ' } },
    { name: 'relato demasiado corto', patch: { description: 'Mal' } },
    { name: 'relato con teléfono', patch: { description: 'Llamame al 3865 44-1122 para ver qué pasó.' } },
    { name: 'relato con +54', patch: { description: 'El cliente atiende en +54 9 3865 441122 siempre.' } },
    { name: 'relato con correo', patch: { description: 'Escribime a juan.perez@correo.com por el reclamo.' } },
    { name: 'requestId inválido', patch: { requestId: 'no-uuid' } },
  ])('rechaza $name con VALIDATION_ERROR sin llamar a la RPC', async ({ patch }) => {
    mockSession({ role: 'merchant' });
    const result = await reportIncidentAction({
      ...validInput,
      ...patch,
    } as unknown as Parameters<typeof reportIncidentAction>[0]);
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(requestsRpc.callRequestRpc).not.toHaveBeenCalled();
  });

  it('acepta montos en el relato (no son datos de contacto)', async () => {
    mockSession({ role: 'courier' });
    vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({
      ok: true,
      data: {
        incidentId: INCIDENT_ID,
        requestId: REQUEST_ID,
        status: 'open',
        createdAt: '2026-09-27T12:00:00.000Z',
      },
    });

    const result = await reportIncidentAction({
      ...validInput,
      kind: 'payment_issue',
      description: 'Pagó con $ 2.000 y no tenía cambio para $ 500 del envío.',
    });

    expect(result.ok).toBe(true);
    expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
  });

  it.each(['INCIDENT_WINDOW_EXPIRED', 'RATE_LIMITED', 'INVALID_STATE_TRANSITION', 'UNAUTHORIZED_ACTOR'] as const)(
    'propaga %s de la RPC sin revalidar',
    async (code) => {
      mockSession({ role: 'merchant' });
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({ ok: false, code });

      expect(await reportIncidentAction(validInput)).toEqual({ ok: false, code });
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );
});

describe('T-124 DoD: suspendCourierForIncidentAction — suspensión cautelar inmediata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    incidentId: INCIDENT_ID,
    courierId: COURIER_ID,
    reason: 'Reclamo grave pendiente de revisión.',
  };

  it('con aal2 suspende al instante vía admin_suspend_courier (retira sus ofertas)', async () => {
    const client = mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminSuspendCourierRpc).mockResolvedValue({
      ok: true,
      data: {
        courierId: COURIER_ID,
        status: 'suspended',
        withdrawnOffersCount: 2,
        deactivatedAt: '2026-09-27T12:05:00.000Z',
      },
    });

    const result = await suspendCourierForIncidentAction(validInput);

    expect(result).toEqual({
      ok: true,
      data: {
        courierId: COURIER_ID,
        status: 'suspended',
        withdrawnOffersCount: 2,
        deactivatedAt: '2026-09-27T12:05:00.000Z',
      },
    });
    expect(adminRpc.adminSuspendCourierRpc).toHaveBeenCalledTimes(1);
    expect(adminRpc.adminSuspendCourierRpc).toHaveBeenCalledWith(client, {
      courierId: COURIER_ID,
      reason: 'Reclamo grave pendiente de revisión.',
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/incidents');
  });

  it('no escribe couriers, offers, incidents ni audit_log directo y no usa service role', async () => {
    const client = mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminSuspendCourierRpc).mockResolvedValue({
      ok: true,
      data: {
        courierId: COURIER_ID,
        status: 'suspended',
        withdrawnOffersCount: 0,
        deactivatedAt: '2026-09-27T12:05:00.000Z',
      },
    });

    await suspendCourierForIncidentAction(validInput);

    for (const table of FORBIDDEN_DIRECT_TABLES) {
      expect(tablesTouched(client)).not.toContain(table);
    }
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });

  it.each(['merchant', 'courier'])('un %s no puede suspender (UNAUTHORIZED_ACTOR)', async (role) => {
    mockSession({ role });
    expect(await suspendCourierForIncidentAction(validInput)).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    expect(adminRpc.adminSuspendCourierRpc).not.toHaveBeenCalled();
  });

  it('un admin con aal1 recibe AAL2_REQUIRED', async () => {
    mockSession({ role: 'admin', aal: 'aal1' });
    expect(await suspendCourierForIncidentAction(validInput)).toEqual({
      ok: false,
      code: 'AAL2_REQUIRED',
    });
    expect(adminRpc.adminSuspendCourierRpc).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'sin motivo', patch: { reason: '   ' } },
    { name: 'courierId inválido', patch: { courierId: 'x' } },
    { name: 'incidentId inválido', patch: { incidentId: 'x' } },
  ])('rechaza $name con VALIDATION_ERROR', async ({ patch }) => {
    mockSession({ role: 'admin' });
    expect(await suspendCourierForIncidentAction({ ...validInput, ...patch })).toEqual({
      ok: false,
      code: 'VALIDATION_ERROR',
    });
    expect(adminRpc.adminSuspendCourierRpc).not.toHaveBeenCalled();
  });

  it.each(['NOT_FOUND', 'AAL2_REQUIRED', 'REASON_REQUIRED'] as const)(
    'propaga %s de la RPC sin revalidar',
    async (code) => {
      mockSession({ role: 'admin' });
      vi.mocked(adminRpc.adminSuspendCourierRpc).mockResolvedValue({ ok: false, code });
      expect(await suspendCourierForIncidentAction(validInput)).toEqual({ ok: false, code });
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );
});

describe('T-124 DoD: resolveIncidentAction — nadie sin permisos puede resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    incidentId: INCIDENT_ID,
    decision: 'warning' as const,
    reason: 'Se habló con ambas partes; primera advertencia.',
  };

  it.each(['merchant', 'courier'])('un %s no puede resolver (UNAUTHORIZED_ACTOR)', async (role) => {
    const client = mockSession({ role });
    expect(await resolveIncidentAction(validInput)).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    expect(tablesTouched(client)).not.toContain('incidents');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('sin sesión devuelve UNAUTHENTICATED', async () => {
    const client = mockSession({ user: null });
    expect(await resolveIncidentAction(validInput)).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
    });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('un admin con aal1 recibe AAL2_REQUIRED', async () => {
    const client = mockSession({ role: 'admin', aal: 'aal1' });
    expect(await resolveIncidentAction(validInput)).toEqual({ ok: false, code: 'AAL2_REQUIRED' });
    expect(tablesTouched(client)).not.toContain('incidents');
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'sin motivo', patch: { reason: '' } },
    { name: 'decisión desconocida', patch: { decision: 'ban_forever' } },
    { name: 'incidentId inválido', patch: { incidentId: 'x' } },
  ])('rechaza $name con VALIDATION_ERROR antes de tocar la base', async ({ patch }) => {
    const client = mockSession({ role: 'admin' });
    const result = await resolveIncidentAction({
      ...validInput,
      ...patch,
    } as unknown as Parameters<typeof resolveIncidentAction>[0]);
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it('un admin con aal2 nunca resuelve escribiendo incidents ni audit_log directo', async () => {
    const client = mockSession({ role: 'admin' });
    await resolveIncidentAction(validInput);
    expect(tablesTouched(client)).not.toContain('incidents');
    expect(tablesTouched(client)).not.toContain('audit_log');
    expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
  });
});
