# Evidencia y comandos reproducibles — PR #738 R1

**Fuente:** GitHub, `develop@3c4d26b6f34bc7a909b328bddcbd37f4fc0993bc`, PR HEAD `5dce13a4d632fbb32dd79c66a7907ca4693c82eb`. **Sin clon ni runtime del repositorio** en el revisor. Esta es una inspección; ningún GREEN de aplicación ni RED de navegador se atribuye al revisor.

## 1. Reproducción en un clon limpio (ejecuta quien tenga checkout)

```bash
git fetch origin
git rev-parse origin/develop
git rev-parse origin/feat/T-436-csp-enforce
git diff --name-status origin/develop...origin/feat/T-436-csp-enforce
git diff origin/develop...origin/feat/T-436-csp-enforce -- docs/tasks/T-436.md docs/implementation-plan.md
git show origin/develop:src/security/headers.ts | grep -nE 'ENFORCED_CSP|Report-Only|script-src|connect-src|img-src'
git show origin/develop:e2e/specs/security-headers.spec.ts | grep -nE 'collectCspMessages|securitypolicyviolation|maps.googleapis.com|maxRedirects'
git log --oneline origin/feat/T-436-csp-enforce -- docs/revision-pr/pr-738/
git merge-tree --write-tree origin/develop origin/feat/T-436-csp-enforce
```

No leer `.env*`, credenciales ni secretos. Nunca ejecutar contra Supabase remoto, Vercel ni GitHub secrets, y no levantar Docker/Supabase local. Un `merge-tree` incorrecto o conflicto se anota y no se fuerza. Comparar HEAD con SHA revisado antes de ejecutar pruebas.

## 2. Script COMPLETO de contraste estático, con selftest y mutaciones en memoria

Copia **todo** este bloque en un terminal del clon (el script vive en `/tmp` y no ensucia la rama):

```bash
cat > /tmp/pr738-guard.mjs <<'NODE'
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

function getText(root, path) { return readFileSync(resolve(root, path), 'utf8'); }
function audit(source, spec, ficha) {
  return {
    baselineReportOnly: source.includes("key: 'Content-Security-Policy-Report-Only'") && source.includes('buildReportOnlyCsp(options)'),
    routeCoverage: spec.includes("'/api/health'") && spec.includes("'/admin/applicants'") && spec.includes('maxRedirects: 0'),
    reporterIsConsoleOnly: spec.includes("page.on('console'") && !spec.includes('securitypolicyviolation'),
    legacyDecisionD1A: ficha.includes('**D1-A'),
    requiresExternalBypass: ficha.includes('`<script src>`') && ficha.includes('un `fetch`') && ficha.includes('una `<img>`'),
  };
}
if (process.argv[2] === '--selftest') {
  const original = audit("key: 'Content-Security-Policy-Report-Only', value: buildReportOnlyCsp(options)", "'/api/health' '/admin/applicants' maxRedirects: 0 page.on('console'", '**D1-A `<script src>` un `fetch` una `<img>`');
  assert.deepEqual(original, {baselineReportOnly:true,routeCoverage:true,reporterIsConsoleOnly:true,legacyDecisionD1A:true,requiresExternalBypass:true});
  const mutated = audit("key: 'Content-Security-Policy', value: buildReportOnlyCsp(options)", "'/api/health' '/admin/applicants' maxRedirects: 0 page.on('console' securitypolicyviolation", '**D1-C');
  assert.equal(mutated.baselineReportOnly, false);
  assert.equal(mutated.reporterIsConsoleOnly, false);
  assert.equal(mutated.legacyDecisionD1A, false);
  console.log('SELFTEST PASS: baseline and three independent in-memory mutations detected');
} else {
  const root=process.argv[2] || process.cwd();
  const result=audit(getText(root,'src/security/headers.ts'),getText(root,'e2e/specs/security-headers.spec.ts'),getText(root,'docs/tasks/T-436.md'));
  console.log(JSON.stringify(result,null,2));
  if (!result.routeCoverage || !result.requiresExternalBypass) process.exitCode=1;
}
NODE
node /tmp/pr738-guard.mjs --selftest
node /tmp/pr738-guard.mjs "$PWD"
```

**Ejecución efectiva del revisor, `--selftest` solamente:** `SELFTEST PASS: baseline and three independent in-memory mutations detected`. M1 cambia la clave Report-Only en memoria; M2 agrega un listener de eventos CSP; M3 cambia D1-A por D1-C; las tres son detectadas. Esto **solo prueba el harness sintético**, no la aplicación. La ejecución del segundo comando con clon real **no se hizo** (DNS del contenedor). Sus chequeos de cadenas son inspección auxiliar, no cubren comportamiento real ni sustituyen pruebas negativas.

## 3. Comandos de implementación (autor, otra etapa)

```bash
# Baseline de PR documental:
pnpm exec vitest run tools

# Cuando exista implementación (en la etapa correspondiente):
pnpm exec vitest run src/security/headers.test.ts
pnpm exec playwright test e2e/specs/security-headers.spec.ts --project=chromium --retries=0
pnpm typecheck
pnpm lint
pnpm test
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
```

Playwright requiere el ambiente E2E Develop autorizado y la configuración habitual del proyecto. `e2e-preview` completo debe quedar verde sobre **SHA de implementación**, no solo sobre un cambio en la bitácora. No ejecutar de forma directa contra producción.

### Prueba RED/GREEN del bypass (protocolo exacto)

1. Introducir el **spec** de bloqueo en `e2e/specs/security-headers.spec.ts` mientras la app conserva el estado T-391; correr el mismo spec contra build correspondiente sin retries. Debe estar RED por `disposition` distinta a `enforce` / ejecución que sí ocurrió, **no** por DNS o CORS.
2. Interceptar en Playwright *solo* los hosts reservados del caso: responder JS ejecutable, imagen PNG válida, y `fetch` con CORS correcto. Sobre el estado inicial afirmar ejecución/carga/respuesta; sobre enforce, afirmar bloqueo por directiva, evento `enforce`, ausencia de efecto de ejecución y no llegada de peticiones al host de prueba.
3. Registrar exactamente el nombre del test, `Tests …` o resumen de Playwright RED, SHA y evidencia mínima. Después de habilitar enforce, el **mismo** test debe quedar GREEN sin debilitar aserciones.
4. Usar otras mutaciones independientes en memoria para unitarias de headers: `wss://` omitido en `connect-src`, origen de Storage omitido, `img-src` suprimido, `unsafe-eval` permitido en prod. Cada una debería romper el control respectivo. Para E2E de **controles de seguridad**, seguir `e2e/AGENTS.md`/T-347 y evitar desplegar políticas deliberadamente debilitadas en previews públicos.
5. H01: comprobar desde navegador operaciones reales REST, Storage y Realtime; afirmar la conexión/resultado, no la sola ausencia de errores en consola. Si no hay flujo UI existente adecuado, documentar el impedimento y ampliar formalmente el alcance, **sin simular operaciones en Node**.

## 4. Validación de reporte

```bash
node docs/revision-pr/analizar.mjs verificacion
git diff --check
git diff --stat origin/develop...HEAD
```

**No se afirmó su resultado en esta ronda.** Solo stage de `docs/revision-pr/pr-738/**` para el commit del revisor. Tras el commit, `git pull` antes de arreglar y sin rebase/amend/force push.

## Ronda 2 — evidencia por inspección y contrato real de e2e-mutation

**SHA de la corrección:** `865eb34622252153475097c4c05894fa62e971b2`; base `develop@3c4d26b`.

- Diff de commit del autor: **solo tres docs** `docs/tasks/T-436.md`, `docs/tasks/log/T-436.md` y la fila T-436 del plan; la carpeta de revisión conservaba el commit de R1.
- Inspección estática contra contenido de GitHub SHA: requisitos H01/H02/H03/H04 = **true**; D1-C/D2-A/D3-A = **true**; primer DoD ficha idéntico a columna DoD plan = **true**. Mutaciones independientes de un requisito esencial en cada caso cambian **true → false**; no son pruebas de runtime.
- Desacople H05: `e2e/AGENTS.md:15-21` exige catálogo `e2e/mutations` versionado en develop y target **solo develop mergeado**; `docs/tasks/T-347.md:31-62` y `.github/workflows/e2e-mutation.yml:3-10,47-65,103-112` lo confirman. `e2e/mutations/manifest.json` no contiene `t436-*`. La ficha en `T-436.md:57-66,120-122` no permite catálogo ni patches, y requiere `RED_CONFIRMED` como DoD. El control de factibilidad documental queda **NO PASA**. Ningún job se disparó.
- El intento de clonar con `git ls-remote https://github.com/cadeApp/cadeApp.git HEAD` falló por DNS: `Could not resolve host: github.com`. No hubo comprobación independiente de GitHub Actions, Vitest ni Playwright. Los **123 tests verdes** son el reporte del autor, no del revisor. No exigir CI nuevo solo por tocar bitácora.

### Script independiente COMPLETO (copiar a /tmp)

El siguiente harness comprueba los cuatro cambios, las decisiones y la igualdad ficha–plan, y **rechaza** la incompatibilidad de catálogo/etapas. `--selftest` se ejecutó en esta sesión con Node 22 y dio `SELFTEST PASS: 4 requisitos + decisiones + DoD; 6 mutaciones RED`. Son mutaciones **sintéticas en memoria** del instrumento; el comando contra el clon debe repetirlo quien tenga el checkout completo. La salida del clon **no fue ejecutada por el revisor**.

```bash
cat > /tmp/pr738-r2-guard.mjs <<'NODE'
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const hasAll = (s, words) => words.every((w) => s.includes(w));
function inspect(ficha, plan, agents, manifest) {
  const allowed = ficha.split('## Archivos permitidos')[1]?.split('## Fuera de alcance')[0] ?? '';
  const firstDod = ficha.match(/^- \[ \] (.+)$/m)?.[1];
  const row = plan.split('\n').find((s) => s.startsWith('| T-436 |'));
  const planDod = row?.split('|').slice(1,-1).map((s) => s.trim())[5];
  return {
    H01: hasAll(ficha,['**REST:**','**Storage:**','**Realtime:**','desde el navegador','join confirmado']),
    H02: hasAll(ficha,['**origen agregado:**','**origen retirado:**','inventario de peticiones reales','política candidata']),
    H03: hasAll(ficha,['csp-test.invalid/script.js','csp-test.invalid/probe.png','csp-test.invalid/probe.json','page.route','Access-Control-Allow-Origin']),
    H04: hasAll(ficha,['page.addInitScript','securitypolicyviolation','blockedURI','effectiveDirective','disposition']),
    decisions: hasAll(ficha,['D1-C','D2-A','D3-A','issue #739','riesgo residual']),
    syncDod: Boolean(firstDod && firstDod === planDod),
    mutationRequired: hasAll(ficha,['e2e-mutation','RED_CONFIRMED']),
    onlyDevelop: agents.includes('único') && agents.includes('develop'),
    allowsCatalog: allowed.includes('e2e/mutations/manifest.json') && allowed.includes('t436-csp-connect-https.patch') && allowed.includes('t436-csp-connect-wss.patch'),
    hasCatalogEntries: manifest.includes('t436-csp-connect-https') && manifest.includes('t436-csp-connect-wss'),
    postMergeSpecified: ficha.includes('después del merge') && ficha.includes('RED_CONFIRMED'),
  };
}
if (process.argv[2] === '--selftest') {
  const sample = ['## Archivos permitidos','- src/security/headers.ts','## Fuera de alcance','## DoD','- [ ] DoD principal','**REST:** **Storage:** **Realtime:** desde el navegador join confirmado','**origen agregado:** **origen retirado:** inventario de peticiones reales política candidata','csp-test.invalid/script.js csp-test.invalid/probe.png csp-test.invalid/probe.json page.route Access-Control-Allow-Origin','page.addInitScript securitypolicyviolation blockedURI effectiveDirective disposition','D1-C D2-A D3-A issue #739 riesgo residual','e2e-mutation RED_CONFIRMED'].join('\n');
  const plan = '| T-436 | P1 | CSP | deps | scope | DoD principal |';
  const agent = 'único target develop';
  const fixture = inspect(sample, plan, agent, '{}');
  assert.deepEqual([fixture.H01,fixture.H02,fixture.H03,fixture.H04,fixture.decisions,fixture.syncDod],[true,true,true,true,true,true]);
  const mutations = [
    ['H01',sample.replace('**Realtime:**','sin Realtime')],
    ['H02',sample.replace('**origen retirado:**','baja')],
    ['H03',sample.replace('csp-test.invalid/probe.png','no-probe.png')],
    ['H04',sample.replace('page.addInitScript','no-init')],
    ['decisions',sample.replace('D1-C','D1-A')],
  ];
  for(const [key,mut] of mutations) assert.equal(inspect(mut,plan,agent,'{}')[key],false,'mutación sin detectar: '+key);
  assert.equal(inspect(sample,plan.replace('DoD principal','DoD diferente'),agent,'{}').syncDod,false);
  console.log('SELFTEST PASS: 4 requisitos + decisiones + DoD; 6 mutaciones RED');
} else {
  const root=resolve(process.argv[2]??process.cwd());
  const read=(path)=>readFileSync(resolve(root,path),'utf8');
  const o=inspect(read('docs/tasks/T-436.md'),read('docs/implementation-plan.md'),read('e2e/AGENTS.md'),read('e2e/mutations/manifest.json'));
  console.log(JSON.stringify(o,null,2));
  if (![o.H01,o.H02,o.H03,o.H04,o.decisions,o.syncDod].every(Boolean)) process.exitCode=2;
  else if(o.mutationRequired && o.onlyDevelop && (!o.allowsCatalog || !o.hasCatalogEntries || !o.postMergeSpecified)) process.exitCode=3;
}
NODE
node /tmp/pr738-r2-guard.mjs --selftest
node /tmp/pr738-r2-guard.mjs "$PWD"
```

El segundo comando retorna **exit=3** si siguen sin existir catálogo, par de patches autorizados y etapa post-merge; **exit=2** si H01–H04, decisiones o DoD–plan pierden una señal esencial. Esta heurística de texto es un apoyo a inspección: para dar cierre final hace falta comprobar el workflow y los E2E reales cuando se implemente.

### Comprobaciones finales recomendadas (clon real)

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/develop
git diff --name-only dccfdfd976d8c17928e8ed0944f9ed55cb4045cf 865eb34622252153475097c4c05894fa62e971b2
git diff --check origin/develop...HEAD
git log --oneline -- docs/revision-pr/pr-738/
git merge-tree --write-tree origin/develop HEAD
pnpm exec vitest run tools
node docs/revision-pr/analizar.mjs verificacion
```

No leer `.env*` ni disparar `e2e-mutation` o workflows manualmente durante revisión; no levantar Docker ni Supabase. Toda mutación futura de `src/security/headers.ts` se ejecuta solo en runner trusted sobre `develop` ya mergeado, con patch revisado, nunca en un Preview público con secretos.
