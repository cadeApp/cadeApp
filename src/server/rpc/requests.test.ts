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
    // CC-012: `kind` es un tipo canónico; el relato se sigue recortando en la frontera.
    input: { requestId, kind: 'other', description: ' Demora de prueba ' },
    args: { p_request_id: requestId, p_kind: 'other', p_description: 'Demora de prueba' },
    output: { requestId, incidentId: offerId, status: 'open', createdAt: time },
  },
] as const;

describe('T-103 — Wrapper de RPC de solicitudes', () => {
  it('la matriz pgTAP contrasta los errores reales con los contratos vigentes', () => {
    const sql = readFileSync('supabase/tests/rpc_requests.sql', 'utf8');
    for (const c of cases) {
      const declaration = sql.match(new RegExp(`\\('${c.name}', array\\[([^\\]]+)\\]\\)`));
      expect(declaration, c.name).not.toBeNull();
      const codes = [...(declaration?.[1] ?? '').matchAll(/'([A-Z0-9_]+)'/g)].map((m) => m[1]);
      expect(codes.sort(), c.name).toEqual([...RPC_CONTRACTS[c.name].errorCodes].sort());
    }
    const strictContractErrorAssertRegex =
      /return\s+next\s+ok\(\s*result->>'error'\s*=\s*any\(/i;
    expect(sql).toMatch(strictContractErrorAssertRegex);
    const v04MutatedSql = sql.replace(
      strictContractErrorAssertRegex,
      "return next ok(true or result->>'error' = any("
    );
    expect(v04MutatedSql).not.toMatch(strictContractErrorAssertRegex);
  });

  it('la migración SQL cumple SECURITY DEFINER por función, locks anclados por sentencia en orden jerárquico (AG-58/AG-61/AG-63), sin UPDATE antes de RAISE (H03) y preserva hitos al cancelar', () => {
    const migrationSql = readFileSync(
      'supabase/migrations/20260924010124_rpc_requests_v1.sql',
      'utf8'
    );
    const fnBlocks = migrationSql.split(/create\s+function\s+/i).slice(1);
    expect(fnBlocks.length).toBe(10);
    for (const block of fnBlocks) {
      const fnName = block.slice(0, block.indexOf('(')).trim();
      expect(block, `${fnName}: falta security definer`).toMatch(/security\s+definer/i);
      expect(block, `${fnName}: falta search_path fijo`).toMatch(
        /set\s+search_path\s*=\s*public\s*,\s*pg_temp/i
      );
    }

    const cycleBlock =
      fnBlocks.find((b) => b.trimStart().startsWith('app_private.request_cycle(')) ?? '';
    expect(cycleBlock.length).toBeGreaterThan(0);

    // AG-61 / AG-63 (H01) + H08 (V03): cada lock anclado a su propia sentencia SELECT ([^;]*?) y ningún lock de hijo/actor precede al de delivery_requests
    const reqLockRegex = /from\s+public\.delivery_requests\b[^;]*?for\s+update\s*;/i;
    const offerLockRegex = /from\s+public\.offers\b[^;]*?for\s+update\s*;/i;
    const courierLockRegex = /from\s+public\.couriers\b[^;]*?for\s+share\s*;/i;
    const merchantLockRegex = /from\s+public\.merchants\b[^;]*?for\s+share\s*;/i;
    const anyChildOrActorLockRegex =
      /from\s+public\.(?:offers|couriers|merchants)\b[^;]*?for\s+(?:update|share)\s*;/i;

    const reqLockMatch = cycleBlock.match(reqLockRegex);
    const offerLockMatch = cycleBlock.match(offerLockRegex);
    const courierLockMatch = cycleBlock.match(courierLockRegex);
    const merchantLockMatch = cycleBlock.match(merchantLockRegex);

    expect(reqLockMatch).not.toBeNull();
    expect(offerLockMatch).not.toBeNull();
    expect(courierLockMatch).not.toBeNull();
    expect(merchantLockMatch).not.toBeNull();

    const reqIdx = reqLockMatch?.index ?? -1;
    const offerIdx = offerLockMatch?.index ?? -1;
    const courierIdx = courierLockMatch?.index ?? -1;
    const merchantIdx = merchantLockMatch?.index ?? -1;
    const firstChildOrActorLockIdx = cycleBlock.search(anyChildOrActorLockRegex);

    expect(reqIdx).toBeGreaterThanOrEqual(0);
    expect(reqIdx).toBeLessThan(firstChildOrActorLockIdx);
    expect(reqIdx).toBeLessThan(offerIdx);
    expect(offerIdx).toBeLessThan(courierIdx);
    expect(courierIdx).toBeLessThan(merchantIdx);
    expect(
      Array.from(
        cycleBlock.matchAll(/from\s+public\.couriers\b[^;]*?for\s+(?:update|share)\s*;/gi)
      )
    ).toHaveLength(1);

    // AG-63 + V03: mutaciones embebidas M1, M2, M3 y V03
    const m1WithoutReqLock = cycleBlock.replace(reqLockRegex, (s) =>
      s.replace(/for\s+update\s*;/i, ';')
    );
    expect(m1WithoutReqLock).not.toMatch(reqLockRegex);

    const m2WithoutOfferLock = cycleBlock.replace(offerLockRegex, (s) =>
      s.replace(/for\s+update\s*;/i, ';')
    );
    expect(m2WithoutOfferLock).not.toMatch(offerLockRegex);

    const m3WithoutCourierLock = cycleBlock.replace(courierLockRegex, (s) =>
      s.replace(/for\s+share\s*;/i, ';')
    );
    expect(m3WithoutCourierLock).not.toMatch(courierLockRegex);

    const v03WithPriorCourierLock = cycleBlock.replace(
      reqLockRegex,
      (s) => `from public.couriers where profile_id = v_user for update;\n  select status ${s}`
    );
    expect(v03WithPriorCourierLock.search(reqLockRegex)).toBeGreaterThan(
      v03WithPriorCourierLock.search(anyChildOrActorLockRegex)
    );

    // H03: sin UPDATE muerto en delivery_requests a status = 'expired' y todas las mutaciones de negocio ocurren después del último RAISE EXCEPTION
    expect(cycleBlock).not.toMatch(
      /update\s+public\.delivery_requests\b[^;]*?set\s+status\s*=\s*'expired'/i
    );
    const lastRaiseIdx = Math.max(
      ...Array.from(cycleBlock.matchAll(/raise\s+exception/gi)).map((m) => m.index ?? -1)
    );
    const firstDomainMutationIdx = Math.min(
      cycleBlock.search(/insert\s+into\s+public\.incidents/i),
      cycleBlock.search(/update\s+public\.delivery_requests/i),
      cycleBlock.search(/update\s+public\.offers/i)
    );
    expect(lastRaiseIdx).toBeGreaterThan(0);
    expect(lastRaiseIdx).toBeLessThan(firstDomainMutationIdx);

    // Preservación de hitos históricos al cancelar (Subtest 1131 / AG-37)
    expect(cycleBlock).toMatch(
      /matched_at\s*=\s*case\s+when\s+v_status\s*=\s*'published'\s+then\s+null\s+else\s+matched_at\s+end/i
    );
    expect(cycleBlock).toMatch(
      /picked_up_at\s*=\s*case\s+when\s+v_status\s*=\s*'published'\s+then\s+null\s+else\s+picked_up_at\s+end/i
    );

    // AG-58: coincidencia bidireccional entre los códigos lanzados en la migración y la unión de RPC_CONTRACTS
    const raisedInMigration = new Set(
      Array.from(migrationSql.matchAll(/raise\s+exception\s+'([A-Z0-9_]+)'/gi)).map((m) => m[1])
    );
    const declaredInContracts = new Set(cases.flatMap((c) => RPC_CONTRACTS[c.name].errorCodes));
    expect([...raisedInMigration].sort()).toEqual([...declaredInContracts].sort());
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

  it('H10: debe disparar sendCriticalAlert ante fallo inesperado en publish_request', async () => {
    const obs = await import('@/server/observability');
    const alertSpy = vi.spyOn(obs, 'sendCriticalAlert').mockResolvedValue({ ok: true });

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '57P01', message: 'terminating connection due to administrator command' },
    });

    const result = await callRequestRpc({ rpc }, 'publish_request', { requestId });
    expect(result.ok).toBe(false);
    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'publish_request_failed',
        severity: 'critical',
      })
    );
    alertSpy.mockRestore();
  });

  it('H15: publish_request completa devolviendo INTERNAL_ERROR aunque el webhook de Discord quede colgado', async () => {
    const { setDiscordWebhookUrlForTesting, setDiscordTimeoutForTesting } = await import(
      '@/server/observability'
    );
    setDiscordWebhookUrlForTesting('https://discord.com/api/webhooks/test/token');
    setDiscordTimeoutForTesting(50);

    let signalReceived: AbortSignal | undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
      signalReceived = init?.signal as AbortSignal | undefined;
      expect(signalReceived).toBeDefined();
      return new Promise((_resolve, reject) => {
        signalReceived?.addEventListener('abort', () => {
          const err = new Error('Discord timeout');
          err.name = 'TimeoutError';
          reject(err);
        });
      });
    });

    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '57P01', message: 'unexpected connection failure' },
    });

    try {
      const startTime = Date.now();
      const result = await callRequestRpc({ rpc }, 'publish_request', { requestId });
      const elapsed = Date.now() - startTime;

      expect(fetchSpy).toHaveBeenCalled();
      expect(signalReceived).toBeDefined();
      expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' });
      expect(elapsed).toBeLessThan(1000);
    } finally {
      fetchSpy.mockRestore();
      setDiscordWebhookUrlForTesting(null);
      setDiscordTimeoutForTesting(null);
    }
  }, 1000);

  describe('T-206: Cableado de push en transiciones de negocio (requests)', () => {
    it('publish_request despacha push a repartidores habilitados y disponibles después del éxito', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
        totalSubscriptions: 2,
        sentCount: 2,
        failedCount: 0,
        deletedSubscriptions: [],
        attempts: [],
        errors: [],
      });

      const eqAvailable = vi.fn().mockImplementation((col: string, val: boolean) => {
        if (col === 'available' && val === true) {
          return Promise.resolve({
            data: [
              { profile_id: '00000000-0000-4000-8000-0000000000c1' },
              { profile_id: '00000000-0000-4000-8000-0000000000c2' },
            ],
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      });

      const eqStatus = vi.fn().mockImplementation((col: string, val: string) => {
        if (col === 'status' && val === 'approved') {
          return { eq: eqAvailable };
        }
        return {
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'couriers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: eqStatus,
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      let rpcExecuted = false;
      let orderIsPostCommit = false;
      const rpc = vi.fn().mockImplementation(async () => {
        rpcExecuted = true;
        return {
          data: {
            requestId,
            status: 'published',
            publishedAt: time,
            expiresAt: time,
            routeDistanceM: 1500,
          },
          error: null,
        };
      });

      safeNotifySpy.mockImplementationOnce(async () => {
        orderIsPostCommit = rpcExecuted;
        return {
          totalSubscriptions: 2,
          sentCount: 2,
          failedCount: 0,
          deletedSubscriptions: [],
          attempts: [],
          errors: [],
        };
      });

      const result = await callRequestRpc({ rpc }, 'publish_request', { requestId });

      expect(result.ok).toBe(true);
      expect(orderIsPostCommit).toBe(true);
      expect(eqStatus).toHaveBeenCalledWith('status', 'approved');
      expect(eqAvailable).toHaveBeenCalledWith('available', true);
      expect(safeNotifySpy).toHaveBeenCalledTimes(1);
      const [recipients, payload] = safeNotifySpy.mock.calls[0]!;
      expect(recipients).toHaveLength(2);
      expect(new Set(recipients)).toEqual(
        new Set([
          '00000000-0000-4000-8000-0000000000c1',
          '00000000-0000-4000-8000-0000000000c2',
        ])
      );
      expect(payload).toEqual({
        event: 'request_published',
        requestId,
      });
      safeNotifySpy.mockRestore();
    });

    it('publish_request NO despacha push si la RPC falla', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'INVALID_STATE_TRANSITION' },
      });

      const result = await callRequestRpc({ rpc }, 'publish_request', { requestId });

      expect(result.ok).toBe(false);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('publish_request conserva resultado exitoso si el emisor push falla (best-effort)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockRejectedValue(
        new Error('Push network timeout')
      );

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'published',
          publishedAt: time,
          expiresAt: time,
          routeDistanceM: 1500,
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'publish_request', { requestId });

      expect(result.ok).toBe(true);
      safeNotifySpy.mockRestore();
    });

    it('publish_request NO despacha push si la consulta de couriers retorna error (PR118-H07)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'couriers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'couriers error' },
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'published',
          publishedAt: time,
          expiresAt: time,
          routeDistanceM: 1500,
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'publish_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    type MockOfferRow = {
      courier_id: string;
      request_id: string;
      status: string;
      decided_at: string;
    };

    type MockAuditRow = {
      actor_id: string;
      target_type: string;
      target_id: string;
      action: string;
      created_at: string;
    };

    function createOffersQueryBuilder(allRows: MockOfferRow[]) {
      let filtered = [...allRows];
      const builder: any = {
        eq: vi.fn((col: string, val: unknown) => {
          filtered = filtered.filter((r) => (r as any)[col] === val);
          return builder;
        }),
        in: vi.fn((col: string, vals: unknown[]) => {
          filtered = filtered.filter((r) => vals.includes((r as any)[col]));
          return Promise.resolve({
            data: filtered.map((r) => ({ courier_id: r.courier_id })),
            error: null,
          });
        }),
      };
      return builder;
    }

    function createAuditLogQueryBuilder(allRows: MockAuditRow[]) {
      let filtered = [...allRows];
      const builder: any = {
        eq: vi.fn((col: string, val: unknown) => {
          filtered = filtered.filter((r) => (r as any)[col] === val);
          return builder;
        }),
        order: vi.fn((col: string, options?: { ascending?: boolean }) => {
          const asc = options?.ascending ?? true;
          filtered.sort((a, b) => {
            const valA = (a as any)[col];
            const valB = (b as any)[col];
            if (valA < valB) return asc ? -1 : 1;
            if (valA > valB) return asc ? 1 : -1;
            return 0;
          });
          return builder;
        }),
        limit: vi.fn((n: number) => {
          filtered = filtered.slice(0, n);
          return builder;
        }),
        maybeSingle: vi.fn(async () => {
          const match = filtered[0] ?? null;
          return {
            data: match ? { actor_id: match.actor_id } : null,
            error: null,
          };
        }),
      };
      return builder;
    }

    it('cancel_request: merchant cancela published -> push solo a couriers con pending expiradas; no merchant ni históricos (PR118-H02, D01/1-A)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
        totalSubscriptions: 2,
        sentCount: 2,
        failedCount: 0,
        deletedSubscriptions: [],
        attempts: [],
        errors: [],
      });

      const merchantId = '00000000-0000-4000-8000-0000000000b1';
      const courierPending1 = '00000000-0000-4000-8000-0000000000c1';
      const courierPending2 = '00000000-0000-4000-8000-0000000000c2';
      const courierHistoricExpired = '00000000-0000-4000-8000-0000000000c7';
      const courierHistoricRejected = '00000000-0000-4000-8000-0000000000c8';
      const courierHistoricWithdrawn = '00000000-0000-4000-8000-0000000000c9';
      const cancelledAt = '2026-09-28T01:00:00.000Z';
      const olderDecidedAt = '2026-09-27T12:00:00.000Z';

      const allOffers: MockOfferRow[] = [
        { courier_id: courierPending1, request_id: requestId, status: 'expired', decided_at: cancelledAt },
        { courier_id: courierPending2, request_id: requestId, status: 'expired', decided_at: cancelledAt },
        // Oferta histórica con status expired pero decided_at previo: si se omite el filtro decided_at, entra y falla
        { courier_id: courierHistoricExpired, request_id: requestId, status: 'expired', decided_at: olderDecidedAt },
        { courier_id: courierHistoricRejected, request_id: requestId, status: 'rejected', decided_at: olderDecidedAt },
        { courier_id: courierHistoricWithdrawn, request_id: requestId, status: 'withdrawn', decided_at: olderDecidedAt },
      ];
      const offersBuilder = createOffersQueryBuilder(allOffers);

      const auditRows: MockAuditRow[] = [
        { actor_id: merchantId, target_type: 'delivery_request', target_id: requestId, action: 'cancel_request', created_at: cancelledAt },
        { actor_id: 'other-actor', target_type: 'delivery_request', target_id: requestId, action: 'publish_request', created_at: '2026-09-28T00:50:00.000Z' },
        { actor_id: 'other-req-actor', target_type: 'delivery_request', target_id: '00000000-0000-4000-8000-999999999999', action: 'cancel_request', created_at: cancelledAt },
        { actor_id: 'other-type-actor', target_type: 'offer', target_id: requestId, action: 'cancel_request', created_at: cancelledAt },
      ];
      const auditBuilder = createAuditLogQueryBuilder(auditRows);

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue(offersBuilder),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((col: string, val: string) => {
                if (col === 'id' && val === requestId) {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { merchant_id: merchantId },
                      error: null,
                    }),
                  };
                }
                return { maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue(auditBuilder),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      let rpcExecuted = false;
      let orderIsPostCommit = false;
      const rpc = vi.fn().mockImplementation(async () => {
        rpcExecuted = true;
        return {
          data: {
            requestId,
            status: 'cancelled',
            cancelledAt,
          },
          error: null,
        };
      });

      safeNotifySpy.mockImplementationOnce(async () => {
        orderIsPostCommit = rpcExecuted;
        return {
          totalSubscriptions: 2,
          sentCount: 2,
          failedCount: 0,
          deletedSubscriptions: [],
          attempts: [],
          errors: [],
        };
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(orderIsPostCommit).toBe(true);
      expect(offersBuilder.eq).toHaveBeenCalledWith('request_id', requestId);
      expect(offersBuilder.eq).toHaveBeenCalledWith('decided_at', cancelledAt);
      expect(offersBuilder.in).toHaveBeenCalledWith('status', ['expired', 'cancelled']);

      expect(auditBuilder.eq).toHaveBeenCalledWith('target_type', 'delivery_request');
      expect(auditBuilder.eq).toHaveBeenCalledWith('target_id', requestId);
      expect(auditBuilder.eq).toHaveBeenCalledWith('action', 'cancel_request');
      expect(auditBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(auditBuilder.limit).toHaveBeenCalledWith(1);

      expect(safeNotifySpy).toHaveBeenCalledTimes(1);

      const [recipients, payload] = safeNotifySpy.mock.calls[0]!;
      expect(recipients).toHaveLength(2);
      expect(new Set(recipients)).toEqual(new Set([courierPending1, courierPending2]));
      expect(payload).toEqual({
        event: 'request_cancelled',
        requestId,
      });

      safeNotifySpy.mockRestore();
    });

    it('cancel_request: merchant cancela matched -> push solo a courier aceptado cancelado; no merchant ni históricos (PR118-H02, D01/1-A)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
        totalSubscriptions: 2,
        sentCount: 2,
        failedCount: 0,
        deletedSubscriptions: [],
        attempts: [],
        errors: [],
      });

      const merchantId = '00000000-0000-4000-8000-0000000000b1';
      const courierAccepted = '00000000-0000-4000-8000-0000000000c2';
      const courierHistoricCancelled = '00000000-0000-4000-8000-0000000000c7';
      const courierHistoric = '00000000-0000-4000-8000-0000000000c8';
      const cancelledAt = '2026-09-28T01:05:00.000Z';
      const olderDecidedAt = '2026-09-27T12:00:00.000Z';

      const allOffers: MockOfferRow[] = [
        { courier_id: courierAccepted, request_id: requestId, status: 'cancelled', decided_at: cancelledAt },
        // Oferta histórica con status cancelled pero decided_at previo:
        { courier_id: courierHistoricCancelled, request_id: requestId, status: 'cancelled', decided_at: olderDecidedAt },
        { courier_id: courierHistoric, request_id: requestId, status: 'rejected', decided_at: olderDecidedAt },
      ];
      const offersBuilder = createOffersQueryBuilder(allOffers);

      const auditRows: MockAuditRow[] = [
        { actor_id: merchantId, target_type: 'delivery_request', target_id: requestId, action: 'cancel_request', created_at: cancelledAt },
        { actor_id: 'other-actor', target_type: 'delivery_request', target_id: requestId, action: 'publish_request', created_at: '2026-09-28T00:50:00.000Z' },
        { actor_id: 'other-req-actor', target_type: 'delivery_request', target_id: '00000000-0000-4000-8000-999999999999', action: 'cancel_request', created_at: cancelledAt },
      ];
      const auditBuilder = createAuditLogQueryBuilder(auditRows);

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue(offersBuilder),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: merchantId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue(auditBuilder),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt,
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(offersBuilder.eq).toHaveBeenCalledWith('request_id', requestId);
      expect(offersBuilder.eq).toHaveBeenCalledWith('decided_at', cancelledAt);
      expect(offersBuilder.in).toHaveBeenCalledWith('status', ['expired', 'cancelled']);

      expect(auditBuilder.eq).toHaveBeenCalledWith('target_type', 'delivery_request');
      expect(auditBuilder.eq).toHaveBeenCalledWith('target_id', requestId);
      expect(auditBuilder.eq).toHaveBeenCalledWith('action', 'cancel_request');
      expect(auditBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(auditBuilder.limit).toHaveBeenCalledWith(1);

      expect(safeNotifySpy).toHaveBeenCalledTimes(1);
      const [recipients, payload] = safeNotifySpy.mock.calls[0]!;
      expect(recipients).toHaveLength(1);
      expect(new Set(recipients)).toEqual(new Set([courierAccepted]));
      expect(payload).toEqual({
        event: 'request_cancelled',
        requestId,
      });

      safeNotifySpy.mockRestore();
    });

    it('cancel_request: admin cancela in_transit -> push a merchant y courier asignado (PR118-H02, D01/1-A)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
        totalSubscriptions: 2,
        sentCount: 2,
        failedCount: 0,
        deletedSubscriptions: [],
        attempts: [],
        errors: [],
      });

      const merchantId = '00000000-0000-4000-8000-0000000000b1';
      const adminId = '00000000-0000-4000-8000-0000000000a1';
      const courierAssigned = '00000000-0000-4000-8000-0000000000c3';
      const courierHistoric = '00000000-0000-4000-8000-0000000000c8';
      const cancelledAt = '2026-09-28T01:10:00.000Z';
      const olderDecidedAt = '2026-09-27T12:00:00.000Z';

      const allOffers: MockOfferRow[] = [
        { courier_id: courierAssigned, request_id: requestId, status: 'cancelled', decided_at: cancelledAt },
        { courier_id: courierHistoric, request_id: requestId, status: 'rejected', decided_at: olderDecidedAt },
      ];
      const offersBuilder = createOffersQueryBuilder(allOffers);

      const auditRows: MockAuditRow[] = [
        { actor_id: adminId, target_type: 'delivery_request', target_id: requestId, action: 'cancel_request', created_at: cancelledAt },
        { actor_id: 'other-actor', target_type: 'delivery_request', target_id: requestId, action: 'publish_request', created_at: '2026-09-28T00:50:00.000Z' },
        { actor_id: 'other-req-actor', target_type: 'delivery_request', target_id: '00000000-0000-4000-8000-999999999999', action: 'cancel_request', created_at: cancelledAt },
      ];
      const auditBuilder = createAuditLogQueryBuilder(auditRows);

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue(offersBuilder),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: merchantId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue(auditBuilder),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt,
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(offersBuilder.eq).toHaveBeenCalledWith('request_id', requestId);
      expect(offersBuilder.eq).toHaveBeenCalledWith('decided_at', cancelledAt);
      expect(offersBuilder.in).toHaveBeenCalledWith('status', ['expired', 'cancelled']);

      expect(auditBuilder.eq).toHaveBeenCalledWith('target_type', 'delivery_request');
      expect(auditBuilder.eq).toHaveBeenCalledWith('target_id', requestId);
      expect(auditBuilder.eq).toHaveBeenCalledWith('action', 'cancel_request');
      expect(auditBuilder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(auditBuilder.limit).toHaveBeenCalledWith(1);

      expect(safeNotifySpy).toHaveBeenCalledTimes(1);
      const [recipients, payload] = safeNotifySpy.mock.calls[0]!;
      expect(recipients).toHaveLength(2);
      expect(new Set(recipients)).toEqual(new Set([merchantId, courierAssigned]));
      expect(payload).toEqual({
        event: 'request_cancelled',
        requestId,
      });

      safeNotifySpy.mockRestore();
    });

    it('cancel_request no despacha push si la lista de destinatarios queda vacía', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const merchantId = '00000000-0000-4000-8000-0000000000b1';
      const cancelledAt = '2026-09-28T01:15:00.000Z';

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: merchantId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { actor_id: merchantId },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt,
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('cancel_request NO despacha push si la RPC falla', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'P0001', message: 'REQUEST_EXPIRED' },
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(false);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('cancel_request conserva resultado exitoso si push falla (best-effort)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockRejectedValue(
        new Error('Push network error')
      );

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ courier_id: '00000000-0000-4000-8000-0000000000c1' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: '00000000-0000-4000-8000-0000000000b1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { actor_id: '00000000-0000-4000-8000-0000000000b1' },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt: '2026-09-28T01:00:00.000Z',
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      safeNotifySpy.mockRestore();
    });

    it('cancel_request NO despacha push si la consulta de offers retorna error (PR118-H07)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'offers error' },
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: '00000000-0000-4000-8000-0000000000b1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { actor_id: '00000000-0000-4000-8000-0000000000a0' },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt: '2026-09-28T01:00:00.000Z',
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('cancel_request NO despacha push si la consulta de delivery_requests retorna error (PR118-H07)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ courier_id: '00000000-0000-4000-8000-0000000000c1' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'requests error' },
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { actor_id: '00000000-0000-4000-8000-0000000000b1' },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt: '2026-09-28T01:00:00.000Z',
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('cancel_request NO despacha push si la consulta de audit_log retorna error (PR118-H07)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ courier_id: '00000000-0000-4000-8000-0000000000c1' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: '00000000-0000-4000-8000-0000000000b1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: null,
                          error: { message: 'audit error' },
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt: '2026-09-28T01:00:00.000Z',
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('cancel_request: merchant cancela matched -> filtra semánticamente solo couriers de esta cancelación y excluye históricos (PR118-H05 semantic)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition').mockResolvedValue({
        totalSubscriptions: 1,
        sentCount: 1,
        failedCount: 0,
        deletedSubscriptions: [],
        attempts: [],
        errors: [],
      });

      const merchantId = '00000000-0000-4000-8000-0000000000b1';
      const courierAccepted = '00000000-0000-4000-8000-0000000000c2';
      const courierHistoricCancelled = '00000000-0000-4000-8000-0000000000c7';
      const cancelledAt = '2026-09-28T01:05:00.000Z';
      const olderDecidedAt = '2026-09-27T12:00:00.000Z';

      const allOffers: MockOfferRow[] = [
        { courier_id: courierAccepted, request_id: requestId, status: 'cancelled', decided_at: cancelledAt },
        { courier_id: courierHistoricCancelled, request_id: requestId, status: 'cancelled', decided_at: olderDecidedAt },
      ];
      const offersBuilder = createOffersQueryBuilder(allOffers);

      const auditRows: MockAuditRow[] = [
        { actor_id: merchantId, target_type: 'delivery_request', target_id: requestId, action: 'cancel_request', created_at: cancelledAt },
      ];
      const auditBuilder = createAuditLogQueryBuilder(auditRows);

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return { select: vi.fn().mockReturnValue(offersBuilder) };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: merchantId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return { select: vi.fn().mockReturnValue(auditBuilder) };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt,
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).toHaveBeenCalledTimes(1);
      const [recipients, payload] = safeNotifySpy.mock.calls[0]!;
      expect(recipients).toHaveLength(1);
      expect(new Set(recipients)).toEqual(new Set([courierAccepted]));
      expect(payload).toEqual({
        event: 'request_cancelled',
        requestId,
      });

      safeNotifySpy.mockRestore();
    });

    it('cancel_request NO despacha push si audit_log devuelve data: null sin error (PR118-H07 residual)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ courier_id: '00000000-0000-4000-8000-0000000000c1' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: '00000000-0000-4000-8000-0000000000b1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: null,
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt: '2026-09-28T01:00:00.000Z',
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('cancel_request NO despacha push si delivery_requests devuelve data: null sin error (PR118-H07 residual)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [{ courier_id: '00000000-0000-4000-8000-0000000000c1' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { actor_id: '00000000-0000-4000-8000-0000000000b1' },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt: '2026-09-28T01:00:00.000Z',
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('cancel_request NO despacha push si offers devuelve data: null sin error (PR118-H07 residual)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: '00000000-0000-4000-8000-0000000000b1' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { actor_id: '00000000-0000-4000-8000-0000000000a0' },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt: '2026-09-28T01:00:00.000Z',
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });

    it('control: cancel_request NO despacha push si offers es array vacío y actor es el comercio (PR118-H07 residual)', async () => {
      const push = await import('@/server/push');
      const safeNotifySpy = vi.spyOn(push, 'safeNotifyPostTransition');

      const merchantId = '00000000-0000-4000-8000-0000000000b1';
      const adminSupabase = await import('@/server/supabase/admin');
      const mockFrom = vi.fn().mockImplementation((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        if (table === 'delivery_requests') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { merchant_id: merchantId },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'audit_log') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({
                          data: { actor_id: merchantId },
                          error: null,
                        }),
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });
      vi.spyOn(adminSupabase, 'createAdminClient').mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof adminSupabase.createAdminClient>);

      const rpc = vi.fn().mockResolvedValue({
        data: {
          requestId,
          status: 'cancelled',
          cancelledAt: '2026-09-28T01:00:00.000Z',
        },
        error: null,
      });

      const result = await callRequestRpc({ rpc }, 'cancel_request', { requestId });

      expect(result.ok).toBe(true);
      expect(safeNotifySpy).not.toHaveBeenCalled();
      safeNotifySpy.mockRestore();
    });
  });
});

