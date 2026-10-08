# Evidencia de lectura independiente — PR #305, ronda 1

Revisión estática contra `fa9a28a6d8e07d1a89bfe1ae754ac22473aafa22` (T-350), `develop` (código actual) y rama `feat/T-309-uploads-a11y` (spec bloqueado). La consulta GitHub devolvió:

- HEAD: `fa9a28a6...`; base: `0293fe381...`; 1 commit ahead, 0 behind; mergeable=true.
- Diff: solo `docs/implementation-plan.md`, `docs/tasks/T-350.md` y `docs/tasks/log/T-350.md`, +133/-0.
- `src/app/trips/[id]/page.tsx:43-67`: merchant → `TripMerchantContainer`, courier → `TripCourierContainer`.
- `e2e/specs/uploads-a11y.spec.ts:294-318`: `DoD: axe AA en viaje` usa `loginAsCourier(0, page)`; no `loginAsMerchant` en esa prueba.
- `src/features/trips/components/trip-route-map.tsx:171-185,239-266`: rama `isMapAvailable` y `route-map-fallback`.
- `package.json` de `develop`: NO tiene `@axe-core/playwright`; T-309/#253 agrega `@axe-core/playwright@4.13.0` a package/lock e importa `AxeBuilder` desde su spec.
- `docs/tasks/T-350.md:84-89`: promete el GREEN del test único de viaje y una PR temporal, sin exigir C06 separado, dependencia axe completa ni canvas visible.

## Harness completo de lectura estática (para reproducir desde el repo)

Guardar el siguiente archivo en `/tmp/pr305-audit.mjs`. NO modifica ningún archivo ni contiene credenciales:

```js
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const task = read('docs/tasks/T-350.md');
const spec = read('e2e/specs/uploads-a11y.spec.ts');
const pkg = read('package.json');
const route = read('src/features/trips/components/trip-route-map.tsx');
const tripPage = read('src/app/trips/[id]/page.tsx');

const section = task.split('- [ ] **RED y GREEN:**')[1]?.split('- [ ] Sin cambios en el comportamiento del mapa:')[0] ?? '';
const test = spec.split("test('DoD: axe AA en viaje'")[1]?.split("test('DoD: axe AA en onboarding'")[0] ?? '';
const facts = [
  ['F1 ruta tiene merchant/courier', tripPage.includes("profile.role === 'merchant'") && tripPage.includes("profile.role === 'courier'")],
  ['F2 E2E de viaje solo usa courier', test.includes('loginAsCourier') && !test.includes('loginAsMerchant')],
  ['F3 el SDK puede renderizar fallback', route.includes('isMapAvailable ? (') && route.includes('route-map-fallback')],
  ['F4 develop no tiene paquete axe', !pkg.includes('"@axe-core/playwright"')],
  ['F5 el spec de T-309 sí usa axe', spec.includes("from '@axe-core/playwright'")]
];
const contracts = [
  ['H01 plan de test C06', section.includes('loginAsMerchant') && section.includes('trip-axe-merchant.review.spec.ts')],
  ['H02 composición con package+lock', section.includes('package.json') && section.includes('pnpm-lock.yaml') && section.includes('feat/T-309-uploads-a11y')],
  ['H03 precondición mapa real', section.includes('route-map-fallback') && section.includes('map-pin-pickup') && section.includes('map-pin-dropoff')]
];
for (const [name, pass] of facts) console.log('CONTROL ' + name + ': ' + (pass ? 'GREEN' : 'RED'));
for (const [name, pass] of contracts) console.log('FICHA ' + name + ': ' + (pass ? 'GREEN' : 'RED'));
if (!facts.every(([, pass]) => pass)) process.exitCode = 2;
else if (!contracts.every(([, pass]) => pass)) process.exitCode = 1;
```

**Ejecución esperada en HEAD original:** F1–F5 GREEN, H01–H03 RED, exit 1. El mismo control debe volverse GREEN cuando la ficha especifique las tres garantías. Este harness detecta **requisitos escritos** (no reemplaza Playwright). Para correrlo en `/tmp`, antes hay que hacer el checkout completo de la rama temporal T-309 con acceso al spec de esa rama, o copiar solo `uploads-a11y.spec.ts` desde esa rama al working tree efímero; nunca agregarlo a la PR #305.

**Ejecución remota de inspección de hechos:** la revisión consultó los cinco archivos por GitHub y confirmó F1–F5 por comparación de contenido; no ejecutó este harness en un clon local porque no hubo red desde el contenedor. Ninguna mutación E2E ni salida Vitest se presenta como corrida real.

## RED conductual obligatorio para la futura PR de código T-350

- **H01:** test temporal C06: autenticación merchant + seed `matched` + vista merchant exclusiva (`Repartidor asignado`) + axe 6 tags. Mutar la autenticación a courier debe dar RED por vista equivocada; restaurar GREEN.
- **H02:** rama temporal basada en `feat/T-309-uploads-a11y` y con código T-350, preservando package + lock. Al omitir la dependencia, `pnpm install --frozen-lockfile` / `pnpm typecheck` debe fallar por el paquete; con composición correcta, GREEN. No desplegar ni mergear la mutación.
- **H03:** forzar en el arnés aislado ausencia de Google SDK; una precondición positiva del mapa (`route-map-fallback` no presente, `map-pin-pickup` y `map-pin-dropoff` presentes, contenedor real visible) debe dar RED. Restaurar SDK y obtener GREEN con axe; en producción, nunca manipular el DOM ajeno.

## Checks de esta ronda

La lectura de metadatos del commit indicó `typecheck/lint/unit/build/db-tests/audit/bundle-budget=success` y `approval-policy=failure` por falta de informe. **No se ejecutaron tests en esta ronda**, ni se inspeccionaron logs CI por existir bloqueantes. No hubo ejecución local de Supabase o Docker. El primer `git ls-remote` en el contenedor falló por DNS (`Could not resolve host: github.com`); los recursos se leyeron por el conector GitHub.

Cuando quien haga los arreglos termine, deberá pegar salidas reales de `pnpm vitest run tools/verify-fichas.test.ts` y `git diff --check`, SHA publicado y `git ls-remote origin docs/T-350-ficha`.
