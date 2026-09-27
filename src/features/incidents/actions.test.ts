import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revalidatePath } from 'next/cache';
import * as serverSupabase from '@/server/supabase/server';
import * as adminSupabase from '@/server/supabase/admin';
import * as requestsRpc from '@/server/rpc/requests';
import * as adminRpc from '@/server/rpc/admin';
import type { IncidentDecision } from '@/domain';
import { reportIncidentAction, resolveIncidentAction } from './actions';

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
  adminResolveIncidentRpc: vi.fn(),
  adminSuspendCourierRpc: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const REQUEST_ID = 'd0000000-0000-4000-8000-000000000001';
const INCIDENT_ID = 'e0000000-0000-4000-8000-000000000002';
const COURIER_ID = 'c0000000-0000-4000-8000-000000000003';
const USER = { id: 'a0000000-0000-4000-8000-000000000009', email: 'persona@example.test' };

type ServerClient = Awaited<ReturnType<typeof serverSupabase.createClient>>;

const WRITE_METHODS = ['insert', 'update', 'upsert', 'delete'] as const;

/** Sesión simulada: el query builder registra cada tabla y cada método que se usa sobre ella. */
function mockSession(options: {
  user?: typeof USER | null;
  role?: string;
  aal?: 'aal1' | 'aal2';
}) {
  const writes: string[] = [];
  const from = vi.fn((table: string) => {
    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      maybeSingle: vi.fn().mockResolvedValue({
        data: options.role ? { role: options.role, consent_status: 'active' } : null,
        error: null,
      }),
    };
    for (const method of WRITE_METHODS) {
      builder[method] = vi.fn(() => {
        writes.push(`${table}.${method}`);
        return builder;
      });
    }
    return builder;
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
  return { client, writes };
}

function tablesTouched(client: ReturnType<typeof mockSession>['client']): string[] {
  return client.from.mock.calls.map((call: unknown[]) => String(call[0]));
}

/** La feature solo lee `profiles` para la sesión; nunca toca incidents, audit_log, couriers ni offers. */
function expectNoDirectAccess(session: ReturnType<typeof mockSession>) {
  expect(session.writes).toEqual([]);
  expect(tablesTouched(session.client).every((table) => table === 'profiles')).toBe(true);
  expect(session.client.rpc).not.toHaveBeenCalled();
  expect(adminSupabase.createAdminClient).not.toHaveBeenCalled();
}

const REPORT_OUTPUT = {
  incidentId: INCIDENT_ID,
  requestId: REQUEST_ID,
  status: 'open' as const,
  createdAt: '2026-09-27T12:00:00.000Z',
};

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
      const session = mockSession({ role });
      vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({ ok: true, data: REPORT_OUTPUT });

      const result = await reportIncidentAction(validInput);

      expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
      expect(requestsRpc.callRequestRpc).toHaveBeenCalledWith(session.client, 'report_incident', validInput);
      expect(result).toEqual({ ok: true, data: REPORT_OUTPUT });
      expectNoDirectAccess(session);
    }
  );

  it('revalida la bandeja admin para que el reporte aparezca en A05', async () => {
    mockSession({ role: 'merchant' });
    vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({ ok: true, data: REPORT_OUTPUT });

    await reportIncidentAction(validInput);

    expect(revalidatePath).toHaveBeenCalledWith('/admin/incidents');
  });

  it('sin sesión devuelve UNAUTHENTICATED y no llama a la RPC', async () => {
    mockSession({ user: null });
    expect(await reportIncidentAction(validInput)).toEqual({ ok: false, code: 'UNAUTHENTICATED' });
    expect(requestsRpc.callRequestRpc).not.toHaveBeenCalled();
  });

  it('un admin no reporta desde el viaje (UNAUTHORIZED_ACTOR, D05-A)', async () => {
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
    { name: 'tipo previo a CC-012', patch: { kind: 'delay' } },
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
    expect(requestsRpc.callRequestRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
  });

  it('acepta montos en el relato (no son datos de contacto)', async () => {
    mockSession({ role: 'courier' });
    vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({ ok: true, data: REPORT_OUTPUT });

    const result = await reportIncidentAction({
      ...validInput,
      kind: 'payment_issue',
      description: 'Pagó con $ 2.000 y no tenía cambio para $ 500 del envío.',
    });

    expect(result.ok).toBe(true);
    expect(requestsRpc.callRequestRpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    'INCIDENT_WINDOW_EXPIRED',
    'RATE_LIMITED',
    'INVALID_STATE_TRANSITION',
    'UNAUTHORIZED_ACTOR',
    'COURIER_SUSPENDED',
    'NOT_FOUND',
  ] as const)('propaga %s de la RPC sin revalidar', async (code) => {
    mockSession({ role: 'merchant' });
    vi.mocked(requestsRpc.callRequestRpc).mockResolvedValue({ ok: false, code });

    expect(await reportIncidentAction(validInput)).toEqual({ ok: false, code });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

const REASON = 'Se habló con ambas partes; queda registrado.';

const RESOLVE_OUTPUTS = {
  no_action: {
    incidentId: INCIDENT_ID,
    status: 'dismissed' as const,
    decision: 'no_action' as const,
    courierId: null,
    withdrawnOffersCount: 0,
  },
  warning: {
    incidentId: INCIDENT_ID,
    status: 'resolved' as const,
    decision: 'warning' as const,
    courierId: null,
    withdrawnOffersCount: 0,
  },
  preventive_suspension: {
    incidentId: INCIDENT_ID,
    status: 'resolved' as const,
    decision: 'preventive_suspension' as const,
    courierId: COURIER_ID,
    withdrawnOffersCount: 2,
  },
} satisfies Record<IncidentDecision, unknown>;

const DECISIONS = Object.keys(RESOLVE_OUTPUTS) as IncidentDecision[];

describe('PR113-H07: resolveIncidentAction — happy path contractual por decisión', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(DECISIONS)(
    '%s: admin aal2 llama una sola vez a adminResolveIncidentRpc con el payload exacto y revalida',
    async (decision) => {
      const session = mockSession({ role: 'admin' });
      vi.mocked(adminRpc.adminResolveIncidentRpc).mockResolvedValue({
        ok: true,
        data: RESOLVE_OUTPUTS[decision],
      });

      const result = await resolveIncidentAction({ incidentId: INCIDENT_ID, decision, reason: REASON });

      expect(adminRpc.adminResolveIncidentRpc).toHaveBeenCalledTimes(1);
      expect(adminRpc.adminResolveIncidentRpc).toHaveBeenCalledWith(session.client, {
        incidentId: INCIDENT_ID,
        decision,
        reason: REASON,
      });
      expect(result).toEqual({ ok: true, data: RESOLVE_OUTPUTS[decision] });
      expect(vi.mocked(revalidatePath).mock.calls).toEqual(
        expect.arrayContaining([
          ['/admin/incidents'],
          [`/admin/incidents/${INCIDENT_ID}`],
          ['/admin/audit'],
        ])
      );
      expect(adminRpc.adminSuspendCourierRpc).not.toHaveBeenCalled();
      expectNoDirectAccess(session);
    }
  );

  it('la action no reproduce los efectos de preventive_suspension: solo delega en la RPC', async () => {
    const session = mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminResolveIncidentRpc).mockResolvedValue({
      ok: true,
      data: RESOLVE_OUTPUTS.preventive_suspension,
    });

    await resolveIncidentAction({
      incidentId: INCIDENT_ID,
      decision: 'preventive_suspension',
      reason: REASON,
    });

    expect(adminRpc.adminSuspendCourierRpc).not.toHaveBeenCalled();
    expectNoDirectAccess(session);
  });

  it.each(['NOT_FOUND', 'AAL2_REQUIRED', 'REASON_REQUIRED', 'INVALID_STATE_TRANSITION', 'INTERNAL_ERROR'] as const)(
    'propaga %s de la RPC y no revalida',
    async (code) => {
      mockSession({ role: 'admin' });
      vi.mocked(adminRpc.adminResolveIncidentRpc).mockResolvedValue({ ok: false, code });

      const result = await resolveIncidentAction({
        incidentId: INCIDENT_ID,
        decision: 'warning',
        reason: REASON,
      });

      expect(adminRpc.adminResolveIncidentRpc).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ ok: false, code });
      expect(revalidatePath).not.toHaveBeenCalled();
    }
  );
});

describe('PR113-H03: resolveIncidentAction nunca recibe ni envía courierId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el payload que llega a adminResolveIncidentRpc tiene solo incidentId, decision y reason', async () => {
    mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminResolveIncidentRpc).mockResolvedValue({
      ok: true,
      data: RESOLVE_OUTPUTS.preventive_suspension,
    });

    await resolveIncidentAction({
      incidentId: INCIDENT_ID,
      decision: 'preventive_suspension',
      reason: REASON,
    });

    const payload = vi.mocked(adminRpc.adminResolveIncidentRpc).mock.calls[0]?.[1];
    expect(Object.keys(payload as object).sort()).toEqual(['decision', 'incidentId', 'reason']);
    expect(payload).not.toHaveProperty('courierId');
  });

  it('si el cliente manda courierId, la RPC nunca lo recibe y la action devuelve VALIDATION_ERROR', async () => {
    const session = mockSession({ role: 'admin' });
    vi.mocked(adminRpc.adminResolveIncidentRpc).mockResolvedValue({
      ok: true,
      data: RESOLVE_OUTPUTS.preventive_suspension,
    });

    const result = await resolveIncidentAction({
      incidentId: INCIDENT_ID,
      decision: 'preventive_suspension',
      reason: REASON,
      courierId: COURIER_ID,
    } as unknown as Parameters<typeof resolveIncidentAction>[0]);

    for (const call of vi.mocked(adminRpc.adminResolveIncidentRpc).mock.calls) {
      expect(call[1]).not.toHaveProperty('courierId');
    }
    expect(adminRpc.adminResolveIncidentRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expectNoDirectAccess(session);
  });
});

describe('T-124 DoD: resolveIncidentAction — nadie sin permisos puede resolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validInput = {
    incidentId: INCIDENT_ID,
    decision: 'preventive_suspension' as const,
    reason: REASON,
  };

  it.each(['merchant', 'courier'])('un %s no llama a la RPC (UNAUTHORIZED_ACTOR)', async (role) => {
    const session = mockSession({ role });
    expect(await resolveIncidentAction(validInput)).toEqual({
      ok: false,
      code: 'UNAUTHORIZED_ACTOR',
    });
    expect(adminRpc.adminResolveIncidentRpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expectNoDirectAccess(session);
  });

  it('sin sesión devuelve UNAUTHENTICATED y no llama a la RPC', async () => {
    const session = mockSession({ user: null });
    expect(await resolveIncidentAction(validInput)).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
    });
    expect(adminRpc.adminResolveIncidentRpc).not.toHaveBeenCalled();
    expectNoDirectAccess(session);
  });

  it('un admin con aal1 recibe AAL2_REQUIRED y no llama a la RPC', async () => {
    const session = mockSession({ role: 'admin', aal: 'aal1' });
    expect(await resolveIncidentAction(validInput)).toEqual({ ok: false, code: 'AAL2_REQUIRED' });
    expect(adminRpc.adminResolveIncidentRpc).not.toHaveBeenCalled();
    expectNoDirectAccess(session);
  });

  it.each([
    { name: 'sin motivo', patch: { reason: '' } },
    { name: 'decisión desconocida', patch: { decision: 'ban_forever' } },
    { name: 'incidentId inválido', patch: { incidentId: 'x' } },
  ])('rechaza $name con VALIDATION_ERROR antes de llamar a la RPC', async ({ patch }) => {
    const session = mockSession({ role: 'admin' });
    const result = await resolveIncidentAction({
      ...validInput,
      ...patch,
    } as unknown as Parameters<typeof resolveIncidentAction>[0]);
    expect(adminRpc.adminResolveIncidentRpc).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR' });
    expectNoDirectAccess(session);
  });
});
