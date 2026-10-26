# Evidencia de la revisión de PR #551 / T-415

SHA de código: `a3f349817426a4d1940abea547e9d391da0d03b0`. Base: `9b348f9b41de7c4e74b08dcccfe4eb94b4262597`.

El HEAD `6aee02867ec53717f7eb1749125cb863009d0c36` agrega solo 5 líneas a la bitácora; no cambia código, esquema, E2E ni controles. No se exige otro CI por ese cambio.

## Verificaciones

- Node 24.22.1 local; pnpm 10.28.0 (la versión fijada por el repo). CI usa Node 22.14.0.
- `pnpm typecheck`: exit 0. `pnpm lint`: exit 0.
- `PATH="/tmp/pr551-bin:$PATH" pnpm test`: exit 0; 183 archivos y 3390 pruebas Vitest, 81 de workflows y 6 de ADR.
- Primera corrida: 3389/3390 por el `pnpm` 11 global de este entorno, cuyo `why --prod --json` no satisface el control de la sonda. Con pnpm 10.28.0, ese archivo pasa 5/5 y la corrida completa pasa. No se alteró el test.
- `db-tests`, job 121396514429: `Files=40, Tests=3244`, `Result: PASS`; `cc041_online_couriers.sql ... ok`; tipos generados con `pnpm db:types --local` y `git diff --exit-code -- src/types/database.types.ts` exit 0.
- CI ejecutó el merge `3f91a2aa027da6ecbe1c755a3c1f390583786e72`, cuyo tree `f7aaeab23f545eb852d67afa13f85d29338c43f5` coincide con el tree del SHA de código revisado (verificado por Git Data API y `git rev-parse HEAD^{tree}`).
- RED de esquema del autor, PR #552, job 121396541826: `relation "public.courier_presence" does not exist`, CC-041 ejecuta 0 aserciones y el job falla. PR cerrada sin merge. Demuestra dependencia del esquema, no cada invariante del conteo.
- `admin_update_setting`: comparado mecánicamente con la última definición de T-369; al quitar solo la rama nueva de CC-041 el cuerpo es idéntico.
- Sin Supabase/Docker local ni llamadas administrativas remotas.

## Arnés independiente de mutaciones

Copiar el bloque a `/tmp/pr551-mutations.py` y ejecutar `python /tmp/pr551-mutations.py /ruta/al/worktree`. Conserva los bytes originales en memoria y los restaura en `finally`; no usa `git checkout`. Comprueba exactamente un objetivo por mutación. Control previo y posterior 84/84. Las mutaciones de SQL no se ejecutaron: se proponen más abajo.

### `/tmp/pr551-mutations.py`

```python
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
OUT = Path('/tmp/pr551-mutation-results')
OUT.mkdir(exist_ok=True)

def run(label, suites):
    proc = subprocess.run(['node', 'node_modules/vitest/vitest.mjs', 'run', *suites], cwd=ROOT,
                          text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=150)
    (OUT / (label + '.log')).write_text(proc.stdout)
    summaries = [re.sub(r'\x1b\[[0-9;]*m', '', line).strip() for line in proc.stdout.splitlines()
                 if re.search(r'\b(?:Test Files|Tests)\s+', line)]
    result = {'case': label, 'exit': proc.returncode, 'summaries': summaries}
    print(json.dumps(result), flush=True)
    return result

def replace_once(text, old, new):
    if text.count(old) != 1:
        raise AssertionError(f'Expected exactly one mutation target, got {text.count(old)}: {old!r}')
    return text.replace(old, new, 1)

presence = 'src/features/availability/hooks/use-courier-presence.ts'
presence_test = 'src/features/availability/hooks/use-courier-presence.test.tsx'
switch = 'src/features/availability/components/availability-switch.tsx'
switch_test = 'src/features/availability/components/availability-switch.test.tsx'
hook = 'src/features/requests/hooks/use-online-couriers.ts'
indicator = 'src/features/requests/components/online-couriers-indicator.tsx'
indicator_test = 'src/features/requests/components/online-couriers-indicator.test.tsx'
admin_query = 'src/features/admin/queries.ts'
admin_test = 'src/features/admin/queries.test.ts'
form_schema = 'src/features/admin/schemas.ts'
form_test = 'src/features/admin/components/platform-settings-form.test.tsx'
fake = 'src/domain/testing/rpc-fake.ts'
domain_test = 'src/domain/cc041-online-couriers.test.ts'

cases = [
    ('M01-presence-hidden', presence, "      if (document.visibilityState !== 'visible') return;", '', [presence_test]),
    ('M02-presence-cleanup', presence, '      window.clearInterval(interval);', '', [presence_test]),
    ('M03-switch-disconnected', switch, '  useCourierPresence(available);', '  useCourierPresence(false);', [switch_test]),
    ('M04-live-poll-disabled', hook, 'useQuery(onlineCouriersQueryOptions(initial), contextClient ?? fallbackClient)',
     'useQuery({ ...onlineCouriersQueryOptions(initial), refetchInterval: false }, contextClient ?? fallbackClient)', [indicator_test]),
    ('M05-live-background-enabled', hook, 'useQuery(onlineCouriersQueryOptions(initial), contextClient ?? fallbackClient)',
     'useQuery({ ...onlineCouriersQueryOptions(initial), refetchIntervalInBackground: true }, contextClient ?? fallbackClient)', [indicator_test]),
    ('M06-live-focus-disabled', hook, 'useQuery(onlineCouriersQueryOptions(initial), contextClient ?? fallbackClient)',
     'useQuery({ ...onlineCouriersQueryOptions(initial), refetchOnWindowFocus: false }, contextClient ?? fallbackClient)', [indicator_test]),
    ('M07-live-reconnect-disabled', hook, 'useQuery(onlineCouriersQueryOptions(initial), contextClient ?? fallbackClient)',
     'useQuery({ ...onlineCouriersQueryOptions(initial), refetchOnReconnect: false }, contextClient ?? fallbackClient)', [indicator_test]),
    ('M08-live-snapshot', hook, 'useQuery(onlineCouriersQueryOptions(initial), contextClient ?? fallbackClient)',
     'useQuery({ ...onlineCouriersQueryOptions(initial), queryFn: initial ? async () => initial : fetchOnlineCouriers }, contextClient ?? fallbackClient)', [indicator_test]),
    ('M09-stale-indicator-after-error', indicator, '  if (!data || isError) return null;', '  if (!data) return null;', [indicator_test]),
    ('M10-admin-hardcoded-window', admin_query,
     "courierOnlineWindowMinutes: values.has('courier_online_window_minutes')\n      ? read('courier_online_window_minutes', isNumber)\n      : 10,",
     'courierOnlineWindowMinutes: 10,', [admin_test]),
    ('M11-admin-invalid-minimum', form_schema,
     "value: boundedIntegerTextSchema(2, 60, 'Ingresá una cantidad entera de minutos entre 2 y 60.'),",
     "value: boundedIntegerTextSchema(1, 60, 'Ingresá una cantidad entera de minutos entre 2 y 60.'),", [form_test]),
    ('M12-fake-includes-suspended', fake,
     "if (courier?.status === 'approved' && courier.available && lastSeenMs > since) count += 1;",
     'if (courier && courier.available && lastSeenMs > since) count += 1;', [domain_test]),
    ('M13-fake-never-refreshes', fake,
     '        courierPresence.set(actor.userId, nowMs);',
     '        if (!courierPresence.has(actor.userId)) courierPresence.set(actor.userId, nowMs);', [domain_test]),
]

results = []
control = run('CONTROL', sorted(set(s for c in cases for s in c[4])))
if control['exit'] != 0:
    raise SystemExit('Control failed; no mutants were run.')
for label, rel, old, new, suites in cases:
    path = ROOT / rel
    original = path.read_bytes()
    try:
        path.write_text(replace_once(original.decode(), old, new))
        results.append(run(label, suites))
    finally:
        path.write_bytes(original)
results.append(run('CONTROL-AFTER', sorted(set(s for c in cases for s in c[4]))))
(OUT / 'summary.json').write_text(json.dumps(results, indent=2))

```

Salida del arnés `mutations`:

```jsonl
{"case": "CONTROL", "exit": 0, "summaries": ["Test Files  6 passed (6)", "Tests  84 passed (84)"]}
{"case": "M01-presence-hidden", "exit": 1, "summaries": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 1 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "Test Files  1 failed (1)", "Tests  1 failed | 4 passed (5)"]}
{"case": "M02-presence-cleanup", "exit": 1, "summaries": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 1 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "Test Files  1 failed (1)", "Tests  1 failed | 4 passed (5)"]}
{"case": "M03-switch-disconnected", "exit": 1, "summaries": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 2 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "Test Files  1 failed (1)", "Tests  2 failed | 2 passed (4)"]}
{"case": "M04-live-poll-disabled", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  6 passed (6)"]}
{"case": "M05-live-background-enabled", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  6 passed (6)"]}
{"case": "M06-live-focus-disabled", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  6 passed (6)"]}
{"case": "M07-live-reconnect-disabled", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  6 passed (6)"]}
{"case": "M08-live-snapshot", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  6 passed (6)"]}
{"case": "M09-stale-indicator-after-error", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  6 passed (6)"]}
{"case": "M10-admin-hardcoded-window", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  48 passed (48)"]}
{"case": "M11-admin-invalid-minimum", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  16 passed (16)"]}
{"case": "M12-fake-includes-suspended", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  5 passed (5)"]}
{"case": "M13-fake-never-refreshes", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  5 passed (5)"]}
{"case": "CONTROL-AFTER", "exit": 0, "summaries": ["Test Files  6 passed (6)", "Tests  84 passed (84)"]}

```

### `/tmp/pr551-probes.py`

```python
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(sys.argv[1]).resolve()
OUT = Path('/tmp/pr551-probe-results')
OUT.mkdir(exist_ok=True)

def run(label, suite):
    p = subprocess.run(['node', 'node_modules/vitest/vitest.mjs', 'run', suite], cwd=ROOT,
                       stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, timeout=100)
    (OUT / (label + '.log')).write_text(p.stdout)
    lines = [re.sub(r'\x1b\[[0-9;]*m', '', l).strip() for l in p.stdout.splitlines()
             if re.search(r'\b(?:Test Files|Tests)\s+', l) or 'AssertionError:' in l]
    print(json.dumps({'case': label, 'exit': p.returncode, 'summary': lines}), flush=True)
    return p.returncode

FAKE_PROBE = '''import { describe, expect, it } from 'vitest';
import { createFakeRpcClient } from './testing/rpc-fake';

describe('PR551 independent parity probes', () => {
  it.each(['pending', 'reconsent_required'] as const)(
    'a courier with %s consent stops contributing even with a recent heartbeat', async (consentStatus) => {
      const fake = createFakeRpcClient({
        now: () => new Date('2026-10-26T12:00:00.000Z'),
        settings: { minOfferArs: 1000, maxOffersPerMin: 100, maxRequestPublicationsPerMin: 100,
          maxIncidentsPerMin: 5, requestTtlMinutes: 30, pilotActive: false, pilotTermsVersion: 'v1',
          subscriptionGraceDays: 3 },
        initialActor: { userId: '00000000-0000-4000-8000-000000410004', role: 'courier', aal: 'aal1',
          courierStatus: 'approved', courierAvailable: true, consentStatus: 'active' },
      });
      expect((await fake.courier_heartbeat({})).ok).toBe(true);
      fake.setActor({ userId: '00000000-0000-4000-8000-000000410002', role: 'merchant',
        consentStatus: 'active' });
      expect(await fake.get_online_couriers_count({})).toEqual({ ok: true, data: { count: 1, windowMinutes: 10 } });
      fake.setActor({ userId: '00000000-0000-4000-8000-000000410004', role: 'courier', consentStatus,
        courierStatus: 'approved', courierAvailable: true });
      fake.setActor({ userId: '00000000-0000-4000-8000-000000410002', role: 'merchant',
        consentStatus: 'active' });
      expect(await fake.get_online_couriers_count({})).toEqual({ ok: true, data: { count: 0, windowMinutes: 10 } });
    });
});
'''

LIVE_PROBE = '''// @vitest-environment jsdom
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOnlineCouriers } from './use-online-couriers';

describe('PR551 actual observer probes', () => {
  let client: QueryClient;
  let fetchMock: ReturnType<typeof vi.fn>;
  const initial = { count: 1, windowMinutes: 10 };
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const drain = async (ms = 0) => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
      await vi.dynamicImportSettled();
      await vi.advanceTimersByTimeAsync(0);
    });
  };
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    focusManager.setFocused(true);
    onlineManager.setOnline(true);
    client = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000,
      retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false } } });
    fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ count: 2, windowMinutes: 10 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    cleanup(); client.clear(); focusManager.setFocused(undefined); onlineManager.setOnline(true);
    vi.unstubAllGlobals(); vi.useRealTimers();
  });
  it('fetches new data after 60 seconds and stops polling while hidden', async () => {
    const { result } = renderHook(() => useOnlineCouriers(initial), { wrapper: Wrapper });
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(0);
    await drain(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data?.count).toBe(2);
    act(() => { focusManager.setFocused(false); });
    await drain(120_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('fetches on returning to the page even when initialData is fresh', async () => {
    const { result } = renderHook(() => useOnlineCouriers(initial), { wrapper: Wrapper });
    await drain();
    act(() => { focusManager.setFocused(false); });
    act(() => { focusManager.setFocused(true); });
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data?.count).toBe(2);
  });
  it('fetches on reconnect even when initialData is fresh', async () => {
    const { result } = renderHook(() => useOnlineCouriers(initial), { wrapper: Wrapper });
    await drain();
    act(() => { onlineManager.setOnline(false); });
    act(() => { onlineManager.setOnline(true); });
    await drain();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.data?.count).toBe(2);
  });
});
'''

probe = ROOT / 'src/domain/pr551-review-probe.test.ts'
if probe.exists(): raise AssertionError('probe already exists')
try:
    probe.write_text(FAKE_PROBE)
    run('FAKE-REVOKED-CONSENT', str(probe.relative_to(ROOT)))
finally:
    probe.unlink(missing_ok=True)

live_probe = ROOT / 'src/features/requests/hooks/pr551-review-probe.test.tsx'
hook = ROOT / 'src/features/requests/hooks/use-online-couriers.ts'
original_hook = hook.read_bytes()
old = 'useQuery(onlineCouriersQueryOptions(initial), contextClient ?? fallbackClient)'
if live_probe.exists() or original_hook.decode().count(old) != 1: raise AssertionError('invalid target')
try:
    live_probe.write_text(LIVE_PROBE)
    assert run('LIVE-CONTROL', str(live_probe.relative_to(ROOT))) == 0
    for label, option in [
        ('LIVE-POLL-DISABLED', 'refetchInterval: false'),
        ('LIVE-BACKGROUND', 'refetchIntervalInBackground: true'),
        ('LIVE-FOCUS-DISABLED', 'refetchOnWindowFocus: false'),
        ('LIVE-RECONNECT-DISABLED', 'refetchOnReconnect: false'),
        ('LIVE-SNAPSHOT', 'queryFn: initial ? async () => initial : fetchOnlineCouriers'),
    ]:
        try:
            hook.write_text(original_hook.decode().replace(old,
                f'useQuery({{ ...onlineCouriersQueryOptions(initial), {option} }}, contextClient ?? fallbackClient)', 1))
            run(label, str(live_probe.relative_to(ROOT)))
        finally:
            hook.write_bytes(original_hook)
finally:
    live_probe.unlink(missing_ok=True)
    hook.write_bytes(original_hook)

queries = ROOT / 'src/features/admin/queries.test.ts'
query_impl = ROOT / 'src/features/admin/queries.ts'
original_queries = queries.read_bytes()
original_impl = query_impl.read_bytes()
anchor = "  it('T-369: lee el precio de referencia cuando está cargado y falla si falta un parámetro de créditos', async () => {"
test = '''  it('PR551 review: reads the configured window instead of its fallback', async () => {
    mockClient({ platform_settings: { data: [...rows, { key: 'courier_online_window_minutes', value: 27 }], error: null } });
    expect((await getPlatformSettings()).courierOnlineWindowMinutes).toBe(27);
  });

'''
old = "courierOnlineWindowMinutes: values.has('courier_online_window_minutes')\\n      ? read('courier_online_window_minutes', isNumber)\\n      : 10,".replace('\\n', '\n')
if original_queries.decode().count(anchor) != 1 or original_impl.decode().count(old) != 1:
    raise AssertionError('invalid admin target')
try:
    queries.write_text(original_queries.decode().replace(anchor, test + anchor, 1))
    assert run('ADMIN-CONTROL', str(queries.relative_to(ROOT))) == 0
    query_impl.write_text(original_impl.decode().replace(old, 'courierOnlineWindowMinutes: 10,', 1))
    run('ADMIN-HARDCODED', str(queries.relative_to(ROOT)))
finally:
    queries.write_bytes(original_queries)
    query_impl.write_bytes(original_impl)

```

Salida del arnés `probes`:

```jsonl
{"case": "FAKE-REVOKED-CONSENT", "exit": 1, "summary": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 2 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "AssertionError: expected { ok: true, data: { count: 1, \u2026(1) } } to deeply equal { ok: true, data: { count: +0, \u2026(1) } }", "Test Files  1 failed (1)", "Tests  2 failed (2)"]}
{"case": "LIVE-CONTROL", "exit": 0, "summary": ["Test Files  1 passed (1)", "Tests  3 passed (3)"]}
{"case": "LIVE-POLL-DISABLED", "exit": 1, "summary": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 1 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "AssertionError: expected \"vi.fn()\" to be called 1 times, but got 0 times", "Test Files  1 failed (1)", "Tests  1 failed | 2 passed (3)"]}
{"case": "LIVE-BACKGROUND", "exit": 1, "summary": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 1 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "AssertionError: expected \"vi.fn()\" to be called 1 times, but got 3 times", "Test Files  1 failed (1)", "Tests  1 failed | 2 passed (3)"]}
{"case": "LIVE-FOCUS-DISABLED", "exit": 1, "summary": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 1 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "AssertionError: expected \"vi.fn()\" to be called 1 times, but got 0 times", "Test Files  1 failed (1)", "Tests  1 failed | 2 passed (3)"]}
{"case": "LIVE-RECONNECT-DISABLED", "exit": 1, "summary": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 1 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "AssertionError: expected \"vi.fn()\" to be called 1 times, but got 0 times", "Test Files  1 failed (1)", "Tests  1 failed | 2 passed (3)"]}
{"case": "LIVE-SNAPSHOT", "exit": 1, "summary": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 3 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "AssertionError: expected \"vi.fn()\" to be called 1 times, but got 0 times", "AssertionError: expected \"vi.fn()\" to be called 1 times, but got 0 times", "AssertionError: expected \"vi.fn()\" to be called 1 times, but got 0 times", "Test Files  1 failed (1)", "Tests  3 failed (3)"]}
{"case": "ADMIN-CONTROL", "exit": 0, "summary": ["Test Files  1 passed (1)", "Tests  49 passed (49)"]}
{"case": "ADMIN-HARDCODED", "exit": 1, "summary": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 1 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "AssertionError: expected 10 to be 27 // Object.is equality", "Test Files  1 failed (1)", "Tests  1 failed | 48 passed (49)"]}

```

### `/tmp/pr551-author-red.py`

```python
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
out = Path('/tmp/pr551-author-red-results')
out.mkdir(exist_ok=True)
base = '9b348f9b41de7c4e74b08dcccfe4eb94b4262597'

cases = [
 ('AUTHOR-domain', ['src/domain/rpc-contracts.ts', 'src/domain/schemas/index.ts', 'src/domain/testing/rpc-fake.ts'],
  ['src/domain/cc041-online-couriers.test.ts']),
 ('AUTHOR-actions', ['src/features/availability/actions.ts'], ['src/features/availability/actions.test.ts']),
 ('AUTHOR-pages', ['src/app/(merchant)/merchant/dashboard/page.tsx', 'src/app/(merchant)/merchant/requests/new/page.tsx'],
  ['src/app/(merchant)/merchant/dashboard/page.test.tsx', 'src/app/(merchant)/merchant/requests/new/page.test.tsx']),
 ('AUTHOR-admin', ['src/features/admin/queries.ts', 'src/features/admin/components/platform-settings-form.tsx'],
  ['src/features/admin/queries.test.ts', 'src/features/admin/components/platform-settings-form.test.tsx']),
 ('AUTHOR-absent-module-presence', ['src/features/availability/hooks/use-courier-presence.ts'],
  ['src/features/availability/hooks/use-courier-presence.test.tsx']),
 ('AUTHOR-absent-module-server', ['src/server/live/online-couriers.ts'], ['src/server/live/online-couriers.test.ts']),
 ('AUTHOR-absent-module-route', ['src/app/api/live/online-couriers/route.ts'], ['src/app/api/live/online-couriers/route.test.ts']),
 ('AUTHOR-absent-module-indicator', ['src/features/requests/components/online-couriers-indicator.tsx'],
  ['src/features/requests/components/online-couriers-indicator.test.tsx']),
]
for label, paths, suites in cases:
 saved = {p: (root / p).read_bytes() for p in paths}
 try:
  for p in paths:
   data = subprocess.run(['git', 'show', base + ':' + p], cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
   if data.returncode == 0: (root / p).write_bytes(data.stdout)
   elif 'absent-module' in label: (root / p).unlink()
   else: raise AssertionError('Unexpected missing baseline: ' + p)
  proc = subprocess.run(['node', 'node_modules/vitest/vitest.mjs', 'run', '--no-cache', *suites], cwd=root, text=True,
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=120)
  (out / (label + '.log')).write_text(proc.stdout)
  lines = [re.sub(r'\x1b\[[0-9;]*m', '', s).strip() for s in proc.stdout.splitlines()
           if re.search(r'\b(?:Test Files|Tests)\s+', s) or 'No test files found' in s]
  print(json.dumps({'case': label, 'exit': proc.returncode, 'summaries': lines}), flush=True)
 finally:
  for p, data in saved.items(): (root / p).write_bytes(data)

```

Salida del arnés `author-red`:

```jsonl
{"case": "AUTHOR-domain", "exit": 1, "summaries": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 5 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "Test Files  1 failed (1)", "Tests  5 failed (5)"]}
{"case": "AUTHOR-actions", "exit": 1, "summaries": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 2 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "Test Files  1 failed (1)", "Tests  2 failed | 5 passed (7)"]}
{"case": "AUTHOR-pages", "exit": 1, "summaries": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 4 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "Test Files  2 failed (2)", "Tests  4 failed | 2 passed (6)"]}
{"case": "AUTHOR-admin", "exit": 1, "summaries": ["\u23af\u23af\u23af\u23af\u23af\u23af\u23af Failed Tests 2 \u23af\u23af\u23af\u23af\u23af\u23af\u23af", "Test Files  2 failed (2)", "Tests  2 failed | 62 passed (64)"]}
{"case": "AUTHOR-absent-module-presence", "exit": 1, "summaries": ["Test Files  1 failed (1)", "Tests  no tests"]}
{"case": "AUTHOR-absent-module-server", "exit": 1, "summaries": ["Test Files  1 failed (1)", "Tests  no tests"]}
{"case": "AUTHOR-absent-module-route", "exit": 1, "summaries": ["Test Files  1 failed (1)", "Tests  no tests"]}
{"case": "AUTHOR-absent-module-indicator", "exit": 0, "summaries": ["Test Files  1 passed (1)", "Tests  6 passed (6)"]}

```

### Control adicional del RED por módulo ausente

La primera reproducción del indicador dio un resultado no fiable (6/6 aun habiendo eliminado el archivo). No se usa para acusar al autor. Una reproducción aislada con comprobación de ausencia y `--no-cache` al final devolvió exit 1 por import sin resolver, `Tests no tests`. Las fallas de import se distinguen del RED funcional; las mutaciones M04–M09 y las sondas del observer sí ejercen comportamientos.

## Mutaciones SQL propuestas (por inspección + CI verde)

- Q01: retirar solo `and c.status = 'approved'` del conteo. Preparar suspendido y pendiente con `available=true`, consentimiento activo y presencia reciente, variando solo el estado; deben dejar de sumar. El fixture actual del suspendido carece de presencia y además está no disponible.
- Q02: cambiar el upsert de heartbeat para conservar la hora vieja (`last_seen_at = courier_presence.last_seen_at`). En el test, escribir una hora vieja antes del segundo heartbeat; debe persistir `now()`, manteniendo una única fila. Hoy los dos heartbeat ocurren con el mismo `now()` transaccional y no distinguen un no-op.
- Q03: conservar el nombre de la policy pero convertirla a permisiva o cambiar `using/with check` a `true`. Afirmar catálogo y expresión de la policy, no solo su existencia. Los grants continúan denegando acceso, por lo que se trata de defensa en profundidad exigida por CC-041, no de una exposición actual demostrada.
- Q04: eliminar el chequeo de fila en `merchants` de la RPC. Preparar perfil merchant activo sin fila merchant y exigir `UNAUTHORIZED_ACTOR`.
- Añadir aprobado disponible activo SIN presencia, límites exactos de ventana y extremos válidos 2/60. No inventar resultados RED: ejecutar en una rama REVIEW ONLY aislada y cerrarla sin mergear cuando corresponda.


---

# Ronda 2 — revisión de HEAD `b72e2bfad3fdae55843326fce61a72b17d66b4e8` (2026-10-26)

**No se efectuó ejecución local**: el contenedor de este revisor no contiene un clon de cadeApp ni sus node_modules y no tiene salida DNS a github.com. Esta sección ofrece inspección de código real y vínculos a jobs ejecutados, pero no atribuye al revisor los RED locales del autor.

## Cambios examinados

Desde `0bf26aa1` hubo únicamente siete rutas modificadas: bitácora T-415; `cc041-online-couriers.test.ts`; `platform-settings-form.test.tsx`; `queries.test.ts`; `online-couriers-indicator.test.tsx`; `use-online-couriers.test.tsx` (nuevo); `cc041_online_couriers.sql`. `b72e2bf` es solo bitácora. Contrato CC-041 y T-415 leídos desde `develop`. A01 sigue aceptada. Ningún `.skip/.only` en las seis suites.

**GREEN DB con código:** https://github.com/cadeApp/cadeApp/actions/runs/40275448717/job/121417119690 — `cc041_online_couriers.sql ... ok`, `Files=40, Tests=3252, Result: PASS`; tipos generados sin diff.

**RED SQL — diferencias aisladas revisadas en sus commits, sin modificar tests:**
- https://github.com/cadeApp/cadeApp/pull/556 — `c.status = 'approved'` retirado; https://github.com/cadeApp/cadeApp/actions/runs/40275511570/job/121417303165 — tests 25,28,29,30 fallan.
- https://github.com/cadeApp/cadeApp/pull/557 — `last_seen_at = courier_presence.last_seen_at`; https://github.com/cadeApp/cadeApp/actions/runs/40275519307/job/121417326420 — tests 21,22,24,25,28,29 fallan.
- https://github.com/cadeApp/cadeApp/pull/558 — policy permisiva + true; https://github.com/cadeApp/cadeApp/actions/runs/40275527842/job/121417351478 — test 2 falla.
- https://github.com/cadeApp/cadeApp/pull/559 — sin check de merchant row; https://github.com/cadeApp/cadeApp/actions/runs/40275536735/job/121417377634 — test 17 falla.

**GREEN Vitest HEAD:** https://github.com/cadeApp/cadeApp/actions/runs/40276459983/job/121420134155 — 184 archivos, 3411 tests, workflows 81/81 y ADR 6/6.

**Audit externo fallido:** https://github.com/cadeApp/cadeApp/actions/runs/40276459983/job/121420133822 — GHSA-mrhx-c7xc-m3w5, T-416/#555.

## Arnés independiente de mutaciones TS (PREPARADO, NO EJECUTADO)

Este bloque puede copiarse íntegro a `/tmp/pr551-r2-mutations.py` desde un clon en un worktree limpio de `b72e2bfad3fdae55843326fce61a72b17d66b4e8`. Requiere Python, Node y pnpm 10.28.0. **No se ha comprobado en este entorno** y no es evidencia de RED/GREEN observado. Cada objetivo se sustituye exactamente una vez, la misma suite se ejecuta antes, mutada y después; restauración de bytes originales en `finally` (nunca `git checkout`). En el informe de una futura verificación hay que pegar las líneas `Tests …` REALES por mutante y no contar fallos de import o ausencia de objetivo como RED funcional.

~~~python
import sys, re, subprocess
from pathlib import Path

root = Path(sys.argv[1]).resolve()
cases = [
    ("H01-consent", "src/domain/testing/rpc-fake.ts",
     "const consentActive = (profileConsent.get(courierId) ?? 'active') === 'active';",
     "const consentActive = true;", ["src/domain/cc041-online-couriers.test.ts"]),
    ("H01-status", "src/domain/testing/rpc-fake.ts",
     "courier?.status === 'approved' && courier.available && consentActive",
     "Boolean(courier) && courier.available && consentActive",
     ["src/domain/cc041-online-couriers.test.ts"]),
    ("H01-renewal", "src/domain/testing/rpc-fake.ts",
     "courierPresence.set(actor.userId, nowMs);",
     "if (!courierPresence.has(actor.userId)) courierPresence.set(actor.userId, nowMs);",
     ["src/domain/cc041-online-couriers.test.ts"]),
    ("H02-interval", "src/features/requests/hooks/use-online-couriers.ts",
     "refetchInterval: ONLINE_COURIERS_REFETCH_MS,", "refetchInterval: false,",
     ["src/features/requests/hooks/use-online-couriers.test.tsx"]),
    ("H02-background", "src/features/requests/hooks/use-online-couriers.ts",
     "refetchIntervalInBackground: false,", "refetchIntervalInBackground: true,",
     ["src/features/requests/hooks/use-online-couriers.test.tsx"]),
    ("H02-focus", "src/features/requests/hooks/use-online-couriers.ts",
     "refetchOnWindowFocus: 'always' as const,", "refetchOnWindowFocus: false,",
     ["src/features/requests/hooks/use-online-couriers.test.tsx"]),
    ("H02-reconnect", "src/features/requests/hooks/use-online-couriers.ts",
     "refetchOnReconnect: 'always' as const,", "refetchOnReconnect: false,",
     ["src/features/requests/hooks/use-online-couriers.test.tsx"]),
    ("H02-constant", "src/features/requests/hooks/use-online-couriers.ts",
     "queryFn: fetchOnlineCouriers,", "queryFn: async () => ({count: 1, windowMinutes: 10}),",
     ["src/features/requests/hooks/use-online-couriers.test.tsx"]),
    ("H02-error", "src/features/requests/components/online-couriers-indicator.tsx",
     "if (!data || isError) return null;", "if (!data) return null;",
     ["src/features/requests/components/online-couriers-indicator.test.tsx"]),
    ("H04-reading", "src/features/admin/queries.ts",
     "courierOnlineWindowMinutes: values.has('courier_online_window_minutes')\n      ? read('courier_online_window_minutes', isNumber)\n      : 10,",
     "courierOnlineWindowMinutes: 10,",
     ["src/features/admin/queries.test.ts"]),
    ("H04-minimum", "src/features/admin/schemas.ts",
     "boundedIntegerTextSchema(2, 60, 'Ingresá una cantidad entera de minutos entre 2 y 60.')",
     "boundedIntegerTextSchema(1, 60, 'Ingresá una cantidad entera de minutos entre 2 y 60.')",
     ["src/features/admin/components/platform-settings-form.test.tsx"]),
    ("H04-maximum", "src/features/admin/schemas.ts",
     "boundedIntegerTextSchema(2, 60, 'Ingresá una cantidad entera de minutos entre 2 y 60.')",
     "boundedIntegerTextSchema(2, 61, 'Ingresá una cantidad entera de minutos entre 2 y 60.')",
     ["src/features/admin/components/platform-settings-form.test.tsx"]),
]
def run(name, suites):
    p = subprocess.run(["pnpm", "exec", "vitest", "run", "--hookTimeout=120000", *suites],
                       cwd=root, capture_output=True, text=True, timeout=180)
    matches = [re.sub(r"\x1b\[[0-9;]*m", "", s).strip()
               for s in p.stdout.splitlines() if re.search(r"\b(Test Files|Tests)\s", s)]
    print(name, "exit", p.returncode, " | ".join(matches[-3:]), flush=True)
    return p.returncode
for name, rel, old, new, suites in cases:
    file = root / rel
    original = file.read_bytes()
    try:
        data = original.decode("utf-8")
        if data.count(old) != 1:
            raise RuntimeError(f"{name}: objetivo no único ({data.count(old)}); no es un RED")
        if run(name+"-control", suites) != 0:
            raise RuntimeError(f"{name}: control base no verde")
        file.write_text(data.replace(old, new, 1), encoding="utf-8")
        if run(name+"-mutant", suites) == 0:
            raise RuntimeError(f"{name}: mutante SOBREVIVIENTE")
    finally:
        file.write_bytes(original)
    if run(name+"-restored", suites) != 0:
        raise RuntimeError(f"{name}: control restaurado no verde")
~~~

Para SQL, la batería de ramas #556–#559 es **del autor**, no de este revisor; esta revisión sí cotejó los cambios exactos y el RED de CI. Si se exige una batería SQL propia adicional, diseñarla y ejecutarla en una rama aislada REVIEW ONLY, jamás en feat/T-415 ni con Supabase remoto.
