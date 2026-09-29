# PR #122 — T-205 — Ronda 1

**Fecha:** 2026-09-28  
**SHA revisado:** `79d3aeaa4949bd85820467592dafb62fdc2232d4`  
**Resultado:** **CON BLOQUEANTES (3)**

## Alcance y sincronización

- La rama está 0 commits behind y 1 ahead respecto del `develop` de apertura en el SHA revisado.
- Diff funcional: `docs/tasks/log/T-205.md` y `src/features/requests/dod-t205.test.tsx`.
- La ficha se leyó desde `develop`.
- T-115, T-116, T-117, T-118, T-201, T-202 y T-204 están mergeadas.
- Ambos archivos están permitidos por la ficha.
- La PR sigue en fase RED inicial; no se evalúa como implementación terminada.
- CI final no se usa para cierre mientras haya bloqueantes.

## Decisión resuelta

### D01 — tooling de axe

Lautaro073 eligió **1-A**:

- no agregar dependencias nuevas a T-205;
- no modificar `package.json` ni lockfile para axe/Playwright;
- eliminar el acceso a internals de pnpm;
- conservar en tests de repo regresiones semánticas concretas;
- obtener la evidencia integral de accesibilidad desde la verificación real de navegador/Lighthouse exigida por la ficha;
- si no puede producirse una corrida axe real sin agregar dependencias, declararla pendiente en vez de inventarla.

## BLOQUEANTES

### PR122-H01 — El RED de bundle depende de un build previo y no mide el First Load JS canónico

**Archivo:** `src/features/requests/dod-t205.test.tsx:171-213`  
**Severidad:** alto · efficiency / test-coverage  
**Patrón:** `P08-control-no-cubre-lo-que-dice`

El test busca `.next/app-build-manifest.json`, falla si el artefacto no existe y luego vuelve a gzippear manualmente los archivos listados. Eso no es el contrato que usa cadeApp: el control canónico genera `pnpm build`, captura la tabla de Next y `.github/workflows/check-bundle-budget.mjs` evalúa el **First Load JS por ruta**.

En un checkout limpio, el job de tests no genera primero `.next`; por lo tanto la prueba puede quedar roja en `fs.existsSync(manifestPath)` sin demostrar una ruta > 180 kB. Si existe un `.next` previo, puede medir otro build.

**Qué corregir:** sacar la medición de bundle de Vitest. La fase RED debe usar un build limpio del SHA y registrar los valores reales por ruta con el checker existente. Si el build exacto no contiene ninguna ruta > 180 kB, no fabricar una: registrarlo y frenar ese punto del DoD. Para GREEN, repetir la misma medición y exigir todas las rutas auditadas <= 180 kB.

**Evidencia:** `ci.yml` separa `unit` de `build`; `bundle-budget` consume la salida textual del build mediante `check-bundle-budget.mjs`.

---

### PR122-H02 — El control de 48 px cubre una pantalla y reconoce strings, no targets

**Archivo:** `src/features/requests/dod-t205.test.tsx:116-138`  
**Severidad:** alto · accesibilidad / test-coverage  
**Patrón:** `P08-control-no-cubre-lo-que-dice`

La prueba renderiza solo `CreateRequestForm` y considera “sub-48” tres substrings: `min-h-[44px]`, `min-h-10` y `py-1.5`. Es un proxy de clases, no una medición del target renderizado, y no cubre las otras superficies del DoD.

El barrido de la clase completa en las superficies clave ya muestra:

- `CreateRequestForm`: usar ubicación, Sí/No y presets con 44 px.
- `RequestOffersList`: Documentación/Precio con `py-1.5` sin altura mínima.
- `OfferSheet`: chips rápidos con `min-h-10` (40 px).
- `VehicleForm`: uploads Licencia/Seguro con `h-10` (40 px); el test ni busca `h-10`.

El test podría ponerse verde corrigiendo solo `CreateRequestForm` y dejar incumplimientos reales.

**Qué corregir:** llevar los targets conocidos a 48 px y auditar en navegador las cinco superficies clave. La prueba persistente puede proteger controles concretos, pero no debe presentarse como auditoría exhaustiva. La evidencia final debe medir el tamaño renderizado a 390 y 360 px, con teclado y sin overflow.

---

### PR122-H03 — axe se importa desde internals de pnpm sin dependencia declarada

**Archivo:** `src/features/requests/dod-t205.test.tsx:7-10`  
**Severidad:** alto · conventions / test-coverage  
**Patrón:** `P15-entregable-declarado-pero-no-ejecutable`

La suite requiere:

`../../../node_modules/.pnpm/axe-core@4.13.0/node_modules/axe-core`

`axe-core` no figura en `package.json`, T-205 declara ninguna dependencia nueva y esa ruta depende del layout interno de pnpm y de una dependencia transitiva concreta.

D01 ya fijó el rumbo: **1-A**, sin agregar tooling nuevo.

**Qué corregir:** eliminar `createRequire` y el require privado. Convertir el caso de headings en una regresión semántica local que pueda fallar sin axe —por ejemplo, prohibir saltos de nivel en los headings renderizados— y corregir `TripMerchantView`, que hoy tiene `h1 -> h3`. La auditoría AA/axe integral queda en navegador; si no puede ejecutarse realmente, se declara pendiente.

## MEJORAS

Ninguna separada en esta fase.

## Checks de la revisión

- Ficha, reglas, diff, bitácora, componentes consumidores y controles de CI: inspección ✅.
- Vitest/build local: **no ejecutados por esta revisión** en el entorno actual; no se inventa evidencia runtime.
- CI final: no evaluado para aprobación mientras existan bloqueantes.

## Estado

No aprobar ni mergear. Corregir H01-H03, continuar T-205 y volver a revisión sobre un nuevo SHA.
