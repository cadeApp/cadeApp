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


---

## Corrección y verificación independiente — ronda 2 (2026-10-08)

**Corrección de la propia revisión:** el script de ronda 1 no es válido como gate para la ficha corregida: secciona erróneamente el DoD corto y presupone un spec de T-309 ausente de esta rama. No se ha usado para cerrar la ronda 2. En una primera mutación superficial, comprobar solo la aparición de la frase `Repartidor asignado` dio un falso GREEN cuando se quitó la aserción positiva (la frase seguía en el RED explicativo). La revisión pasó a exigir el locator completo y fue reejecutada.

**Comprobado contra contenido de GitHub en SHA `b4d3580e57f76cb4c5b22d8437e7234fa276bfbc`:** las tres secciones H01/H02/H03 quedaron GREEN, **11/11 mutaciones in-memory quedaron RED**, sin modificar la rama. El control confirma el contenido de una **ficha**, no un E2E real del futuro T-350.

### Harness completo autocontenido

```js
// Guardar como /tmp/pr305-r2-verify.mjs y ejecutar desde la raíz del repo:
// node /tmp/pr305-r2-verify.mjs
import { readFileSync } from 'node:fs';
const doc = readFileSync('docs/tasks/T-350.md', 'utf8');
const section = (d, a, b) => {
  const start = d.indexOf(a);
  if (start === -1) return '';
  const end = d.indexOf(b, start + a.length);
  return end === -1 ? '' : d.slice(start, end);
};
const containsAll = (s, terms) => terms.every(t => s.includes(t));
const checks = {
  H01: d => containsAll(section(d, '### E2E provisional C06', '### E2E provisional R07'), [
    'loginAsMerchant(page)',
    "getByRole('heading', { name: 'Repartidor asignado' })",
    "getByRole('heading', { name: 'Viaje en curso' })",
    'AxeBuilder', 'wcag22aa', 'audit.violations', 'audit.passes',
    'loginAsCourier(0, page)'
  ]),
  H02: d => containsAll(section(d, '### Composición de la PR temporal', '### E2E provisional C06'), [
    'feat/T-309-uploads-a11y', 'package.json', 'pnpm-lock.yaml',
    '@axe-core/playwright@4.13.0', 'pnpm install --frozen-lockfile', 'NEVER MERGE'
  ]),
  H03: d => containsAll(section(d, '### Precondición de mapa real', '### Límites'), [
    'trip-route-map', 'route-map-fallback', 'map-pin-pickup', 'map-pin-dropoff',
    'canvas real de Google Maps', 'SDK de Maps no cargue'
  ]) && containsAll(section(d, '### Límites', '## Regla de pruebas'), [
    'navegación por teclado', 'MutationObserver'
  ])
};
const mutations = [
  ['M01 merchant login', 'H01', d => d.replace('loginAsMerchant(page)', 'loginAsAdmin(page)')],
  ['M02 C06 assertion', 'H01', d => d.replace("getByRole('heading', { name: 'Repartidor asignado' })", "getByText('Carga')")],
  ['M03 WCAG22AA', 'H01', d => d.replace("'wcag22aa'", "'wcag21aa'")],
  ['M04 wrong base', 'H02', d => d.replace('desde el HEAD de \`feat/T-309-uploads-a11y\`', 'desde el HEAD de \`develop\`')],
  ['M05 missing axe dependency', 'H02', d => d.replace('incluido \`@axe-core/playwright@4.13.0\`', 'sin paquete de axe')],
  ['M06 missing lockfile', 'H02', d => d.replace('\`package.json\` y \`pnpm-lock.yaml\`', '\`package.json\`')],
  ['M07 fallback accepted', 'H03', d => d.replace("- \`getByTestId('route-map-fallback')\` con count 0;", '- se permite fallback;')],
  ['M08 missing pickup pin', 'H03', d => d.replace("\`getByTestId('map-pin-pickup')\` y \`getByTestId('map-pin-dropoff')\`", "\`getByTestId('map-pin-dropoff')\`")],
  ['M09 canvas absent', 'H03', d => d.replace('canvas real de Google Maps', 'ícono de mapa')],
  ['M10 no SDK negative', 'H03', d => d.replace('SDK de Maps no cargue', 'SDK de Maps siempre cargue')],
  ['M11 keyboard lost', 'H03', d => d.replace('la navegación por teclado del mapa', 'el tema visual del mapa')],
];
const controlOk = Object.entries(checks).every(([id, fn]) => {
  const ok = fn(doc);
  console.log(\`CONTROL \${id}: \${ok ? 'GREEN' : 'RED'}\`);
  return ok;
});
let reds = 0;
for (const [name, id, mutate] of mutations) {
  const mutant = mutate(doc);
  const isRed = mutant !== doc && !checks[id](mutant);
  if (isRed) reds++;
  console.log(\`\${name}: \${isRed ? 'RED' : 'NO-RED'}\`);
}
console.log(\`Mutaciones RED: \${reds}/\${mutations.length}\`);
if (!controlOk || reds !== mutations.length) process.exitCode = 1;
```

Este archivo es autónomo, se ejecuta con Node 22 desde la raíz del checkout de esta PR y **no toca el árbol**. El script se inspeccionó y la misma lógica se ejecutó con el texto obtenido directamente por el conector GitHub: H01/H02/H03 GREEN y 11 mutaciones RED. No se afirmó haber corrido `node /tmp/pr305-r2-verify.mjs` desde un clone local, que no estuvo disponible por DNS.

### Resumen de checks remotos del HEAD revisado

- `unit`: 123 test files PASS; 1942 tests PASS; workflows 75/75 PASS; ADR 6/6 PASS.
- `db-tests`: Files=19 Tests=1854 Result PASS; Files=1 Tests=10 Result PASS; paso local types/diff exitoso.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: `success` en GitHub. El `bundle-budget` tiene warning en rutas admin de 235 kB (fuera de alcance).
- `approval-policy`: rojo inicial por faltar informe completo **en el cuerpo**. El workflow se dispara al editar PR; el comentario solo no basta.
- `e2e-preview`: pendiente al inspeccionar el estado de commit, no se declara éxito inexistente ni se lo usa para validar la ficha.
