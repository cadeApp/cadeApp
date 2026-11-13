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
