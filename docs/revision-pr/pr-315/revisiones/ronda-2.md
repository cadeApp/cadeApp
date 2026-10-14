# Revisión independiente — PR #315 / T-347-T-313 — Ronda 2

**Fecha:** 2026-10-09 · **SHA exacto de código:** `cc1f5fde8b4330db6ae1485e8297072785103cbe` · **develop:** `92cd258545f25e162ada062c0c22c02ff17840b8`
**Veredicto: CON BLOQUEANTES (2): H01 parcial + H02 nuevo.** No aprobar ni mergear #315.

## Qué se corrigió correctamente

- El autor consumió el commit de la revisión `affe4d0`, sin modificar `docs/revision-pr/pr-315/**`.
- Integró `origin/develop` sin rebase: incluye PR #314 y corrigió los 3 fallos E2E preexistentes de T-339. GitHub marca la rama mergeable; no se ejecutó `git merge-tree` en el entorno del revisor.
- Para `caseOracleProblems`, el test ya no busca `.toHaveURL(` indiscriminadamente en todo el spec: extrae cuerpo del caso y helper, comprueba llamada en bucle, primer `/merchant/dashboard` → `/courier/feed` y expectativas de las rutas merchant presentes. Las mutaciones anteriores M1/M2/M3 y variantes de negación/comentarios son detectadas según evidencia del autor; **no** se atribuye al revisor su ejecución de RED→GREEN.
- El catálogo, `expectedFailure`, el patch de `guards.ts`, runner trusted y `SPEC_PENDING_MERGE` permanecen acotados. El E2E real de #251 aún no está en `develop`; el `repository_dispatch` está pendiente y no se disparó.

## CI verificado sobre este SHA (fuentes: logs del propio run)

| Check | Observado |
|---|---|
| CI `37885244409`: unit | 125 archivos Vitest, workflow `# tests 77 / # pass 77 / # fail 0`, ADR 6 |
| db-tests | pgTAP 20 archivos / 1903 tests, `Result: PASS`; bloque adicional 10 tests `PASS` |
| typecheck, lint, build, audit, bundle-budget | PASS |
| trusted E2E `37885398811` | Checkout **`cc1f5fde8b4330db6ae1485e8297072785103cbe`**; Chromium 56 passed; global-settings 3 passed; gate success |
| approval-policy | FAIL por falta de informe sin bloqueantes; **sigue correspondiendo FAIL** mientras H01/H02 sigan abiertos |

## H01 — BLOQUEANTE · alto · parcial

**`.github/workflows/verify-workflows.test.mjs` — `caseOracleProblems`, `helperBody` y `CASE_ORACLES` (líneas ~1824–1940).** La validación nueva pasa con el helper real, pero aún emplea `helper.includes(oracle.helperAssertion)` y un regex del bucle que no prueban que la aserción sea instrucción ejecutable.

**Mutaciones propias de esta ronda (NO copiadas del autor):**
- **X2:** reemplazar `await expect(page).toHaveURL(expectedUrl);` por `const decoy = 'await expect(page).toHaveURL(expectedUrl);';` dentro del helper: devuelve `[]` (GREEN indebido).
- **X3:** colocar la aserción dentro de `if (false) { ... }`: devuelve `[]` (GREEN indebido).
- **X4:** colocar el bucle completo dentro de `if (false) { ... }`: devuelve `[]` (GREEN indebido).

**Demostración:** se ejecutó con Node en aislamiento una copia exacta de las funciones del nuevo HEAD y un fixture fiel a los símbolos de #251. CONTROL GREEN, X2/X3/X4 GREEN; evidencia reproducible y harness que carga el archivo del SHA real en [comandos.md](../evidencia/comandos.md). No se ejecutó la suite `node --test` completa ni el Playwright mutado localmente.

**Corrección:** respetar decisión 1-A sin dependencias. Para este helper concreto exigir una **secuencia de sentencias top-level** realmente reconocible, por ejemplo dentro del cuerpo de `expectMerchantPanelBlocked`: `await page.goto(path);` seguido directamente de `await expect(page).toHaveURL(expectedUrl);` (permitir espacio y líneas vacías, no texto de strings). Para el caso, ligar la declaración de `routes` con un bucle top-level, de modo que envolverlo en `if(false)` no pase. Asegurar que el detector no cuente comentarios/string literals ni expresiones inaccesibles. No reescribir `src/**` ni el spec de #251, no inventar RED.

## H02 — BLOQUEANTE · alto · nuevo

**`.github/workflows/verify-workflows.test.mjs` — `caseOracleProblems` (líneas ~1877–1930).**

El detector afirma preservar un caso `DoD: Un courier no entra a (merchant)`, pero **no exige autenticación courier efectiva**. La mutación **X1** elimina `await loginAsCourier(0, page);` del caso: el matcher, las rutas y el helper continúan presentes, por lo que `caseOracleProblems` devuelve `[]` (**GREEN indebido**). Eso permitiría aceptar un spec que ya no prueba acceso de *courier* (aunque el Playwright real pudiera fallar por otra causa).

**Corrección:** en el cuerpo correcto del caso, exigir inmediatamente después de abrir el test la llamada activa `await loginAsCourier(0, page);` y que ocurra antes de recorrer rutas. Mantener las mismas comprobaciones sin agregar mocks. Probar nuevas mutaciones: login eliminado, sustituido por `loginAsMerchant`, comentado y movido dentro de `if(false)`; todas RED de este detector, control GREEN.

## Observación no bloqueante

**X5:** borrar una ruta secundaria como `/merchant/history` deja verde el detector porque este valida las rutas declaradas, no que la lista sea completa. No se exige ampliar el catálogo de T-347 con un listado hardcodeado adicional para cerrar esta PR: la mutación específica rompe la guarda general que protege toda la familia, y el spec real de T-313 aún requiere revisión propia. Registrar como riesgo de futura regresión de cobertura en T-313, sin confundirlo con una ejecución real fallida.

## Método / límites y tareas de la próxima ronda

- **Ejecutado por este revisor:** pruebas aisladas Node sobre copia exacta de las funciones revisadas, con fixture equivalente y cinco mutaciones independientes (ver harness). El harness para usar el código y spec reales en un clon está publicado, pero no se ejecutó contra el clon completo aquí por falta de acceso de red desde el contenedor.
- **Observado en GitHub CI:** unit, db-tests y E2E realmente verdes en `cc1f5fde8b4330db6ae1485e8297072785103cbe`; no equivale a mutaciones X1–X4 RED.
- **Autor:** debe producir GREEN sin mutar + RED para X1/X2/X3/X4 (o explicar cualquier mutación que no aplicó), `# pass/# fail` reales, conservar las baterías anteriores y bitácora; push y pedir nueva revisión del SHA.
- **Revisor siguiente:** volver a desafiar los arreglos con batería nueva no suministrada por el autor, verificar patch aplicable a develop y CI del HEAD nuevo.
- **No modificar:** `docs/revision-pr/**` desde agy, ficha, manifest, patch, spec, producción, secretos, workflows de ejecución. **No `repository_dispatch`** hasta merge de #251.

**Resultado:** 2 bloqueantes de calidad del control. Sin decisiones nuevas de producto: las correcciones se ciñen a la decisión ya tomada **1-A**.
