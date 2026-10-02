# Evidencia reproducible — PR #210 / ronda 1

**SHA revisado:** `fd660cb6690e66715825a95f289899a50d3fe2ad`  
**develop:** `cb4111273da663f7591aec370a44767c4e677b82`  
**merge-tree:** `39db0889e471e99c992f60568a53f59df1e644be`

## 1. Sincronización / merge-tree

GitHub compare al cerrar la revisión funcional:

```text
status = ahead
ahead_by = 4
behind_by = 0
mergeable = true
```

El merge-tree incluye exactamente:

```text
docs/implementation-plan.md
docs/tasks/T-328.md
docs/tasks/log/T-328.md
src/features/requests/actions.test.ts
src/features/requests/actions.ts
src/features/requests/components/create-request-form.test.tsx
```

## 2. Clone de contingencia

Se intentó un clone aislado para ejecutar directamente el repo:

```sh
rm -rf /tmp/pr210-clone
git clone --no-checkout https://github.com/cadeApp/cadeApp.git /tmp/pr210-clone
```

Salida:

```text
Cloning into '/tmp/pr210-clone'...
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/': Could not resolve host: github.com
```

Por esa limitación del entorno, el código exacto de `src/features/requests/actions.ts` se obtuvo mediante el conector GitHub autenticado, ref `fd660cb6690e66715825a95f289899a50d3fe2ad`, y se guardó como `/tmp/pr210-actions.ts`.

## 3. Harness de mutación independiente

Archivo ejecutado: `/tmp/pr210-mutation-harness.cjs`.

```js
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const assert = require('assert/strict');

const SOURCE = fs.readFileSync('/tmp/pr210-actions.ts', 'utf8');

function compile(source) {
  // Las dependencias se inyectan como stubs en el contexto; los imports reales se eliminan solo en memoria.
  const withoutImports = source.replace(/^import[\s\S]*?;\n/gm, '');
  const js = ts.transpileModule(withoutImports, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText;
  return js;
}

function makeContext(rpcResult) {
  const calls = [];
  const requestId = '33333333-3333-4333-8333-333333333333';
  const client = {
    auth: {
      getUser: async () => ({ data: { user: { id: 'merchant-1' } }, error: null }),
    },
    from(table) {
      if (table === 'profiles') {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle: async () => ({ data: { role: 'merchant' }, error: null }),
        };
      }
      if (table === 'delivery_requests') {
        return {
          insert() {
            calls.push('insert:delivery_requests');
            return {
              select() { return this; },
              single: async () => ({ data: { id: requestId }, error: null }),
            };
          },
        };
      }
      if (table === 'delivery_request_contacts') {
        return {
          insert: async () => {
            calls.push('insert:delivery_request_contacts');
            return { error: null };
          },
        };
      }
      throw new Error(`tabla inesperada: ${table}`);
    },
  };

  const context = {
    exports: {},
    module: { exports: {} },
    console,
    Promise,
    Array,
    createClient: async () => client,
    err: (code) => ({ ok: false, code }),
    ok: (data) => ({ ok: true, data }),
    profileRoleSchema: { safeParse: (v) => ({ success: v === 'merchant', data: v }) },
    createDeliveryRequestSchema: { safeParse: (v) => ({ success: true, data: v }) },
    calculateHaversineRouteDistanceM: () => 1000,
    callRequestRpc: async (_client, name, input) => {
      calls.push(`rpc:${name}`);
      if (name !== 'publish_request') return { ok: false, code: 'INVALID_STATE_TRANSITION' };
      assert.equal(input.requestId, requestId);
      return rpcResult;
    },
  };
  context.module.exports = context.exports;
  return { context, calls, requestId };
}

const validInput = {
  pickupZoneId: '11111111-1111-4111-8111-111111111111',
  pickupAddress: 'Av. Sarmiento 120',
  pickupLat: -27.43,
  pickupLng: -65.61,
  dropoffZoneId: '22222222-2222-4222-8222-222222222222',
  dropoffAddress: 'San Martín 450',
  dropoffLat: -27.435,
  dropoffLng: -65.615,
  recipientName: 'Juan Pérez',
  recipientPhone: '3815551234',
  recipientConsentDeclared: true,
  packageType: 'mediano',
  recipientPaymentMethod: 'cash',
  needsChange: false,
  cashChangeAmount: null,
  notes: 'mutation-harness',
};

async function controlSuite(source) {
  const js = compile(source);
  const failures = [];

  async function one(label, rpcResult, verify) {
    try {
      const { context, calls, requestId } = makeContext(rpcResult);
      vm.runInNewContext(js, context, { filename: 'actions.ts' });
      const action = context.exports.createDeliveryRequestAction;
      assert.equal(typeof action, 'function');
      const result = await action(validInput);
      verify({ result, calls, requestId });
    } catch (err) {
      failures.push(`${label}: ${err && err.message ? err.message : String(err)}`);
    }
  }

  await one(
    'success-requires-publish-request-after-contact',
    { ok: true, data: { status: 'published' } },
    ({ result, calls, requestId }) => {
      assert.equal(
        JSON.stringify(result),
        JSON.stringify({ ok: true, data: { requestId, redirectTo: '/merchant/requests' } })
      );
      assert.deepEqual(calls, [
        'insert:delivery_requests',
        'insert:delivery_request_contacts',
        'rpc:publish_request',
      ]);
    }
  );

  await one(
    'rpc-rejection-must-propagate',
    { ok: false, code: 'SUBSCRIPTION_INACTIVE' },
    ({ result, calls }) => {
      assert.equal(
        JSON.stringify(result),
        JSON.stringify({ ok: false, code: 'SUBSCRIPTION_INACTIVE' })
      );
      assert.equal(calls.at(-1), 'rpc:publish_request');
    }
  );

  return failures;
}

async function main() {
  const variants = [
    ['baseline', SOURCE],
    [
      'M-A wrong RPC name',
      SOURCE.replace(
        "callRequestRpc(supabase, 'publish_request'",
        "callRequestRpc(supabase, 'cancel_request'"
      ),
    ],
    [
      'M-B invert RPC result branch',
      SOURCE.replace('if (!published.ok) {', 'if (published.ok) {'),
    ],
  ];

  let bad = false;
  for (const [name, source] of variants) {
    const failures = await controlSuite(source);
    console.log(
      `${name}: ${failures.length === 0 ? 'GREEN' : 'RED'} (${failures.length} control failures)`
    );
    for (const f of failures) console.log(`  - ${f}`);
    if (name === 'baseline' && failures.length !== 0) bad = true;
    if (name !== 'baseline' && failures.length === 0) bad = true;
  }
  if (bad) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

```

Comando:

```sh
node /tmp/pr210-mutation-harness.cjs
cp /tmp/pr210-mutation-harness.cjs /tmp/pr210-mutation-harness-copy.cjs
node /tmp/pr210-mutation-harness-copy.cjs
```

Salida de ambas ejecuciones:

```text
baseline: GREEN (0 control failures)

M-A wrong RPC name: RED (2 control failures)
  - success-requires-publish-request-after-contact:
    actual {"ok":false,"code":"INVALID_STATE_TRANSITION"}
    expected {"ok":true,"data":{"requestId":"33333333-3333-4333-8333-333333333333","redirectTo":"/merchant/requests"}}
  - rpc-rejection-must-propagate:
    actual {"ok":false,"code":"INVALID_STATE_TRANSITION"}
    expected {"ok":false,"code":"SUBSCRIPTION_INACTIVE"}

M-B invert RPC result branch: RED (2 control failures)
  - success-requires-publish-request-after-contact:
    actual {"ok":false}
    expected {"ok":true,"data":{"requestId":"33333333-3333-4333-8333-333333333333","redirectTo":"/merchant/requests"}}
  - rpc-rejection-must-propagate:
    actual {"ok":true,"data":{"requestId":"33333333-3333-4333-8333-333333333333","redirectTo":"/merchant/requests"}}
    expected {"ok":false,"code":"SUBSCRIPTION_INACTIVE"}
```

Nota de autocontrol: el primer borrador del harness comparó objetos de distintos realms de `vm` con `deepStrictEqual` y produjo un falso RED de baseline. Esa salida se descartó; el harness definitivo compara el resultado serializado y el baseline queda GREEN.

## 4. CI

Run CI #899 — ID `37041778614`, SHA `fd660cb6690e66715825a95f289899a50d3fe2ad`.

Resumen observado:

```text
unit             success
db-tests         success
lint             success
build            success
audit            success
typecheck        success
bundle-budget    success
```

Vitest/coverage:

```text
Test Files  111 passed (111)
Tests       1653 passed (1653)
All files   Stmts 82.88 | Branch 81.59 | Funcs 77.12 | Lines 82.88
```

DB:

```text
All tests successful.
Files=13, Tests=1621
Result: PASS
```

Otros:

```text
verify-workflows: 47 pass / 0 fail
ADR:               6 pass / 0 fail
```

## 5. Vercel / E2E Preview

Vercel status del SHA: `success`.

Run e2e-preview ID `37041931472`:

```text
resolve-preview                 success
Verify Supabase Develop target success
Health check                    success
Run preview E2E gate            failure
```

Playwright:

```text
8 passed
1 failed

[chromium] e2e/specs/main-flow.spec.ts:377
Flujo 4: Ordenamiento de ofertas recibidas por documentación y precio

Expected substring: "E2E Courier Doc2 ..."
Received string:    "Repartidor"

main-flow.spec.ts:413
expect(orderDoc[0]).toContain(courier0Name);
```

El mismo caso falló en el intento inicial y en los dos retries.

Correlación externa verificada:

- issue #200 / CC-016 documenta exactamente que el comercio recibe `Repartidor` por la proyección/RLS de couriers;
- `docs/tasks/T-327.md` dice expresamente que Flow 4 seguirá bloqueado por #200 y el status dará failure hasta resolverlo.

No se debe usar T-328 para cambiar, saltear o debilitar ese E2E.
