# Evidencia y comandos reproducibles — PR #735 · ronda 1

**Head inspeccionado:** `603fa9a0d6d9d930361b93282a88b6853bef6a5d`; base `develop@2cd76f24`. La PR modifica solo documentos. **No se ejecutó Supabase remoto, no se leyó ningún secreto, no se corrieron migraciones ni se creó una falsa captura.**

## Comprobación por lectura realizada (GitHub conectado)

- `docs/contracts/CC-051.md:47`: exige INSERT de courier.
- `supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql:235-245,361`: inserta `draft` y luego ejecuta `request_cycle('publish_request')`; `supabase/migrations/20261009200000_t340_multi_drop.sql:910-922`: publica por UPDATE.
- `CC-051.md:59,66,70-76,85-90,111,143-151`: control positivo UPDATE, gate de cuatro controles, reacción a cualquier clave, negativo inmediato, rollback a todas las columnas y positivo que no sobrevive al filtrado.
- `docs/tasks/T-435.md:58-70`: repite la expectativa de courier INSERT y el criterio negativo inmediato.
- `e2e/fixtures/roles.ts:29-61`: arnés siembra un request, merchant, dos couriers y limpia por `finally`.

## Reproducción local del detector de contradicciones documentales

Copiar este **bloque completo** en una terminal en la raíz del clon, en el SHA de la revisión. Es un harness de inspección que **no toca archivos del repo ni llamadas a base**. El guard `--assert-clean` debe fallar con el contrato original y quedar verde tras corregir los documentos; no sustituye los E2E de la futura PR.

```bash
set -eu
cat >/tmp/pr735-doc-audit.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const cc = fs.readFileSync('docs/contracts/CC-051.md', 'utf8');
const task = fs.readFileSync('docs/tasks/T-435.md', 'utf8');
const sql = fs.readFileSync('supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql', 'utf8');
assert(sql.includes("'draft', v_pickup_zone_id"));
assert(sql.includes("request_cycle('publish_request'"));
const bad = [
  ['H01', /\*\*INSERT:\*\*\s*el repartidor aprobado[\s\S]{0,130}recibe la solicitud que publica/i.test(cc) || task.includes('el repartidor aprobado suscripto a `INSERT` recibe')],
  ['H02', /5\.\s*\*\*Control positivo:\*\*[^\n]*UPDATE/.test(cc) && !/5\.\s*\*\*Control positivo:\*\*[^\n]*INSERT/.test(cc)],
  ['H03', /espera a que el control del caso autorizado sí reciba el suyo y después confirma que el\s*\n\s*canal no autorizado no recibió nada/.test(cc)],
  ['H04-gate', cc.includes('Si los cuatro controles pasan')],
  ['H04-negativos', cc.includes('controles 1 a 4 de §Propuesto, cada uno con su aserción sobre `Object.keys`')],
  ['H06-rollback', cc.includes('Rollback: volver a agregar la tabla sin lista de columnas')],
];
for (const [id, found] of bad) process.stdout.write(id + ': ' + (found ? 'RED (contradicción)' : 'sin literal contradictorio') + '\n');
const count = bad.filter(([, v]) => v).length;
console.log('contradicciones literales:', count);
if (process.argv.includes('--assert-clean')) assert.equal(count, 0, 'corregir primero los hallazgos; no debilitar el detector');
NODE
node /tmp/pr735-doc-audit.cjs
if node /tmp/pr735-doc-audit.cjs --assert-clean; then
  echo 'Control literal sin contradicciones (no sustituye la revisión humana)'
else
  echo 'RED esperado en el head original: el contrato requiere correcciones'
fi
```

**Salida de lectura reproducida por revisión conectada (regex equivalente sobre el SHA):** H01 RED; H02 RED; H03 RED; H04-gate RED; H04-negativos RED; H06-rollback RED. Se detectó además que la ficha repite H01/H03. No se dispone de clon local en este entorno para ejecutar exactamente el heredoc anterior; **no se afirma haberlo ejecutado**.

**Mutaciones independientes, en memoria y sin efecto en Develop:** reemplazar la expectativa literal de courier INSERT por merchant INSERT → se apaga H01; reemplazar el «inmediatamente después del positivo» por ventana/barrera independiente → se apaga H03; reemplazar «rollback a todas las columnas» por rollback fail-closed → se apaga H06. Las tres se verificaron en texto extraído del SHA con el conector GitHub. Son **detectores semánticos parciales de documentos, no pruebas RED→GREEN de RLS/Realtime.** El revisor debe leer el texto corregido en ronda 2; **prohibido editar el detector o inventar tests solo para pasar en verde**.

## Matriz de oráculos para la implementación posterior (no ejecutar en esta PR)

| Escenario | Evento exigido | Positivos | Negativos | Fuente de verdad |
|---|---|---|---|---|
| RPC real `create_and_publish_multi_drop` | `UPDATE` a published; inspeccionar INSERT si aparece | Courier, merchant y service_role reciben UPDATE de ese ID | Anon no recibe | RPC real + estado persisted |
| Borrador sintético post-SUBSCRIBED | `INSERT` a draft con ambas columnas no nulas | Merchant ve evento sin claves; service_role ve evento y ambas claves/marker | Courier no recibe | Admin SELECT con valores originales |
| Published con marker artificial | `UPDATE` de ese ID | Courier y merchant ven evento sin claves; service_role ve valor en modo publicación completa | Anon no recibe | Admin SELECT + correlación de evento |
| Fuga y allowlist CC-023 §5 | Evento público sí; claves privadas nunca | Service_role ve columnas públicas; admin SELECT demuestra dato fuente; pgTAP `attnames` | Ningún actor recibe claves privadas | SQL publicación + RLS + E2E |

En negativos: corroborar `SUBSCRIBED` y autorización vía PostgREST; esperar la barrera de evento positivo correlacionado y después una **ventana acotada** no basada en un `expect.poll` que se resuelva inmediatamente; afirmar 0 eventos del ID/tipo. En positivos: verificar `eventType`, ID, `updated_at`/marcador público inequívoco, claves y JSON sin valores privados donde se prohíben. Log solo `Object.keys(payload.new).sort()`, jamás el payload ni el marker. Al fallar una comparación de contenido, informar booleanos, no valores. Hacer `removeChannel` en `finally` y `trackEntityForCleanup` del nuevo draft, restaurando las dos columnas legacy a null.

## Comandos para la futura ronda (solo cuando no haya bloqueantes)

```bash
git fetch origin
git rev-parse HEAD
git diff origin/develop -- docs/tasks/T-435.md
git merge-tree --write-tree origin/develop HEAD
node docs/revision-pr/analizar.mjs verificacion
pnpm exec vitest run tools
# En la PR de implementación, solo vía e2e-preview CI: capturas Realtime en Develop
```

No usar Supabase/Docker local, no invocar workflows manualmente, no emitir credenciales, no push a develop ni force.



---

# Ronda 2 — 2026-11-12 — verificación documental independiente

**Head fuente:** `b48fe8be3a80f7e0a4d879602a7a192c7ddb2bd5`. Se consultó directamente GitHub para obtener CC-051 y T-435 del SHA, comparación del commit de autor con `2258f70f`, R1 inmutable y árbol de `develop`. No se accedió a Supabase ni a env/secrets. **La prueba de abajo es de documentos; no representa un E2E Realtime ni una mutación SQL.**

## Reproducción del oráculo de la ronda 1

Se ejecutaron en un entorno JavaScript de revisión los seis detectores del script R1 (mismo código de predicados) sobre el contenido original y el actual:

```text
R1 sobre 603fa9a0: H01 RED, H02 RED, H03 RED, H04-gate RED, H04-negativos RED, H06-rollback RED → 6
R2 sobre b48fe8be: H01 GREEN, H02 GREEN, H03 GREEN, H04-gate GREEN, H04-negativos GREEN, H06-rollback GREEN → 0
```

Este resultado muestra que desaparecieron las contradicciones **literales** de R1. Se hizo además inspección semántica y una batería nueva, independiente de la que pudiera haber usado el autor. No es una garantía de corrección del futuro E2E.

## Harness completo nuevo (copiar a /tmp desde el clon, sin tocar el repo)

```bash
set -eu
cat >/tmp/pr735-r2-doc-audit.cjs <<'NODE'
'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const cc = fs.readFileSync('docs/contracts/CC-051.md', 'utf8');
const task = fs.readFileSync('docs/tasks/T-435.md', 'utf8');
const data = { cc, task };
const checks = [
  ['H01', d => d.cc.includes('A **tiene que recibir el UPDATE** a `published`') && d.cc.includes('No se\n     exige que llegue.') && d.task.includes('Si también recibe un INSERT de esa solicitud'),
    d => ({ ...d, cc: d.cc.replace('A **tiene que recibir el UPDATE** a `published`', 'A podría recibir el UPDATE a `published`') })],
  ['H02', d => d.cc.includes('S recibe **ese INSERT** con las dos claves y el marcador') && d.task.includes('registrado con `trackEntityForCleanup`') && d.cc.includes('después de los `SUBSCRIBED`'),
    d => ({ ...d, cc: d.cc.replace('S recibe **ese INSERT** con las dos claves y el marcador', 'S podría recibir ese INSERT') })],
  ['H03', d => d.cc.includes('**Barrera causal:**') && d.cc.includes('**Ventana negativa acotada:**') && d.cc.includes('conteo de eventos de ese ID y tipo es 0') && d.task.includes('por PostgREST con cada token'),
    d => ({ ...d, cc: d.cc.replace('**Ventana negativa acotada:**','**Chequeo inmediato:**') })],
  ['H04', d => d.cc.includes('pasan toda la matriz, el control positivo de origen') && d.cc.includes('solo cuenta si un **actor restringido**') && d.cc.includes('No hay `Object.keys` sobre un payload que no existe'),
    d => ({ ...d, cc: d.cc.replace('solo cuenta si un **actor restringido**', 'cuenta si cualquier actor') })],
  ['H05', d => d.cc.includes('**Modo allowlist') && d.cc.includes('S comprueba por SELECT directo') && d.cc.includes('**sin** las excluidas') && !/Si la ausencia de claves se viera también en el suscriptor con service role, el problema es de la prueba/i.test(d.task),
    d => ({ ...d, task: d.task.replace(/Si la ausencia de claves se viera también en el suscriptor con service role, el problema es de la prueba/i, 'En publicación completa, la ausencia de marcador en S invalida el control; en allowlist la ausencia de claves excluidas en S es esperada') })],
  ['H06', d => d.cc.includes('**Rollback fail-closed:**') && d.cc.includes('nunca se vuelve automáticamente a publicar la tabla sin lista de columnas') && d.cc.includes('retira **solo** `delivery_requests`') && d.cc.includes('`public.offers` se conserva siempre'),
    d => ({ ...d, cc: d.cc.replace('nunca se vuelve automáticamente a publicar la tabla sin lista de columnas', 'se vuelve automáticamente a publicar la tabla sin lista de columnas') })],
  ['H07', d => d.cc.includes('el `finally` vuelve las dos columnas viejas a null') && d.cc.includes('quita **todos** los canales') && d.cc.includes('**nombres** de las claves recibidas') && d.task.includes('trackEntityForCleanup'),
    d => ({ ...d, cc: d.cc.replace('quita **todos** los canales', 'quita solo el canal courier') })],
];
let failure = false;
for (const [id, check, change] of checks) {
  const good = check(data);
  const mutant = check(change(data));
  console.log(id, good ? 'GREEN' : 'RED', '| mutación adversa/reescritura:', mutant ? 'GREEN' : 'RED');
  if (id === 'H05') {
    // En el head b48fe8be el original es RED: queda la nota incondicional.
    // La reescritura contrafactual del H05 produce GREEN. Tras la corrección
    // del autor original GREEN, y este test debe adaptarse a una mutación que la rompa.
    if (process.argv.includes('--assert-closed') && !good) failure = true;
  } else {
    if (!good || mutant) failure = true;
  }
}
if (failure) process.exitCode = 1;
NODE
node /tmp/pr735-r2-doc-audit.cjs
```

**Salida realmente comprobada por el revisor sobre texto servido por GitHub en `b48fe8be3a80f7e0a4d879602a7a192c7ddb2bd5` (mismos predicados):**

```text
H01 GREEN / mutación RED
H02 GREEN / mutación RED
H03 GREEN / mutación RED
H04 GREEN / mutación RED
H05 RED / reescritura de nota GREEN
H06 GREEN / mutación RED
H07 GREEN / mutación RED
```

**Límites y cautelas:**
- Se comprobó por ejecución de JavaScript en el entorno de revisión sobre los documentos obtenidos del SHA, no con un clon/git. La ejecución exacta del heredoc en `/tmp` queda documentada para quien tenga el clon; **no se afirma haberla hecho aquí**. Los detectores semánticos parciales se cruzaron con inspección humana; ningún resultado implica que un payload real esté filtrado.
- La reescritura del H05 es una **reparación contrafactual en memoria**, no una mutación adversa: por eso aparece RED → GREEN. **No se cambió T-435** por el revisor: quien ajuste esa frase no debe firmarse su propia verificación.
- La ronda 3 debe correr el harness original sin modificar, e inventar nuevas mutaciones adversas para el arreglo del H05 (por ejemplo, reintroducir el veto absoluto en allowlist): el autor nunca edita `docs/revision-pr/**`.
