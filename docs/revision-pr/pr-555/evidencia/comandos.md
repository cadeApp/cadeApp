# Evidencia y comandos — PR #555 / Ronda 1

**SHA inspeccionado:** `48ec95b3b86b502a4349ae789f5fb7f0b258a9c4`.

## Fuentes exactas y trazabilidad

- Ficha de `develop`: `docs/tasks/T-416.md`. La rama contiene la misma ficha (blob `7ba483a16a6706ef76c51d09ed55ac28d03b7eac`).
- Bitácora del HEAD: `docs/tasks/log/T-416.md`, sesión 2026-10-26.
- Tests nuevos: `src/domain/t416-zod-v4.test.ts`; `src/lib/zod-messages.test.ts`; `src/features/offers/t416-zod-v4.test.ts`; `src/features/requests/t416-zod-v4.test.ts`.
- Contrato: `src/domain/rpc-contracts.ts:22-24`; fecha ISO `z.string().datetime({ offset: true })`.
- CI actual `48ec95b3`: [run 40278168669](https://github.com/cadeApp/cadeApp/actions/runs/40278168669).
- E2E Preview actual cancelado: [run 40278273817](https://github.com/cadeApp/cadeApp/actions/runs/40278273817), status commit `e2e-preview=error`.
- Bundle base: [job 121409795479](https://github.com/cadeApp/cadeApp/actions/runs/40272927740/job/121409795479).
- Bundle PR: [job 121425674822](https://github.com/cadeApp/cadeApp/actions/runs/40278168669/job/121425674822).

## H01 · Prueba que falta y mutación independiente propuesta

**Control inicial en el SHA revisado (por inspección, sin ejecución local):**
- El test de fechas contiene positivos `2026-10-26T10:00:00.123456+00:00`, `2026-10-26T10:00:00-03:00` y `new Date().toISOString()`.
- Contiene negativos `2026-10-26T10:00:00`, `2026-10-26 10:00:00+00` y `ayer`.
- **No incluye** `2026-10-26T10:00:00+0300`. Por lo tanto, no afirma el comportamiento particular que D01=A exige proteger.

**Agregar dentro del `it` de fechas, con aserciones explícitas:**
```ts
expect(isoTimestampSchema.safeParse('2026-10-26T10:00:00+03:00').success).toBe(true);
expect(isoTimestampSchema.safeParse('2026-10-26T10:00:00+0300').success).toBe(false);
```

**Harness completo de mutación:** guardar el siguiente código como `/tmp/pr555-h01-mutation.mjs` y ejecutarlo desde la raíz del repositorio después de agregar las aserciones. No inventa mocks ni toca tests; el mutante permite exactamente un offset compacto previamente rechazado. Conserva el original en memoria y lo restaura en `finally`, sin `git checkout`, `rebase` ni `force`.

```js
#!/usr/bin/env node
// PR #555: control GREEN -> mutación en memoria (restauración de bytes) -> GREEN.
// Ejecutar desde raíz de un clon local del SHA que contiene el test +0300.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const file = resolve('src/domain/rpc-contracts.ts');
const original = readFileSync(file, 'utf8');
const needle = 'export const isoTimestampSchema = z.string().datetime({ offset: true });';
if (original.split(needle).length !== 2) throw new Error('Objetivo ausente o duplicado: no mutar.');
const mutant = [
  'export const isoTimestampSchema = z.union([',
  '  z.string().datetime({ offset: true }),',
  '  z.string().regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\+[0-9]{4}$/),',
  ']);',
].join('\n');
const bin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const args = ['exec', 'vitest', 'run', 'src/domain/t416-zod-v4.test.ts'];
function run(name) {
  const r = spawnSync(bin, args, { encoding: 'utf8', timeout: 180000 });
  const log = (r.stdout || '') + '\n' + (r.stderr || '');
  const sums = log.split(/\r?\n/).filter(x => /Test Files|Tests\s|FAIL|AssertionError|expected true to be false/.test(x));
  console.log(name + ': exit=' + r.status + '\n' + sums.slice(-12).join('\n'));
  if (r.error) throw r.error;
  return { code: r.status, log };
}
const before = run('GREEN control (sin mutar)');
if (before.code !== 0) throw new Error('El control inicial no está verde; no se acepta una mutación sin objetivo.');
try {
  writeFileSync(file, original.replace(needle, mutant), 'utf8');
  const red = run('Mutación: aceptar offset compacto +0300');
  if (red.code === 0) {
    console.log('P08 CONFIRMADO: la batería NO detecta el mutante (esperable antes del arreglo).');
    process.exitCode = 2;
  } else if (!/las fechas que devuelven Postgres y JS|Zod 4/.test(red.log)) {
    throw new Error('Rojo espurio; falla antes de llegar a la prueba objetivo.');
  } else {
    console.log('RED: la prueba de fecha detectó el mutante. Comprobar en log la aserción exacta.');
  }
} finally {
  writeFileSync(file, original, 'utf8');
  if (readFileSync(file, 'utf8') !== original) throw new Error('No se restauró el original.');
}
const after = run('GREEN final (restaurado)');
if (after.code !== 0) throw new Error('El árbol restaurado no queda verde.');

```

Comando para escribirlo (el bloque está autocontenido):
```bash
# Crear /tmp/pr555-h01-mutation.mjs con el bloque anterior.
node /tmp/pr555-h01-mutation.mjs
git diff -- src/domain/rpc-contracts.ts
pnpm exec vitest run src/domain/t416-zod-v4.test.ts
```

**Resultado de esta revisión:** no ejecutado; el entorno del revisor no puede resolver `github.com` con `git` y no contiene el repositorio ni `node_modules/zod`. En ningún lugar se presenta este RED como reproducido. Antes de agregar el test, el mutante debería quedar verde (control ciego); después debe fallar por la aserción `+0300` y volver a verde restaurando la fuente. Si falla por carga/import o por otra prueba, no cuenta como RED válido.

## H02 · Estado E2E

```text
Fuente: bitácora T-416 del HEAD revisado (autor)
E2E local Preview: 109 passed, 2 flaky; main-flow.spec.ts, timeouts que pasan en retry.
Estado GitHub e2e-preview de 48ec95b3: ERROR.
Workflow run 40278273817: e2e-preview CANCELLED.
```

La ejecución local no fue reproducida por la revisión. La siguiente sincronización del PR disparará su Preview automáticamente: no cancelarlo ni disparar workflows a mano; verificar el status del nuevo SHA.

## H03 · Comparación numérica de bundle

Se cruzaron 62 rutas presentes en ambos logs. **28 cambiaron, todas +13 kB**; no se observó reducción en el conjunto comparado. Ejemplos:

| Ruta | develop 24b2e37 | PR 48ec95b3 |
|---|---:|---:|
| `/courier/feed` | 250 kB | 263 kB |
| `/courier/offers` | 160 kB | 173 kB |
| `/merchant/dashboard` | 272 kB | 285 kB |
| `/merchant/requests/new` | 252 kB | 265 kB |
| `/login` | 250 kB | 263 kB |

El presupuesto de 180 kB reporta `Supera el límite` pero es advisory. Seguimiento [#561](https://github.com/cadeApp/cadeApp/issues/561). No se concluye que un chunk concreto sea culpable sin análisis adicional.

## CI disponible e insuficiencias

- Job `unit`, `48ec95b3`: `Test Files 181 passed (181)` y `Tests 3370 passed (3370)`, visto en log del job 121425320823.
- `audit`, job 121425320820: `+ zod 4.6.7` y `Severity: 3 moderate`; no aparece el aviso GHSA alto.
- `bundle-budget`: green en GitHub pero warnings cuantitativos en el log.
- `db-tests`: el job del SHA actual seguía en progreso al revisar. No se levanta Docker ni Supabase remoto.
- `approval-policy`: failure antes de publicar ronda y comentario. No implica una falla de código.
- Reportes RED declarados en bitácora (UUID, mensajes) **no reproducidos por el revisor**; quedan atribuidos a autor, no al verificado_en_sha.

### Comandos a ejecutar en próxima ronda sobre SHA limpio

```bash
git fetch origin
git ls-remote origin feat/T-416-zod-v4
git diff origin/develop...HEAD --name-only
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
pnpm exec vitest run src/domain/t416-zod-v4.test.ts
pnpm typecheck && pnpm lint && pnpm test
# Leer jobs de CI para build, db-tests, bundle y audit del SHA exacto; no levantar Docker.
```

Si la evidencia del autor de RED no se puede reproducir, registrarlo en ronda 2, no firmar verificado. No falsificar ni relajar tests para que queden verdes.

---

## Evidencia de ronda 2 — 2026-10-26

- HEAD exacto inspeccionado: `08e3a6804fa5a191085d93c168c2421191dccfb1`. SHA funcional con tests y E2E: `ad035c64c833ccbacec4bc1d8ac8cdb52e0ac681`.
- `compare(722f3c20..ad035c64)`: únicamente `src/domain/t416-zod-v4.test.ts` (test corregido) y `docs/tasks/log/T-416.md`.
- `compare(ad035c64..08e3a680)`: únicamente `docs/tasks/log/T-416.md` (+4, -1), sin cambios de comportamiento.
- `src/domain/t416-zod-v4.test.ts`: caso positivo `+03:00` y negativo `+0300` prueban el `isoTimestampSchema` real de `rpc-contracts.ts`. Se conserva `z.string().datetime({offset:true})`.
- `unit` sobre `ad035c64`: [job 121430315772](https://github.com/cadeApp/cadeApp/actions/runs/40279643780/job/121430315772), salida textual: `Test Files 181 passed (181)` y `Tests 3370 passed (3370)`.
- `audit` sobre `ad035c64`: [job 121430315532](https://github.com/cadeApp/cadeApp/actions/runs/40279643780/job/121430315532), `+ zod 4.6.7`, `Severity: 3 moderate`, sin alto GHSA-mrhx-c7xc-m3w5.
- `db-tests` sobre `ad035c64`: [job 121430315753](https://github.com/cadeApp/cadeApp/actions/runs/40279643780/job/121430315753), success, paso local RPC/RLS success, paso `git diff --exit-code -- src/types/database.types.ts` success; mutaciones RED intencionales en logs de otras tareas no implican failure del job.
- `e2e-preview` sobre `ad035c64`: [job 121430325812](https://github.com/cadeApp/cadeApp/actions/runs/40279765486/job/121430325812), `Running 111 tests` → `111 passed (29.6m)`, luego `Running 6 tests` → `6 passed (2.7m)`. Commit status `e2e-preview=success`.
- `08e3a680` CI solo documental al consultar: unit/typecheck/lint/build/audit/bundle-budget success, db-tests y e2e-preview pendientes; approval-policy failure antes del comentario R2. No se requiere otra corrida verde por edición exclusiva de bitácora.

**Harness independiente:** sigue disponible íntegro en la sección H01 de este archivo, para un entorno con `pnpm` y clon funcional; **no se ejecutó** esta ronda. La batería RED del autor de sesión 2 no sustituye una ejecución propia. No se usaron mocks, cambios de assertions ni tests simulados.

**Limitaciones operativas de R2:** GitHub se consultó por el conector; el intento local `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` terminó `Could not resolve host: github.com`. Por ello tampoco se pudo correr `node docs/revision-pr/analizar.mjs verificacion` ni `git merge-tree`. Se comprobó la estructura y los campos de `hallazgos.jsonl` al preparar este commit y GitHub informa `mergeable=true`.
