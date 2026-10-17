# Evidencia y comandos — revisión independiente PR #401 · Ronda 1

## Evidencia REAL observada (sin afirmar ejecución local)

- HEAD observado: `ef990947474cd404c0adda429f852589c5c55732`; base `711a2f7054d77fd664d3ec09b3bbdd24efb88476`. Comparación remota: 7 ahead, 0 behind; merge-base coincide.
- GitHub Actions: run **39050363050**, `db-tests` job **117447530842**: `cc030_courier_docs_orphans.sql .. ok` (46); RED gracia 0 `Failed tests: 19,22,25,34,35,38,42`; GREEN restaurado `46/46`; `[CC-030] RED confirmado` al deshabilitar trigger y GREEN restaurado; último `Files=28, Tests=2466, Result: PASS`; generación de `database.types.ts` con diff vacío.
- `unit` job **117447530805**: `Test Files 140 passed (140)`, `Tests 2595 passed (2595)`; workflows node --test 79/79; ADR 6/6.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget` success en el mismo run.
- `e2e-preview`: estado reportado como bloqueado, no se presenta como test ejecutado; no se consultó ni migró Develop remoto.
- **Nuestras pruebas RED→GREEN no ejecutadas en esta sesión**: sin clon operativo/Docker por limitaciones del entorno y regla del equipo. Los comandos siguientes son un **guion reproducible pendiente**, no evidencia ejecutada.

## Preparación para la ronda 2 (agente / revisor con clon)

```sh
git fetch origin
git ls-remote origin feat/T-370-huerfanos-storage
git diff --stat origin/develop...origin/feat/T-370-huerfanos-storage
git merge-tree --write-tree origin/develop origin/feat/T-370-huerfanos-storage
pnpm install --frozen-lockfile
pnpm exec vitest run src/server/cron/orphan-courier-documents.test.ts src/server/cron/sweep.test.ts src/app/api/cron/sweep/route.test.ts
pnpm typecheck && pnpm lint && pnpm test
# NO levantar Docker/Supabase local. db-tests se verifica en el log de CI.
node docs/revision-pr/analizar.mjs verificacion
```

## Harness INDEPENDIENTE para mutaciones nuevas, una vez corregido H01/H02

El script completo siguiente se copia en un archivo temporal `/tmp/pr401-mutations.mjs`, fuera del repo, y se ejecuta desde un **worktree limpio** de la rama corregida con los tests nuevos ya creados. No usa ningún test/mutante del autor. Restaura siempre el archivo desde la copia leída **en memoria**; nunca usa `git checkout` para revertir mutaciones. El revisor debe verificar que falla la **aserción específica esperada** y no un import/setup.

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';

const file = 'src/server/cron/orphan-courier-documents.ts';
const spec = 'src/server/cron/orphan-courier-documents.test.ts';
const initial = readFileSync(file, 'utf8');

function runCase(testName) {
  const result = spawnSync('pnpm', ['exec', 'vitest', 'run', spec, '-t', testName], {
    encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' },
  });
  const output = (result.stdout || '') + '\n' + (result.stderr || '');
  const summary = output.split('\n').filter((line) =>
    /Test Files|Tests\s|FAIL|failed|passed/i.test(line)).slice(-12).join('\n');
  console.log(testName + ': exit=' + result.status + '\n' + summary);
  assert.ok(output.includes(testName), 'El runner no llegó al test esperado: ' + testName);
  return result.status === 0;
}
function mutation(name, before, after) {
  assert.equal(readFileSync(file, 'utf8'), initial, 'El archivo no coincide con el original del ensayo');
  assert.ok(initial.includes(before), 'No coincide el patrón exacto de código para ' + name);
  const changed = initial.replace(before, after);
  try {
    writeFileSync(file, changed, 'utf8');
    assert.equal(runCase(name), false, 'La mutación quedó verde: control inválido');
    console.log('RED observado: ' + name);
  } finally {
    writeFileSync(file, initial, 'utf8');
  }
  assert.equal(runCase(name), true, 'No recuperó GREEN tras restaurar desde memoria');
  console.log('GREEN restaurado: ' + name);
}

const h01 = 'CC-030 H01: ruta huérfana no canónica dentro de courier-docs';
const h02 = 'CC-030 H02: error Storage no filtra rutas privadas';

assert.equal(runCase(h01), true, 'Control H01 original no estaba GREEN');
assert.equal(runCase(h02), true, 'Control H02 original no estaba GREEN');

mutation(h01,
  "storagePath: z.string().min(1),",
  "storagePath: z.string().startsWith('courier/'),"
);
mutation(h02,
  "throw new Error('Failed to remove orphan courier documents');",
  "throw new Error(`Failed to remove orphan courier documents: ${removeError.message}`);"
);
assert.equal(readFileSync(file, 'utf8'), initial, 'Restauración incompleta');
```

**NOTA:** el script es para cuando el arreglo use los literales sugeridos y añada tests con los nombres exactos. Si el agente elige otra implementación, adaptar el patrón del mutante **sin cambiar el oráculo** y registrar íntegro el harness definitivo con outputs reales en una nueva evidencia de ronda. Sólo cuenta como RED un test de privacidad o de compatibilidad que falle por la mutación intencional; no un fallo del runner.

### Casos SQL adicionales recomendados (en CI, sin DB remota manual)

En `supabase/tests/cc030_courier_docs_orphans.sql`, después de los casos existentes, antes de `finish()`:
```sql
select pg_temp.reset_actor();
select pg_temp.put_object('legacy/cc030_orphan_old.jpg', now() - interval '9 days');
select pg_temp.act_as_service_role();
create table pg_temp.legacy_claim as
  select public.claim_orphan_courier_documents(100, false) as res;
select ok(
  'legacy/cc030_orphan_old.jpg' = any((select pg_temp.claimed_paths(res) from pg_temp.legacy_claim)),
  'reclama huérfano antiguo no canónico dentro de courier-docs'
);
```
Actualizar `plan(46)` a `plan(47)`; no cambiar ni retirar ninguna prueba anterior para hacer pasar el nuevo caso. Comprobar que el test nuevo aparece explícitamente en CI y el control independiente contra la validación TS produce RED→GREEN.

## Datos NO verificados

No se inspeccionaron ni modificaron `.env*`, secrets, bases remotas o infraestructura. No se ejecutaron pruebas locales del proyecto por falta de clon; la evidencia del autor se contrastó leyendo el log CI, no reproduciendo toda su batería. Evitar afirmar `verificado_en_sha` sin ejecución de un tercero.

---
## Ronda 2 — harness independiente REAL ejecutado sobre el blob exacto

Esta sección no reemplaza las 47 pruebas pgTAP ni las 2599 de Vitest. Ejecuté realmente este script mediante Node con el parser TypeScript; el archivo TypeScript de entrada se verificó por blob SHA Git **`fbb2e60d5b6a75fe4aaa9298d529caa089061bdb`**, igual al del HEAD `a980ee9d`. Mutaciones sólo en cadenas en memoria. Es un control estático sobre el código real, no una simulación de ejecución Supabase.

Preparación desde clon del HEAD antes de copiar el guion en `/tmp/pr401-independent/reviewer-mutations.cjs`:
```sh
mkdir -p /tmp/pr401-independent
cp src/server/cron/orphan-courier-documents.ts /tmp/pr401-independent/orphan-courier-documents.ts
git hash-object /tmp/pr401-independent/orphan-courier-documents.ts
# esperado exactamente: fbb2e60d5b6a75fe4aaa9298d529caa089061bdb
node /tmp/pr401-independent/reviewer-mutations.cjs
```
El `require` absoluto de TypeScript corresponde al runtime del revisor. En otra máquina sustituir por `require('typescript')` si existe como dependencia local. Esto no altera los oráculos ni el control.

```js
// Independiente: análisis AST de código real SHA a980ee9d (blob fbb2e60...)
// NO sustituye a Vitest/pgTAP. Mutaciones sólo en memoria; sin editar repo.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const source = fs.readFileSync('/tmp/pr401-independent/orphan-courier-documents.ts','utf8');
const run=(input)=>{
  const ast=ts.createSourceFile('orphan-courier-documents.ts',input,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  assert.equal(ast.parseDiagnostics.length,0,'AST no válido');
  const props=[], errors={};
  const visit=n=>{
    if(ts.isPropertyAssignment(n)&&n.name.getText(ast)==='storagePath')props.push(n.initializer.getText(ast));
    if(ts.isIfStatement(n)&&ts.isIdentifier(n.expression)&&['claimError','removeError','completeError'].includes(n.expression.text)){
       let throws=[];
       const inner=m=>{if(ts.isThrowStatement(m))throws.push(m);ts.forEachChild(m,inner)};inner(n.thenStatement);
       errors[n.expression.text]=throws.map(t=>ts.isNewExpression(t.expression)?t.expression.arguments?.map(a=>ts.isStringLiteral(a)?a.text:'NOT_LITERAL')??[]:['NOT_NEW_ERROR']);
    }
    ts.forEachChild(n,visit);
  };visit(ast);
  assert.deepEqual(props,['z.string().min(1)'],'H01: elegibilidad Zod no debe restringir prefijo ni tamaño inesperado');
  const expected={claimError:'Failed to claim orphan courier documents',removeError:'Failed to remove orphan courier documents',completeError:'Failed to complete orphan courier document purge'};
  assert.deepEqual(Object.keys(errors).sort(),Object.keys(expected).sort(),'H02: tres ramas exactas de error');
  for(const [key,txt] of Object.entries(expected))assert.deepEqual(errors[key],[[txt]],'H02: error de '+key+' debe ser literal constante');
};
const mutate=(label,from,to)=>{
  assert.ok(source.includes(from),'Mutante sin objetivo: '+label);
  const mutant=source.replace(from,to);
  assert.notEqual(mutant,source);
  let red=false;try{run(mutant)}catch(e){red=true;console.log('RED '+label+': '+e.message.split('\n')[0]);}
  assert.ok(red,'Mutante no detectado: '+label);
  run(source);
  console.log('GREEN '+label+': fuente original íntegra');
};
run(source); console.log('CONTROL ORIGINAL GREEN — AST TypeScript, 1 ruta + 3 ramas error');
mutate('H01: longitud mínima 128 (no autorizado)',"storagePath: z.string().min(1)","storagePath: z.string().min(128)");
mutate('H01: filtro por prefijo legado',"storagePath: z.string().min(1)","storagePath: z.string().startsWith('courier/')");
mutate('H02: leak error claim',"throw new Error('Failed to claim orphan courier documents');","throw new Error(`Failed to claim orphan courier documents: ${claimError.message}`);");
mutate('H02: leak error remove',"throw new Error('Failed to remove orphan courier documents');","throw new Error(`Failed to remove orphan courier documents: ${removeError.message}`);");
mutate('H02: leak error complete',"throw new Error('Failed to complete orphan courier document purge');","throw new Error(`Failed to complete orphan courier document purge: ${completeError.message}`);");
console.log('5/5 MUTACIONES AST DETECTADAS; fuente sin modificaciones');
```

**Salida REAL:** `CONTROL ORIGINAL GREEN`; mutaciones H01 min128 y prefijo RED→GREEN; H02 claim, remove, complete RED→GREEN; `5/5 MUTACIONES AST DETECTADAS; fuente sin modificaciones`. El repositorio nunca fue mutado. El código reproduce el oráculo efectivamente ejecutado: tres condiciones concretas de error y los mensajes literales esperados.

**Gate actual por develop:** `git compare origin/develop...HEAD` indica 45 commits en develop aún no integrados, entre ellos T-356. GitHub indica `mergeable:false` (`dirty`); el último CI hizo checkout de merge 941b73d contra base 711a2f, no el develop 708a9afb. Se requiere `git merge --no-ff origin/develop` y validar el resultado combinado.


## Actualización: merge de develop integrado

El gate de sincronización detectado en ronda 2 fue atendido por el agente mediante merge de origin/develop en `d88e01c1` (padres `a980ee9d`, `708a9afb`). No repetir el merge sin motivos; verificar CI de `39059019921` sobre el SHA integrado. La prueba AST de H01/H02 sigue siendo válida porque el archivo en el merge tiene el mismo blob `fbb2e60d`. La salida del CI de base antigua no se reutiliza para certificar el merge actual.

## Cierre definitivo de ronda 2 — HEAD integrado d88e01c1cb17fabe0f593be26fde45c4fffdd756

**RESULTADO: SIN BLOQUEANTES.** La integración con develop está resuelta y comprobada en el merge real. CI run **39059019921** finalizó **SUCCESS** con **141 archivos / 2668 tests unitarios**, **29 archivos / 2735 pgTAP**, CC-030 **47/47**, mutación de gracia 0 **7 RED y 47 GREEN**, concurrencia SQL/trigger RED→GREEN, integración T-369 GREEN, generación de `database.types.ts` idéntica, typecheck/lint/build/audit/bundle-budget y `approval-policy` verdes. La verificación fue del SHA **d88e01c1** (code merge), y los defectos H01/H02 conservaron el mismo blob de TS que se sometió a las mutaciones AST independientes. No hay otra ronda técnica exigible sólo por el commit de documentación de revisión.

`e2e-preview` **NO se ejecutó**: permanece bloqueado por necesitar la migración de CC-030 en Develop, previsto en el rollout. No presentar ese chequeo como verde. La promoción a staging/main y activar `enforce` siguen siendo decisiones humanas **posteriores**. **Esta revisión NO aprueba ni mergea**.
