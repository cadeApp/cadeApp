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
    const previousWebhook = process.env.DISCORD_ERROR_WEBHOOK_URL;
    process.env.DISCORD_ERROR_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token';

    const { setDiscordTimeoutForTesting } = await import('@/server/observability');
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
      setDiscordTimeoutForTesting(null);
      if (previousWebhook !== undefined) {
        process.env.DISCORD_ERROR_WEBHOOK_URL = previousWebhook;
      } else {
        delete process.env.DISCORD_ERROR_WEBHOOK_URL;
      }
    }
  }, 1000);
});
