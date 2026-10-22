# PR #305 · Ronda 1 — T-350

**Fecha:** 2026-10-08. **Revisión independiente:** ChatGPT.  
**SHA inspeccionado:** `fa9a28a6d8e07d1a89bfe1ae754ac22473aafa22`; **base `develop`:** `0293fe381762f60bd47a7ba3b6f3152ee0f08bd8`.  
**Resultado: CON BLOQUEANTES (3).**

## Lectura y delimitación

Se leyeron `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, lecciones históricas, issue #296, ficha de T-309 desde `develop`, bitácora T-309 en su rama y documentos de la PR. `docs/tasks/T-350.md` **no existe en develop**, es el archivo nuevo sometido a revisión: por tanto no hay una ficha anterior en `origin/develop` que cotejar.

El diff del HEAD tiene solo tres archivos permitidos de documentación: `docs/implementation-plan.md` (+1), `docs/tasks/T-350.md` (+109) y `docs/tasks/log/T-350.md` (+23). No implementa código; su calidad depende de que el DoD que encarga sea realmente ejecutable. GitHub informó la rama **1 commit adelante, 0 detrás** de develop y `mergeable=true`; esto no reemplaza `git merge-tree`, que no se ejecutó porque el contenedor no tuvo conectividad al host GitHub.

**Decisión recibida antes de cerrar:** Lautaro073 eligió **1-A**. Se exige axe en **R07 y C06**, agregando un test para C06 únicamente en la PR temporal de verificación sin tocar el spec original de T-309. No quedan decisiones para Lautaro073 en esta ronda.

## Hallazgos bloqueantes

### PR305-H01 — La evidencia E2E pedida no cubre C06 · ALTO

- **Ubicación:** `docs/tasks/T-350.md:68,84-89`.
- **Hallazgo:** la ficha exige cero violaciones axe en R07 **y C06**, pero su único GREEN explícito es `DoD: axe AA en viaje` del spec T-309. En `e2e/specs/uploads-a11y.spec.ts` de `feat/T-309-uploads-a11y` ese test ejecuta `loginAsCourier(0, page)`; no usa `loginAsMerchant`. La ruta compartida `src/app/trips/[id]/page.tsx:43-67` elige **TripMerchantContainer** o **TripCourierContainer** según el rol. Por eso verde en R07 no prueba C06.
- **Corrección requerida:** especificar un segundo test de axe para C06, exclusivamente en la PR temporal `review/T-350-trip-axe` (archivo de prueba temporal propio), login merchant usando el fixture existente, seed de un viaje `matched` del mismo comercio, precondición de la vista C06, mismos seis tags WCAG, `violations=[]` y `passes>0`. Conservar íntegro el test original de T-309. Registrar ambos resultados, SHAs y jobs; cerrar la PR aislada sin merge.
- **Prueba adversarial posterior:** en el test temporal, sustituir `loginAsMerchant` por `loginAsCourier` y exigir que la afirmación positiva de UI exclusiva de C06 falle; demostrar GREEN restaurándolo. No fabricar RED mediante expectations adulteradas ni mocks que eviten la ruta.

### PR305-H02 — Composición E2E sin dependencias explícitas · MEDIO

- **Ubicación:** `docs/tasks/T-350.md:59,84-89`.
- **Hallazgo:** el spec T-309 importa `@axe-core/playwright`; esa dependencia y su lockfile se agregan en la **rama de T-309/#253**, no están en el `package.json` de `develop`. La instrucción de “combinar código + spec” sin definir el punto de partida permite generar una PR aislada que no compile, o reintroducir dependencies en la PR definitiva contra la prohibición de T-350.
- **Corrección requerida:** la PR aislada de GREEN debe **partir de la rama T-309 y conservar su package.json + pnpm-lock.yaml**, más el código corregido de T-350, sin alterar el spec original; añadir en esa rama únicamente el test temporal C06. Es una composición de verificación, no un cambio de dependencias autorizado en la PR real de T-350. Especificar `pnpm install --frozen-lockfile`, `pnpm typecheck` y los E2E correspondientes.
- **Prueba adversarial posterior:** una composición sin la dependencia importada debe fallar por módulo ausente, mientras que el árbol combinado íntegro debe instalar y ejecutar. Nunca alterar expectativas para conseguir verde.

### PR305-H03 — Axe puede dar GREEN sin ejercer el mapa real · ALTO

- **Ubicación:** `docs/tasks/T-350.md:76-93`.
- **Hallazgo:** `trip-route-map.tsx` tiene un condicional `isMapAvailable` y, si falla Google Maps, renderiza `route-map-fallback`. El test de T-309 inspecciona `violations` pero no exige render del mapa interactivo. Una reparación que deje el mapa en fallback podría hacer desaparecer `aria-hidden-focus` y volver verde la auditoría sin reparar el nodo original ni conservar la funcionalidad.
- **Corrección requerida:** ambos E2E en la PR aislada deben fallar si la pantalla muestra fallback y exigir mapa realmente inicializado y sus dos pines de retiro y entrega antes de axe. Se pueden inspeccionar el contenedor propio `trip-route-map`, los nodos propios `map-pin-pickup` y `map-pin-dropoff` y el estado de render de Google sin mutar el DOM ajeno. Registrar la evidencia de `target`, `html` y ancestros del nodo infractor; si el SDK no carga, **fallar cerrado**, no declarar GREEN.
- **Prueba adversarial posterior:** en el arnés temporal provocar fallo de carga del SDK, comprobar que la precondición da RED por ausencia de mapa (no por fallo de axe), restaurar SDK y obtener GREEN real. Además comprobar que los cambios oficiales de Google/@vis.gl no inutilizan teclado, arrastre, pines ni traza. No usar `MutationObserver`, `inert`, `tabindex` sobre nodos ajenos, `exclude` de axe o `keyboardShortcuts={false}` como sustituto de una solución accesible.

## Lo correcto y sin desvíos

- Los tres lugares con texto normal `text-primary` se localizaron en producción: cobro R07, estado C06 (condicional `matched`) y pie del mapa C06. El token `text-primary-dark` ya existe en CSS/Tailwind.
- Separar el defecto previo del alcance de T-309 evita tocar a escondidas los archivos permitidos de P3.
- La ficha prohíbe cambiar tokens globales, suprimir axe y manipular el DOM de Google; la decisión previa de opciones oficiales y escalar si no alcanzan se conserva.
- El texto indica una PR `REVIEW ONLY / NEVER MERGE`: se debe mantener y cerrar tras evidencia, no incorporar al producto.

## Chequeos y límites de evidencia

- **Inspección independiente:** verificación de hechos E1–E7 en `evidencia/comandos.md`, todos confirmados contra archivos remotos al SHA correspondiente.
- **CI (metadatos del HEAD antes del commit de revisión):** `typecheck`, `lint`, `unit`, `build`, `db-tests`, `audit` y `bundle-budget` reportaron success; `approval-policy` reportó failure al no existir todavía este informe. Según la regla local, con bloqueantes **no se usan verdes de CI para aprobar la ronda**, y no se leyó su log de detalle.
- **No ejecutado:** `pnpm vitest`, `pnpm test`, `git merge-tree`, mutaciones reales de Playwright, docker, Supabase local. El clon remoto por HTTPS no fue accesible desde el contenedor; no se inventan resultados ni pruebas.
- **No se validó** un GREEN axe en ninguna vista dentro de esta PR documental, ni se exige todavía: debe exigirse a la PR posterior de implementación.
- **Regresión futura a impedir:** GREEN sin C06; GREEN con canvas fallback; dependencia axe ausente en composición aislada. Los controles positivos y mutaciones se ejecutan en la futura PR de implementación.

## Instrucciones para corregir

Solo docs en esta PR: `docs/tasks/T-350.md` y `docs/tasks/log/T-350.md`, sin tocar producción, tests existentes, dependencias, `docs/revision-pr/**` ni reescribir el plan si no es estrictamente necesario. Editar las secciones “DoD” y “RED y GREEN” para precisar las tres garantías; hacer constar **D01/1-A** y ejemplos ejecutables en la bitácora. Correr `pnpm vitest run tools/verify-fichas.test.ts` y `git diff --check`; dejar salida real. Commit Conventional Commits `[T-350]`, push sin rebase/force/amend.

**Siguiente paso:** ronda 2 sobre HEAD publicado después de la corrección. No aprobar ni mergear en esta ronda.
