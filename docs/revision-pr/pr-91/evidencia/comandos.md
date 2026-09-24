# Evidencia — PR #91 / T-203 — Ronda 1

- **SHA producto revisado:** `038faab20a32fe5d468eede1310d45eb8a570c61`
- **develop al revisar:** `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121`
- **Fecha:** 2026-09-24
- **Entorno:** sesión cloud; acceso al árbol remoto por GitHub, sin checkout ejecutable.

## 1. Estado remoto

PR #91: abierta, no Draft, no mergeada, `mergeable=true`, rama `feat/T-203-emisor-push`, head `038faab`; comparación contra `develop`: ahead 4, behind 0.

Archivos cambiados antes de la revisión:

```text
docs/tasks/T-203.md
docs/tasks/log/T-203.md
package.json
pnpm-lock.yaml
src/app/api/push/send/route.test.ts
src/app/api/push/send/route.ts
src/app/api/push/subscriptions/route.test.ts
src/app/api/push/subscriptions/route.ts
src/server/push/database-client.test.ts
src/server/push/index.ts
src/server/push/push.test.ts
src/server/push/sender.ts
```

`docs/revision-pr/pr-91/` no existía en el SHA revisado.

## 2. Diff de ficha oficial vs rama

`develop:docs/tasks/T-203.md`:

```text
Archivos permitidos:
- src/server/push/**
- src/app/api/push/**
- supabase/migrations/**
- docs/tasks/T-203.md
- docs/tasks/log/T-203.md
- docs/revision-pr/**

Dependencias nuevas permitidas:
- ninguna
```

`038faab:docs/tasks/T-203.md` agrega:

```text
- package.json
- pnpm-lock.yaml
...
Dependencias nuevas permitidas:
- web-push (autorizado por Lautaro073 según regla 25 y ADR-0001/0002)
```

La regla 25 sí contiene `web-push (T-203)`, lo que confirma que hay una inconsistencia de la ficha original; no cambia cuál es la fuente de alcance durante esta revisión.

## 3. Historial de fase roja

Commits de la PR:

```text
aa89372 chore(T-203): start task [T-203]
c3e7ba4 feat(push): implement push sender and subscription routes [T-203]
3179538 fix(push): remove 'as any' in test mocks [T-203]
038faab docs(T-203): session log
```

`aa89372` contiene solo `docs/tasks/log/T-203.md` y `src/server/push/push.test.ts`; `src/server/push/sender.ts` no existe en ese SHA. Por tanto el archivo de tests falla antes de ejecutar sus aserciones al resolver `./sender`.

La bitácora de ese SHA deja `test n.a.`. La entrada final solo registra el verde, sin salida roja por mutación semántica.

## 4. Barrido del fallo del Juez

Fuente: `.el-consejo/revision-1/adjudication/push-notification-implementation-scope.json` en `develop`.

Obligaciones backend relevantes y estado observado:

```text
1. push_subscriptions por usuario/dispositivo + alta/baja dueño-solo -> parcial: route existe; platform no se escribe
2. emisor Node + Web Push/VAPID                                  -> sí
3. disparo desde transición real después de commit               -> no hay call site de producción
4. lifecycle: upsert/apertura, inválida, logout, disable courier  -> parcial: upsert + 404/410; faltan logout/disable
5. payload mínimo tipo+id sin PII                                 -> código actual sí; tests 2/5 variantes
   registrar resultado + código de respuesta                      -> conteos sí; status HTTP por intento no
```

El árbol existente `src/server/rpc/requests.ts`, `src/server/rpc/offers.ts` y `src/server/cron/sweep.ts` no contiene referencias a push/notify. Como `safeNotifyPostTransition` nace en esta PR y el diff no toca esos archivos, no existe cableado de producción.

## 5. Intento de checkout local

```bash
git clone --filter=blob:none --no-checkout https://github.com/cadeApp/cadeApp.git /tmp/cadeapp-pr91
```

Salida:

```text
Cloning into '/tmp/cadeapp-pr91'...
fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/': Could not resolve host: github.com
```

Consecuencia: no se atribuye ejecución independiente de `pnpm typecheck`, `pnpm lint`, `pnpm test` ni del arnés de Vitest. CI tampoco se inspeccionó por existir bloqueantes. No se levantó Supabase/Docker local.

## 6. Batería de mutaciones del revisor

Arnés preparado para ejecutar desde la raíz de un checkout limpio del SHA revisado. Muta una sola coincidencia, corre solo la suite push y restaura bytes desde memoria en `finally`.

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const S = 'src/server/push/sender.ts';
const T = 'src/server/push/push.test.ts';

const M = {
  X00_control: [],

  // H02: el test post-commit debe detectar que el helper deja de intentar el envío.
  X01_safe_notify_noop: [[
    S,
    '    await sendPushNotification(userIds, event, options);',
    '    return;',
  ]],

  // H03: un 410 real de web-push llega por rejection/statusCode.
  X02_webpush_rethrows_status: [[
    S,
    '        return { status: err.statusCode };',
    '        throw err;',
  ]],

  // H04: romper solo una variante de la unión; las otras no deben servir de proxy.
  X03_offer_submitted_passthrough: [[
    S,
    `  z\n    .object({\n      event: z.literal('offer_submitted'),\n      requestId: z.string().uuid(),\n      offerId: z.string().uuid(),\n    })\n    .strict(),`,
    `  z\n    .object({\n      event: z.literal('offer_submitted'),\n      requestId: z.string().uuid(),\n      offerId: z.string().uuid(),\n    })\n    .passthrough(),`,
  ]],

  // H05: 429 no significa suscripción inválida/expirada.
  X04_delete_429: [[
    S,
    '      } else if (status === 410 || status === 404) {',
    '      } else if (status === 410 || status === 404 || status === 429) {',
  ]],

  // H05: la clase de éxito no es solo 201.
  X05_only_201_is_success: [[
    S,
    '      if (status >= 200 && status < 300) {',
    '      if (status === 201) {',
  ]],
};

const name = process.argv[2];
if (!name || !(name in M)) {
  console.error(`uso: node /tmp/mut-pr91.mjs ${Object.keys(M).join('|')}`);
  process.exit(2);
}

const originals = new Map([[S, readFileSync(S)]]);
try {
  for (const [file, from, to] of M[name]) {
    const text = readFileSync(file, 'utf8');
    const count = text.split(from).length - 1;
    if (count !== 1) {
      console.error(`${name}: SIN OBJETIVO (${count}) en ${file}`);
      process.exitCode = 2;
      break;
    }
    writeFileSync(file, text.replace(from, to));
  }

  if (process.exitCode !== 2) {
    let out = '';
    try {
      out = execSync(
        'pnpm exec vitest run src/server/push src/app/api/push --testTimeout 15000 2>&1',
        { encoding: 'utf8' }
      );
    } catch (error) {
      out = error.stdout ?? String(error);
    }
    const summary = out.split('\n').find((line) => /^\s+Tests\s/.test(line)) ?? '(sin línea Tests)';
    console.log(`${name}: ${summary.trim()}`);
  }
} finally {
  for (const [file, bytes] of originals) writeFileSync(file, bytes);
}
```

Expectativa que debe verificarse en el arreglo:

```text
X00_control                    -> verde
X01_safe_notify_noop           -> rojo
X02_webpush_rethrows_status    -> rojo
X03_offer_submitted_passthrough-> rojo
X04_delete_429                 -> rojo
X05_only_201_is_success        -> rojo
```

En `038faab`, por inspección de dependencias de las aserciones, X01–X05 no tienen una aserción que observe directamente la propiedad mutada. Esta sesión **no inventa** una línea `Tests ...` como si se hubiera ejecutado: deberá reproducirse en el checkout de quien arregle.

## 7. Validación del artefacto de revisión

Se validó `hallazgos.jsonl` parseando las 8 líneas como JSON. El comando canónico del repo `node docs/revision-pr/analizar.mjs verificacion` debe correrse en un checkout tras traer este commit; no pudo ejecutarse en esta sesión por no disponer del árbol local completo.
