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
assert.match(s,/maps\.googleapis\.com/);
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
