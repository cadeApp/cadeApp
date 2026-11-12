# Evidencia y comandos — PR #698 · Ronda 1

## Fuentes y resultados que se pudieron verificar

SHA `e77beb59` (código `c26f7673`), base `develop@28de2b98`. Inspección Github de archivos exactos. Logs CI GREEN `43165418123`: `unit` 204/204 archivos, 3860/3860; `db-tests` 46 archivos, 3858 pgTAP (CC-049 57/57), primera aplicación preserva E01/E08, typecheck/lint/build/audit/bundle-budget SUCCESS; paso `git diff --exit-code -- src/types/database.types.ts`. RED pre-migración `43164852008`: CC-049 falla 19/21 antes de corte.

| Mutación del autor | SHA | Run | Evidencia vista en log |
|---|---|---|---|
| #699 grant | `37ff5662` | [43166846365](https://github.com/cadeApp/cadeApp/actions/runs/43166846365) | fallan 8–9,25–30 pgTAP |
| #700 policy | `55daf59d` | [43166858170](https://github.com/cadeApp/cadeApp/actions/runs/43166858170) | fallan 1–7 pgTAP |
| #701 RPC sin helper | `adf80fb7` | [43166868060](https://github.com/cadeApp/cadeApp/actions/runs/43166868060) | fallan 44–56 pgTAP |
| #702 host sin anclar | `f2cc5a97` | [43166879691](https://github.com/cadeApp/cadeApp/actions/runs/43166879691) | E09/E13 pgTAP y Vitest helper/schema/fake/emisor |
| #703 emisor sin filtro | `0f21efb7` | [43166894445](https://github.com/cadeApp/cadeApp/actions/runs/43166894445) | falla Vitest de endpoints bloqueados |
| #704 timeout de socket | `32958169` | [43166904662](https://github.com/cadeApp/cadeApp/actions/runs/43166904662) | falla goteo y cleanup en transport.test.ts |
| #705 RED-DELETE | `df7826c7` | [43166916875](https://github.com/cadeApp/cadeApp/actions/runs/43166916875) | preservación E08 falla |
| #706 RED-TIMESTAMP | `e67060b9` | [43166930287](https://github.com/cadeApp/cadeApp/actions/runs/43166930287) | comparación last_seen_at falla |

Todas #699–#706 están **cerradas sin merge**. No son mutaciones independientes del revisor.

## H01 y H02: mutaciones independientes **pendientes de ejecución**

**H01:** en `src/app/api/push/send/route.ts`, solo durante prueba de sensibilidad, reemplazar el retorno de `NextResponse.json({ ok: true, result })` por retorno de `{ ok:true, result:{...result, attempts:result.attempts.map(a => a.outcome === 'blocked' ? {...a, endpoint:'https://push.example.com/leak'} : a)} }`. `route.test.ts` nuevo debe fallar en su igualdad exacta / `Object.hasOwn`. Restaurado: GREEN.

**H02:** en `src/server/push/sender.ts`, alterar temporalmente `if (status >= 200 && status < 300)` a `if (status >= 200 && status < 400)`. El caso 302 de `push.test.ts` debe fallar por `sentCount`/`failedCount`, no setup. Restaurado: GREEN. Incluir casos frontera 300 y 399 es recomendable.

### Harness completo de inspección estructural

El siguiente script **no muta el repo**, examina el árbol de un SHA (no interpreta el resultado como Vitest). Para reproducirlo en un clon, copiá **todo** el bloque a terminal. Puede ejecutarse desde cualquier ruta pasando `REPO_DIR`; el control de e77 espera ausencia de tests H01/H02. Es una comprobación de contenido, **no** un sustituto de RED/GREEN real.

```bash
cat >/tmp/pr698-r1-inspeccion.mjs <<'NODE'
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const sha = process.argv[2] ?? 'e77beb59c753b36584d0bf504a3181dcb89515c9';
const cwd = process.argv[3] ?? process.cwd();
function read(path) {
  return execFileSync('git', ['show', sha + ':' + path], { cwd, encoding: 'utf8' });
}
const route = read('src/app/api/push/send/route.ts');
const routeTest = read('src/app/api/push/send/route.test.ts');
const sender = read('src/server/push/sender.ts');
const emitterTest = read('src/server/push/push.test.ts');
const transportTest = read('src/server/push/transport.test.ts');
assert.match(route, /NextResponse\.json\(\{ ok: true, result \}\)/);
assert.match(sender, /status\s*>=\s*200\s*&&\s*status\s*<\s*300/);
assert.ok(!routeTest.includes("outcome: 'blocked'"), 'H01 ya cubierto: releer SHA');
assert.match(emitterTest, /Object\.hasOwn\(attempt, 'endpoint'\)/);
const matrix = emitterTest.slice(emitterTest.indexOf("describe('PR91-H05:"), emitterTest.indexOf("describe('Casos de borde"));
assert.ok(!/\b302\b/.test(matrix), 'H02 ya cubierto: releer SHA');
assert.ok(transportTest.includes('un 3xx es un fallo'), 'debe existir prueba de 302 no redirigido');
console.log('INSPECCIÓN: H01 sin blocked en route.test y H02 sin 302 en matriz del emisor');
console.log('No prueba RED/GREEN de mutación ni ejecuta Vitest.');
NODE
node /tmp/pr698-r1-inspeccion.mjs e77beb59c753b36584d0bf504a3181dcb89515c9
```

**Ejecución:** no se pudo ejecutar este script contra un clon en esta sesión: `git ls-remote` falló con `Could not resolve host: github.com`. El control se verificó por inspección directa de archivos con la conexión GitHub. No afirmar que el script copiado a /tmp fue ejecutado. Para ejecutar sobre nuevo SHA: el chequeo de ausencia **deberá fallar** por tests agregados; usar pruebas Vitest para verificar efecto real.

## Comandos para agy y ronda 2

```bash
git fetch origin
git ls-remote origin feat/T-432-sec07-push-hardening
git diff --name-only origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run src/app/api/push/send/route.test.ts src/server/push/push.test.ts >/tmp/pr698-control.log 2>&1
grep -E 'Test Files|Tests ' /tmp/pr698-control.log | tail -4
# Ejecutar las dos mutaciones SOLO temporalmente y capturar la MISMA línea de resumen para RED.
# Restaurar el código sano desde una copia en memoria/scratch, NO con git checkout.
pnpm typecheck && pnpm lint && pnpm test
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
git status --short
```

No levantar Supabase/Docker local, no acceder a secretos ni servicios remotos. CI db-tests sustituye base local. Si `clients.test.ts` hace timeout por carga, ejecutar sola antes de atribuir una regresión.
