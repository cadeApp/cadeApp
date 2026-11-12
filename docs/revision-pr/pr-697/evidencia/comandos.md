# Evidencia y comandos reproducibles — PR #697 / Ronda 1

**Objeto:** revisión de documentos en `b9f0bb12` contra `develop@9dafedab`. No se corrió Supabase/Docker local o remoto, ni GitHub workflows manuales, ni endpoints push remotos.

## Consultas de fuente

- PR: https://github.com/cadeApp/cadeApp/pull/697
- Diff: https://github.com/cadeApp/cadeApp/pull/697/files
- SQL actual: `supabase/migrations/20260925170000_cc007_consent_enforcement.sql:311-315` y `supabase/migrations/20261020123000_cc035_register_push_subscription.sql` en `9dafedab`.
- Emisor y tipo: `src/server/push/sender.ts:130-134, 250-262, 274-356` en `9dafedab`.
- Dependencia exacta: https://raw.githubusercontent.com/web-push-libs/web-push/v3.6.7/src/web-push-lib.js, líneas 205-207, 292-294, 329-330, 341-379. `httpsOptions.timeout` tiene semántica de timeout de socket, no límite de vida del request.

## Arnés completo de contraejemplos (independiente)

Se ejecutó con Node `v22.16.0`. Para repetir: copiá **solo** el bloque siguiente a `/tmp/cc049-counterexamples.mjs` y ejecutá `node /tmp/cc049-counterexamples.mjs`. Usa loopback 127.0.0.1, **no abre conexiones externas**. H01/H02 son modelos lógicos que muestran limitaciones de los tests prometidos; NO simulan PostgreSQL ni certifican seguridad de la implementación. H03 demuestra la semántica de timeout de `http(s).request`; no ejecuta el paquete `web-push`.

```js
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

// H01: contraejemplo lógico. No ejecuta PostgreSQL ni representa sus policies reales.
const acceptsDirectWrite = ({ grant, policy }) => grant && policy;
const deniedByRls = { grant: true, policy: false };
assert.equal(acceptsDirectWrite(deniedByRls), false);
console.log('H01: GREEN (bypass de escritura denegado incluso con grant restituido).');
assert.equal(deniedByRls.grant, true);
console.log('H01: RED del control de grants: authenticated conserva INSERT indebidamente.');

// H02: contraejemplo lógico. Repetir DELETE durante un test puede ocultar la ausencia del DELETE migratorio.
const migrationActuallyCleaned = false;
const rows = [{ endpoint: 'allowed', allowed: true }, { endpoint: 'invalid', allowed: false }];
const observedRows = migrationActuallyCleaned ? rows.filter(x=>x.allowed) : rows;
const afterTestOwnDelete = observedRows.filter(x => x.allowed);
assert.deepEqual(afterTestOwnDelete, [{ endpoint:'allowed', allowed:true }]);
assert.equal(migrationActuallyCleaned, false);
console.log('H02: GREEN del test de DELETE rehecho, aunque no haya limpieza en migración.');

// H03: comportamiento real de timeout de socket de Node, con servidor HTTP de loopback.
// HTTP en vez de HTTPS solo ilustra semántica de http(s).request({timeout}). No hay endpoint remoto.
const server = http.createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  let n = 0;
  const interval = setInterval(() => {
    res.write('.');
    if (++n === 18) { clearInterval(interval); res.end(); }
  }, 30);
  res.on('close', () => clearInterval(interval));
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const address = server.address();
  assert(address && typeof address !== 'string');
  const t0 = performance.now();
  const status = await new Promise((resolve, reject) => {
    const req = http.request({ host:'127.0.0.1', port:address.port, timeout:110 }, res => {
      res.resume(); res.once('end', () => resolve(res.statusCode));
    });
    req.on('timeout', () => req.destroy(new Error('Socket timeout')));
    req.on('error', reject);
    req.end();
  });
  const elapsed = Math.round(performance.now() - t0);
  assert.equal(status, 200);
  assert(elapsed > 300, 'el servidor alimentó el socket sin pausas mayores a timeout');
  console.log('H03: GREEN de socket timeout de 110 ms; respuesta duró ' + elapsed + ' ms (> 300 ms).');
} finally {
  server.close();
  await once(server, 'close');
}
```

### Salida observada

```text
H01: GREEN (bypass de escritura denegado incluso con grant restituido).
H01: RED del control de grants: authenticated conserva INSERT indebidamente.
H02: GREEN del test de DELETE rehecho, aunque no haya limpieza en migración.
H03: GREEN de socket timeout de 110 ms; respuesta duró 559 ms (> 300 ms).
```

*La duración de H03 depende del scheduler; no se exige exactamente 559 ms. La palabra RED en H01 es una **contradicción de un invariante lógico**, no el resultado de una ejecución pgTAP roja.*

## Controles a ejecutar al arreglar la PR documental (no ejecutados aquí)

```bash
git pull origin feat/T-432-sec07-push-hardening
git diff --check
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
git ls-remote origin feat/T-432-sec07-push-hardening
```

## Experimentos requeridos en la futura PR de implementación (no ejecutados)

1. En `supabase/tests/cc049_push_subscriptions_hardening.sql`: asserts `has_table_privilege` de INSERT/UPDATE/ TRUNCATE para `authenticated` y `anon`. **Mutación RED-GRANT**: volver a conceder INSERT/UPDATE con RLS cerrada; deben fallar las aserciones de grants, no necesariamente el bypass.
2. En la misma suite: intentos directos por columna bajo `authenticated` con grants temporalmente abiertos y policy permisiva temporal para probar cada barrera (rollback al finalizar transacción). **Mutación RED-RLS**: restaurar policy write propia con grant presente; deben observarse escrituras reales y quedar en rojo casos de prohibición. No concluir a partir de solo `0 rows` sin comprobar estado persistido.
3. Con D5-C, la primera migración no tiene DELETE. Para demostrar preservación de históricos, usar base aislada/efímera presembrada **antes** de aplicar la migración y comparar **después**, sin ejecutar DELETE desde el test. Una suite post-migración sola no puede certificar esta propiedad del rollout. El inventario posterior de producción es lectura de conteos, no parte de esta revisión.
4. `src/server/push/push.test.ts`: mock de la petición HTTPS en la frontera de red, sin evitar la implementación productiva. **Mutación RED-DEADLINE**: quitar `request.destroy` o usar solo `timeout` de socket. Simular bytes cada pocos ms durante >5 s con reloj controlado; se exige destrucción de request y failureCount sin delete. **Mutación RED-REDIRECT**: aceptar 302 y seguir `Location: https://host-prohibido`; debe fallar el test.
5. `src/server/push/push.test.ts` y `src/app/api/push/send/route.test.ts`: caso bloqueado `{status:0,error:'ENDPOINT_NOT_ALLOWED'}` **sin propia clave** `endpoint` y caso permitido con `endpoint`. **Mutación RED-LEAK**: agregar `endpoint: sub.endpoint` al registro bloqueado; la aserción `Object.hasOwn(record, 'endpoint') === false` debe fallar.
6. Ensayos de matriz de host: usar variantes buenas y malas independientes para SQL, domain, fake, schema y emisor. **Mutación RED-PARSER**: comparación por `endsWith` o regex no anclada debe aceptar `fcm.googleapis.com.evil.example`; la suite debe detectarlo.

## Limitaciones de esta ronda

No hubo clon local ni dependencias para `pnpm`, y no se ejecutó `git merge-tree`. GitHub informó `mergeable:true`. La rama no había recibido cambios ajenos a `b9f0bb12` al tomar la foto. Los 123 tests que figuran en la PR son **declaración del autor**, no una verificación propia. No se inspeccionaron logs de CI; no se deben rellenar `verificado_en_sha` de hallazgos abiertos.

---

# Evidencia — Ronda 2 · SHA 3406672d

## Inspección del SHA (GitHub)

- Comparación `c09c982d..3406672d`: cambiaron **solo** `docs/contracts/CC-049.md`, `docs/implementation-plan.md`, `docs/tasks/T-432.md` y `docs/tasks/log/T-432.md`. El autor no modificó la carpeta de revisión.
- Primer DoD de T-432 y fila del plan: coincidencia exacta por comparación de strings (**TRUE**).
- `src/server/push/transport.test.ts` y `supabase/tests/integration/cc035_concurrency.mjs`: presentes en “Archivos permitidos”.
- Checks estáticos independientes de contrato: H01 ✅ · H03 ✅ · H04 ✅ · H02 primera aplicación ❌ · M01 tabla literal URL→boolean ❌ · nota histórica precisa ❌.
- Bitácora: atribuye al autor 123/123 de `pnpm exec vitest run tools`; **no reproducido aquí**.
- Git clone por HTTPS falló: `Could not resolve host: github.com`. No se corrió `git merge-tree`, Vitest, typecheck, lint, pgTAP, Supabase ni Docker local o remoto.

## H02 — arnés independiente ejecutado (Node v22.16.0)

Ejecuté `node /tmp/pr697_r2_h02_probe.mjs`. El contenido completo para copiar es:

```js
import assert from 'node:assert/strict';
// Modelo del orden temporal, NO prueba de PostgreSQL ni migración real.
const rows = [ {id:'legitimo',allowed:true}, {id:'historico',allowed:false} ];
let firstRun = true;
function applyMigration(items) {
  // Mutación adversaria: elimina históricos SOLO durante la primera aplicación.
  if (firstRun) { firstRun=false; return items.filter(r=>r.allowed); }
  return items;
}
const lostOnFirstApply = applyMigration([...rows]);
assert.equal(lostOnFirstApply.some(r=>r.id==='historico'), false);
// El DoD actual comienza después de aplicar la migración.
const seededAfterMigration = [...lostOnFirstApply, {id:'historico-2',allowed:false}];
const afterReapply = applyMigration(seededAfterMigration);
assert.deepEqual(afterReapply, seededAfterMigration);
console.log('PR697-H02: el test de reaplicación queda GREEN aunque la primera aplicación borró la fila histórica.');
// Un control correcto empieza ANTES de la primera aplicación.
firstRun=true;
const afterFirstMigrationWithSeed = applyMigration([...rows]);
assert.equal(afterFirstMigrationWithSeed.some(r=>r.id==='historico'), false);
console.log('PR697-H02: control de primera aplicación detectaría el borrado (RED).');
```

**Salida observada:**

```text
PR697-H02: el test de reaplicación queda GREEN aunque la primera aplicación borró la fila histórica.
PR697-H02: control de primera aplicación detectaría el borrado (RED).
```

El término RED describe lo que una **prueba correcta aún no implementada** detectaría, NO una línea roja real de pgTAP. Es una prueba de la falta de cobertura temporal. Nunca se ha corrido una migración CC-049.

## H05 — chequeo estático sugerido (no ejecutado sin clon)

Una tabla canónica de fixture real debería contener al menos 17 filas `ID | URL literal | true/false` en `CC-049.md§Impacto exacto`. Un chequeo local debe comprobar IDs únicos, URLs distintas y valores booleanos explícitos. **Quitar una fila o invertir su expected** tiene que alterar el control de sincronía entre SQL y TS; no basta buscar la palabra “tabla”. La implementación de ese control pertenece a la PR posterior; no presentar tests hipotéticos como corridos.

## Para verificar después del arreglo documental

```bash
git pull origin feat/T-432-sec07-push-hardening
git diff --check
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
git ls-remote origin feat/T-432-sec07-push-hardening
```

Registrar únicamente los resultados reales; no tocar `docs/revision-pr/**` ni tratar el verde declarado por agy como verificación independiente.

---

# Evidencia independiente — Ronda 3 · SHA `1052fbed`

## Fuentes revisadas

- Contrato y ficha desde GitHub en SHA `1052fbed3150c0589835c50b446791a4eaa3ab4f`.
- Esquema real: `supabase/migrations/20260922031435_schema_v1.sql:165-174` (ocho columnas).
- Migración anterior real: `20261111120000_cc048_merchant_draft_only.sql`. El archivo CC-049 todavía **no existe** en este PR documental.
- Delta desde revisión R2: tres documentos, ninguno fuera de alcance, sin cambios en `docs/revision-pr/pr-697/` por el autor.
- GitHub CI de `1052fbed`: typecheck/lint/build/audit/unit/bundle-budget `success`; log unit con `Test Files 202 passed (202)`, `Tests 3775 passed (3775)`. `db-tests` en progreso en la consulta, **no anotado verde**.

## Matriz canónica y mutaciones propias — ejecutadas con Node v22.16.0

Extraje del contrato E01–E19, comprobé IDs ordenados, 19 URLs únicas y comparé cada expected contra una implementación independiente de las reglas del contrato. Cinco mutaciones del oráculo son detectadas por la matriz.

Código autónomo, copiable a `/tmp/pr697_r3_matrix.mjs`:

```js
import assert from 'node:assert/strict';
const rows = [
  {
    "id": "E01",
    "url": "https://fcm.googleapis.com/fcm/send/abc",
    "expected": true
  },
  {
    "id": "E02",
    "url": "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "expected": true
  },
  {
    "id": "E03",
    "url": "https://web.push.apple.com/QAbc",
    "expected": true
  },
  {
    "id": "E04",
    "url": "https://wns2-par02p.notify.windows.com/w/?token=abc",
    "expected": true
  },
  {
    "id": "E05",
    "url": "https://FCM.GoogleAPIs.com/fcm/send/abc",
    "expected": true
  },
  {
    "id": "E06",
    "url": "https://fcm.googleapis.com:443/fcm/send/abc",
    "expected": true
  },
  {
    "id": "E07",
    "url": "http://fcm.googleapis.com/fcm/send/abc",
    "expected": false
  },
  {
    "id": "E08",
    "url": "https://push.example.com/abc",
    "expected": false
  },
  {
    "id": "E09",
    "url": "https://fcm.googleapis.com.evil.example/abc",
    "expected": false
  },
  {
    "id": "E10",
    "url": "https://fcm.googleapis.com@evil.example/abc",
    "expected": false
  },
  {
    "id": "E11",
    "url": "https://fcm.googleapis.com:8443/fcm/send/abc",
    "expected": false
  },
  {
    "id": "E12",
    "url": "https://fcm.googleapis.com\\evil.example/abc",
    "expected": false
  },
  {
    "id": "E13",
    "url": "https://fcm.googleapis.com./fcm/send/abc",
    "expected": false
  },
  {
    "id": "E14",
    "url": "https://fcm%2egoogleapis.com/fcm/send/abc",
    "expected": false
  },
  {
    "id": "E15",
    "url": "https://[2001:db8::1]/fcm/send/abc",
    "expected": false
  },
  {
    "id": "E16",
    "url": "https://fcm.googleapis.com",
    "expected": false
  },
  {
    "id": "E17",
    "url": "https://notify.windows.com/w/?token=abc",
    "expected": false
  },
  {
    "id": "E18",
    "url": "https://a.b.notify.windows.com/w/?token=abc",
    "expected": false
  },
  {
    "id": "E19",
    "url": "https://evilnotify.windows.com/w/?token=abc",
    "expected": false
  }
];
assert.equal(rows.length, 19);
assert.deepEqual(rows.map(r=>r.id),Array.from({length:19},(_,i)=>'E'+String(i+1).padStart(2,'0')));
assert.equal(new Set(rows.map(r=>r.url)).size, 19);
function allowed(u){
 if(!u.startsWith('https://'))return false;
 const rest=u.slice(8),slash=rest.indexOf('/');if(slash<0)return false;
 const a=rest.slice(0,slash);if(/[\\%@\[\]\s]/.test(a))return false;
 const m=a.match(/^([^:]+)(?::(\d+))?$/);if(!m||(m[2]&&m[2]!=='443'))return false;
 const h=m[1].toLowerCase();
 return ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(h)||/^[a-z0-9-]+\.notify\.windows\.com$/.test(h);
}
assert.deepEqual(rows.filter(r=>allowed(r.url)!==r.expected),[]);
console.log('GREEN: 19/19 casos literales; IDs ordenados, URLs únicas y expectativas compatibles con el contrato.');
const mutants=[
 ['E09',u=>allowed(u)||u.includes('fcm.googleapis.com.evil.example')],
 ['E19',u=>allowed(u)||u.includes('evilnotify.windows.com')],
 ['E14',u=>allowed(u.replace('%2e','.'))],
 ['E11',u=>allowed(u.replace(':8443',':443'))],
 ['E12',u=>allowed(u.replace('\\evil.example','/evil.example'))]
];
for(const [id,fn] of mutants){let bad=rows.filter(r=>fn(r.url)!==r.expected).map(r=>r.id);assert.ok(bad.includes(id));const labels={E09:'substr en lugar de host entero',E19:'WNS sin punto de separación',E14:'aceptar escape %2e en hostname',E11:'aceptar puerto indebido',E12:'normalizar barra invertida antes del filtro'};console.log('RED de mutación '+id+': '+labels[id]+': '+bad.join(', '));}
```

Salida observada de la ejecución local del mismo conjunto de casos:

```text
GREEN: 19/19 casos literales; IDs ordenados, URLs únicas y expectativas compatibles con el contrato.
RED de mutación E09: substr en lugar de host entero: E09
RED de mutación E19: WNS sin punto de separación: E19
RED de mutación E14: aceptar escape %2e en hostname: E14
RED de mutación E11: aceptar puerto indebido: E11
RED de mutación E12: normalizar barra invertida antes del filtro: E12
```

Este arnés valida **la especificación** de 19 URLs contra un clasificador local, **no** que las futuras implementaciones PostgreSQL o TypeScript estén verdes. Los cinco rojos son **mutaciones propias del revisor**, no salidas de CI del proyecto.

## H02 — Contraejemplo de campos omitidos (Node, ejecutado)

Código completo para `/tmp/pr697_r3_h02.mjs`:

```js
import assert from 'node:assert/strict';
const oldRow={id:'00000000-0000-4000-8000-000000000001',user_id:'00000000-0000-4000-8000-000000000002',endpoint:'https://push.example.com/abc',p256dh:'P256dhTestKey',auth:'AuthTestKey',platform:'web',created_at:'2025-01-01T00:00:00.000Z',last_seen_at:'2025-02-01T00:00:00.000Z'};
const keys=['id','user_id','endpoint','p256dh','auth','platform'];
const before=keys.map(k=>oldRow[k]);
const mutatedSeen={...oldRow,last_seen_at:'2026-11-12T05:00:00.000Z'};
assert.deepEqual(keys.map(k=>mutatedSeen[k]),before);
console.log('GREEN falso: seis valores comparados iguales pese a sobrescribir last_seen_at');
assert.notDeepEqual(mutatedSeen,oldRow);
console.log('RED correcto: comparación de fila completa detecta last_seen_at alterado');
const mutatedCreated={...oldRow,created_at:'2026-11-12T05:00:00.000Z'};
assert.deepEqual(keys.map(k=>mutatedCreated[k]),before);
assert.notDeepEqual(mutatedCreated,oldRow);
console.log('GREEN falso: created_at omitido; comparación integral lo detectaría');
```

Salida observada:

```text
GREEN falso: seis valores comparados iguales pese a sobrescribir last_seen_at
RED correcto: comparación de fila completa detecta last_seen_at alterado
GREEN falso: created_at omitido; comparación integral lo detectaría
```

Interpretable como: la prueba futura de primera aplicación puede resultar verde con una mutación que altera solo una columna temporal. **No se ejecutó ningún SQL ni pgTAP**. Los dos timestamps deben precargarse deliberadamente con valores diferentes a `now()`.

## Límites

Sin clon Git local ni `git merge-tree`, ni dependencias PNPM; no se levantó Supabase o Docker; no se ejecutaron E2E ni tests SQL del futuro CC-049. La corrida real del job unit se consultó por el SHA revisado, pero no se presenta como ejecución de una implementación todavía ausente. Al revisor solo le consta lo que inspeccionó/ejecutó en esta ronda.

---

# Evidencia independiente — ronda 4 (SHA `afa9b40c`)

## Origen, delta y límites

- GitHub PR #697: head de contenido `afa9b40c9bd11b6e4039b53940aea25ed2a97c2e`, base `9dafedab`, mergeable=true.
- `0745dfef..afa9b40c`: solo tres documentos CC/ficha/bitácora. La carpeta de revisión no fue tocada por el autor.
- `supabase/migrations/20260922031435_schema_v1.sql:165-174` contiene exactamente ocho columnas de `push_subscriptions`.
- `supabase/migrations/20261111120000_cc048_merchant_draft_only.sql` es la última migración existente antes del hipotético CC-049; no se ejecutó CC-049 porque la implementación aún está pendiente.
- CI del SHA: typecheck, lint, build, audit, bundle-budget y unit success. Log de unit: `Test Files 202 passed (202)`, `Tests 3775 passed (3775)`. `db-tests` consultado en progreso. Autor declara 123/123 de vitest tools; no repetido por el revisor.
- No se clonó (el contenedor no resolvió github.com), no se hizo `git merge-tree`, ni pgTAP, ni Supabase local/remoto, ni E2E.

## Checker del contrato — completo y reproducible

El siguiente script se ejecuta desde la raíz de un **clon local** del SHA de contenido. Su equivalente de lectura y mutación se ejecutó en la sesión de revisión sobre el texto recuperado del conector GitHub. Mide **solo la completitud de la especificación**, no el funcionamiento de SQL real. Guardar en `/tmp/pr697_r4_contract.mjs` y ejecutar `node /tmp/pr697_r4_contract.mjs`.

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
const cc=fs.readFileSync('docs/contracts/CC-049.md','utf8');
const task=fs.readFileSync('docs/tasks/T-432.md','utf8');
const plan=fs.readFileSync('docs/implementation-plan.md','utf8');
const schema=fs.readFileSync('supabase/migrations/20260922031435_schema_v1.sql','utf8');
const section=cc.split('- **Preservación de filas históricas en la primera aplicación')[1]?.split('  - **Dominio:**')[0]??'';
function verifyH02(s) {
  const step4=s.match(/4\.\s+exige que las dos filas existan([\s\S]*?)5\./)?.[1]??'';
  const cols=['id','user_id','endpoint','p256dh','auth','platform','created_at','last_seen_at'];
  assert.ok(s.includes('antes de aplicar CC-049 por primera vez'));
  assert.ok(s.includes('20261111120000'));
  for (const name of cols) assert.ok(step4.includes('`'+name+'`'), 'No se compara: '+name);
  assert.ok(s.includes("created_at = '2025-01-01T00:00:00Z'"), 'No hay sentinel created_at');
  assert.ok(s.includes("last_seen_at = '2025-02-01T00:00:00Z'"), 'No hay sentinel last_seen_at');
  assert.ok(s.includes('is not distinct from') && s.includes('to_jsonb'));
  assert.ok(s.includes('**RED-DELETE:**') && s.includes('**RED-TIMESTAMP:**'));
  assert.ok(s.includes('last_seen_at = now()'), 'RED-TIMESTAMP no especificado');
  assert.ok(s.includes('pnpm supabase db reset'));
}
verifyH02(section);
console.log('GREEN: H02 (8 columnas, 2 sentinels, primera aplicación, dos mutaciones)');
const mutations=[
 ['omitir timestamps',section.replace('`created_at`, `last_seen_at`','')],
 ['quitar RED-TIMESTAMP',section.replace('**RED-TIMESTAMP:**','**MUTACION ELIMINADA:**')],
 ['usar now() en el seed',section.replace("last_seen_at = '2025-02-01T00:00:00Z'","last_seen_at = now()")]
];
for (const [name,mutated] of mutations) {
  assert.throws(()=>verifyH02(mutated),assert.AssertionError,'el control debió detectar: '+name);
  console.log('RED detectado: '+name);
}
const dod=task.split('## DoD\n')[1]?.match(/^- \[ \] (.*)$/m)?.[1];
const planDod=plan.split('\n').find(l=>l.startsWith('| T-432 |'))?.split('|')[6]?.trim();
assert.equal(dod,planDod);
assert.ok(task.includes('las ocho columnas')&&task.includes('RED-DELETE')&&task.includes('RED-TIMESTAMP'));
assert.ok(schema.includes('created_at timestamptz')&&schema.includes('last_seen_at timestamptz'));
console.log('GREEN: ficha / plan / esquema sincronizados');
```

**Salida equivalente observada sobre los textos reales del SHA:**

```text
GREEN: H02 (8 columnas, 2 sentinels, primera aplicación, dos mutaciones)
RED detectado: omitir timestamps
RED detectado: quitar RED-TIMESTAMP
RED detectado: usar now() en el seed
GREEN: ficha / plan / esquema sincronizados
```

Los tres resultados RED son **mutaciones de la especificación en memoria** que el validador detecta: una prueba real de la migración vendrá después, en la PR de implementación.

## Verificación complementaria sin regresiones

- H01: existen controles independientes de grants y policy con mutaciones, declarados en ficha y CC.
- H03: `generateRequestDetails`, `request.destroy()`, goteo de bytes y prohibición de seguir 3xx conservados.
- H04: unión `sent/blocked`, ausencia de propiedad `endpoint` y pruebas `Object.hasOwn` conservadas.
- H05: 19 URLs E01–E19 únicas y con expecteds fijos; oráculo independiente de URL coincide 19/19.
- M02: bitácora atribuye D4-B y D5-C a Lautaro073.
- Primer DoD y fila T-432 en plan son literalmente iguales.

**Criterio de fin:** esta ronda declara `SIN BLOQUEANTES DOCUMENTALES` y transfiere la obligación de demostrar RED/GREEN real de la migración y el transporte a la PR de implementación. No se emite autorización automática de merge ni se crea un nuevo test de CI artificial.
