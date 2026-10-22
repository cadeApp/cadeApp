# Evidencia y comandos — PR #501 / R1

## Fuentes

Se inspeccionaron `e2e/specs/security-headers.spec.ts`, `src/security/headers.ts`, `src/security/headers.test.ts`, `next.config.ts`, la ficha T-391 desde develop, bitácora, el patrón del formulario en `src/features/requests/components/create-request-form.tsx`, `src/ui/map.tsx` y fixtures E2E. HEAD: `bbc4b4f1423efc3b14795d261d2f018bbce5d59f`.

En el HEAD, el test sí pulsa el botón que monta Google Maps y espera el recurso real; este cambio es posterior a los `6 passed` declarados en la bitácora. La revisión no pudo reproducirlo: `git ls-remote https://github.com/cadeApp/cadeApp.git` local devuelve `Could not resolve host: github.com`.

## Harness completo para inspección independiente (solo lectura)

Copiar y ejecutar íntegro desde el checkout del SHA:

```bash
cat >/tmp/pr501-inspeccion.mjs <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const s=fs.readFileSync('e2e/specs/security-headers.spec.ts','utf8');
const f=fs.readFileSync('src/features/requests/components/create-request-form.tsx','utf8');
const m=fs.readFileSync('src/ui/map.tsx','utf8');
assert.match(f,/showDropoffMap\s*&&/);
assert.match(f,/<MapPicker/);
assert.match(m,/data-testid="map-container"/);
assert.match(s,/waitForResponse/);
assert.ok(s.includes(String.raw`maps\.googleapis\.com`));
assert.match(s,/fijar en mapa interactivo/i);
assert.match(s,/getByTestId\('map-container'\)/);
console.log('Comprobaciones estáticas: OK (no sustituye E2E)');
JS
node /tmp/pr501-inspeccion.mjs
```

**Batería propia propuesta, NO ejecutada:** M1 abortar temporalmente `**/maps.googleapis.com/maps/api/js**` con `merchantPage.route(...,route=>route.abort())` antes del click (RED en la aserción de mapa funcional); M2 bloquear `maps.gstatic.com` si es realmente un recurso requerido (RED o documentar si no tiene objetivo); restaurar `unroute` o usar contexto limpio y obtener GREEN sin mocks. Las mutaciones son **efímeras del browser**, no se commitean ni despliegan. La prueba original debe quedar sin route, con mapas reales.

## Comandos propuestos al agy

```bash
git pull --ff-only origin feat/T-391-security-headers
git rev-parse HEAD
git status --short
pnpm typecheck > /tmp/pr501-typecheck.log 2>&1
pnpm lint > /tmp/pr501-lint.log 2>&1
pnpm test > /tmp/pr501-unit.log 2>&1
tail -n 15 /tmp/pr501-unit.log
CI=true pnpm exec playwright test e2e/specs/security-headers.spec.ts --project=chromium --workers=1 --retries=0 > /tmp/pr501-e2e.log 2>&1
tail -n 24 /tmp/pr501-e2e.log
git fetch origin
git merge-tree --write-tree origin/develop HEAD
git ls-remote origin feat/T-391-security-headers
```

`PLAYWRIGHT_TEST_BASE_URL` debe apuntar al Preview de develop, nunca producción; no crear ni leer `.env*`, ni copiar secretos. Registrar el artefacto `csp-report-only.json` minimizado sin credenciales. Si el test falla por Maps, no falsear RED/GREEN: reportar el fallo, corregir causa y volver a correr. El commit de revisión es exclusivamente documentación y no exige CI verde adicional por sí solo.


## Ronda 2 — validación independiente de la evidencia sobre `7c5aee2b0a9e53770cad20641cd451af818cee54`

La revisión consultó dos versiones de cada uno de estos archivos, comparando `sha` de blob: `next.config.ts`, `src/security/headers.ts`, `src/security/headers.test.ts`, `e2e/specs/security-headers.spec.ts`; **4/4 iguales** con la versión `bbc4b4f1`. `git diff` local no fue posible por bloqueo de red; la comparación de GitHub muestra solo documentos de revisión y log.

También **se ejecutó** un validador mecánico sobre las cadenas leídas del repositorio: **9/9 reglas verdaderas** (GREEN sin retries, mutación con bloqueo maps, TimeoutError rojo, GREEN después de restauración, desglose 2+2 CSP, E2E monta mapa, E2E espera Google, DOM funcional, ningún mock de éxito). Ese control constata **coherencia del registro** y NO constituye reproducción independiente de Playwright.

Harness íntegro, reejecutable desde un checkout del SHA:

```bash
cat >/tmp/pr501-r2-evidencia.mjs <<'JS'
import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=(path)=>fs.readFileSync(path,'utf8');
const log=read('docs/tasks/log/T-391.md').split('## 2026-10-21 — Lautaro073 (Claude Code) — PR501-H01:')[1] ?? '';
const spec=read('e2e/specs/security-headers.spec.ts');
const form=read('src/features/requests/components/create-request-form.tsx');
const checks=[
  ['GREEN spec / cero retries', /7 passed/.test(log)&&/retries=0/.test(log)],
  ['Mutante aborta recursos Maps', log.includes('merchantContext.route')&&log.includes('route.abort()')&&log.includes('googleapis|gstatic')],
  ['RED con TimeoutError de respuesta Maps', /1 failed/.test(log)&&/TimeoutError:\s*page\.waitForResponse/.test(log)],
  ['GREEN luego de restaurar', /1 passed/.test(log)&&/Restaurado/i.test(log)],
  ['Report-Only 2 feed + 2 formulario', /2 en el feed/.test(log)&&/2 en la nueva solicitud/.test(log)&&/Vercel Live/.test(log)],
  ['Spec abre mapa a pedido', /fijar en mapa interactivo/i.test(spec)&&/getByRole\('button'/.test(spec)&&/showDropoffMap\s*&&/.test(form)],
  ['Spec espera Maps exitoso', spec.includes('waitForResponse')&&spec.includes('response.ok()')],
  ['Spec comprueba DOM del mapa', spec.includes("getByTestId('map-container')")&&spec.includes("getByRole('region', { name: 'Map' }")],
  ['Spec sin mocks exitosos de Maps', !/route\.fulfill|test\.skip|test\.only/.test(spec)],
];
for(const [name,pass] of checks) console.log((pass?'PASS':'FAIL')+' '+name);
assert.equal(checks.filter(x=>x[1]).length,9);
console.log('PASS 9/9 controles documentales; NO ejecuta E2E ni mutaciones.');
JS
node /tmp/pr501-r2-evidencia.mjs
```

### CI inspeccionado (antes del commit de revisión)

- SHA `bbc4b4f1`: CI #39706714620 `cancelled` aunque jobs unit/typecheck/build/lint/audit/bundle-budget exitosos. `db-tests` reportó `Result: PASS` en su log antes de cancelarse. E2E Preview #39706848472, job `e2e-preview` cancelado. No afirmar `success` del conjunto.
- SHA `7c5aee2b`: CI #39707608956 en marcha; typecheck/build/audit/lint/bundle-budget exitosos; unit y db-tests en curso. E2E Preview #39707734808 pendiente; Vercel success. La bitácora declara E2E local 7 passed y mutante RED/retorno GREEN sobre mismo código; no hubo reproducción de navegador desde el contenedor.

No se corrieron Supabase, Docker, comandos contra Vercel remoto ni mutaciones inseguras. **La evidencia del autor se cotejó, no se hizo pasar por una corrida del revisor.**
