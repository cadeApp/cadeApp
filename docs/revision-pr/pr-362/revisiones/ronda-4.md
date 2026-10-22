# Informe de revisión independiente — PR #362 / T-353 — Ronda 4

**Fecha:** 2026-10-15. **HEAD de autor inspeccionado:** `aa191cbc039f3600cfc46abe79edc090c72a8f5f`.
**Base:** `develop@14c28ed3c41cb2bde92705fc018c7dd0df73245b`.
**Comparación:** `266f125..aa191cbc`, 1 commit del autor, solo `e2e/specs/multi-drop.spec.ts` y `docs/tasks/log/T-353.md`. No editó `docs/revision-pr/**`.
**Conclusión:** **CON BLOQUEANTES — H06 y H07**. H01–H05/H08 corregidos por inspección, **ninguno verificado-runtime por el revisor**. No aprobar ni mergear.

## Qué corrigió bien

- **H06 — comprobación de no-escritura y correlación exacta:** en `e2e/specs/multi-drop.spec.ts:965-977` ahora consulta IDs del comercio antes del test; `1041-1051` comprueba mismo conjunto tras el intento inválido; `1067-1087` identifica precisamente el único nuevo ID tras el submit válido; `1088-1127` valida publicación, no PII pública y contacto privado canonizado. Es preferible a consultar `order(created_at).limit(1)`. La corrección también preserva el control incondicional de existencia del teléfono introducido en R3.
- **H07 — registro más concreto:** `docs/tasks/log/T-353.md:134-184` añade cifras GREEN → RED → GREEN para H01–H05 sin reescribir sesiones anteriores, con salidas de aserción sintetizadas. Es más detallado que R3, pero **NO demuestra todavía reproducibilidad independiente**.
- **Scope:** los dos archivos del autor están en la allowlist; `src/**`, SQL, contratos y configuración no fueron modificados por P2. Decisiones **1B** y **2A** intactas.

## H06 — bloqueante: E2E Preview real sin evidencia

La ficha `docs/tasks/T-353.md:59,62` requiere ejecución Playwright contra **Vercel Preview + Supabase Develop**, aportando SHA, run y resultado. En lectura de GitHub exact-head `aa191cbc`: Vercel staging Preview reporta success, CI `38682707242` estaba in_progress, seis jobs iniciales verdes (`unit`, `lint`, `typecheck`, `build`, `audit`, `bundle-budget`), `db-tests` in_progress, `approval-policy` failure, `Supabase Preview` skipped, pero **sin contexto `e2e-preview`** entre los check-runs/statuses observados. `Vercel Preview Comments` no representa ejecución de Playwright.

**Evidencia:** el agy dice explícitamente `E2E Preview -> PENDIENTE` en bitácora línea 184; no declarar GREEN ni suponer fallo de Playwright. El workflow de la rama por defecto `.github/workflows/e2e-preview.yml` se dispara mediante `repository_dispatch` de Vercel y publica un commit status `e2e-preview`, asociado al SHA probado. No es un check ordinario de `pull_request`. La ausencia del status **no prueba por sí sola** qué falló en la integración; investigar evento, run `resolve-preview` y reporte con herramientas de solo lectura.

**Cierre exigido:** sin cambiar workflows, secretos, configs ni disparar ejecución manual, comprobar la activación automática del gate, su job `e2e-preview` y test T-353 recién agregado. Registrar **SHA del código desplegado, URL Preview, URL/run ID de Actions, estado final y número/nombre del test nuevo**. Deben coincidir. Si no aparece el dispatch tras el deploy, registrar bloqueo técnico objetivo en bitácora; no pedir aprobación/merge con el DoD incumplido. Si requiere acceso administrativo humano, informarlo expresamente y con la pantalla/ajuste concreto a revisar, no inventar credenciales.

## H07 — bloqueante: mutación H05 deja morir el arnés, no el invariante

**`docs/tasks/log/T-353.md:169-173`, comparado con `src/features/requests/actions.ts:45-55`.** El agy declara mutar:
```ts
const parsed = createDeliveryRequestSchema.safeParse(input);
// original:
if (!parsed.success) return err('VALIDATION_ERROR');
// mutante:
if (false && !parsed.success) return err('VALIDATION_ERROR');
const data = parsed.data;
if (!data.requestId) return err('VALIDATION_ERROR');
```
Cuando el input es inválido, `safeParse` devuelve `success:false` con `data:undefined`. El mutante sigue ejecutando y accede a `data.requestId` → **TypeError**, antes de poder llamar a la RPC. Este RED no demuestra que `requests/actions.test.ts` detecte una **escritura indebida o un bypass semántico**. Reproducí esta transición del objeto JS en un probe Node local: `TypeError: Cannot read properties of undefined (reading 'requestId')`. **El probe es aislado; no corrí Vitest**, y no afirmo que el log de P2 dijera explícitamente TypeError (solo anota "3 failed").

**Arreglo para la demostración:** mutar de forma temporal **solo** la regla semántica de `recipientName` en `src/features/requests/schemas.ts` para aceptar `<script>alert(1)</script>`, manteniendo estructura de Zod y `parsed.success=true`. Ejecutar `src/features/requests/actions.test.ts` con ese mutante: la **Action real debe llegar hasta la RPC** y el test `rechaza segundo drop con datos inválidos ...` debe fallar por la aserción `VALIDATION_ERROR` y/o `mockRpc.not.toHaveBeenCalled`, **no por excepciones del arnés**. Usar script `/tmp` con `finally` para restaurar contenido original, sin commit ni push de mutaciones, y registrar salida `Test Files`, `Tests` y la aserción efectiva del RED.

**Reproducibilidad restante:** bitácora declara GREEN/RED/GREEN para H01–H04 pero solo incluye resúmenes, **sin comandos completos ni harness** de H02–H05. Según el prompt y la regla de revisión, pegar scripts autocontenidos reproducibles o ruta del script en `/tmp` con su contenido exacto en nueva entrada append-only; para cada mutación, registrar control GREEN original → RED por el invariante → GREEN tras restauración. Nunca adulterar fixtures/tests ni llamar éxito a un error de TypeError, SyntaxError o un import roto. Las mutaciones E2E de seguridad están restringidas al mecanismo aprobado `e2e-mutation` (target develop), **no** a desplegar la PR mutada.

## Límites metodológicos y cobertura

- **Trabajo del autor vs revisión:** cifras de `pnpm` y RED reportadas por P2 son datos del autor. La revisión inspeccionó el código exact-head vía GitHub y ejecutó exclusivamente un control aislado Node de semántica `undefined.requestId`, sin ejecutar Zod/Actions/Vitest/Playwright sobre el repositorio. Por eso `verificado_en_sha=null` en todos los hallazgos.
- **Checks:** no se auditan logs completos CI ni se declara GREEN final mientras haya bloqueantes. Los estados de jobs citados son una fotografía y pueden cambiar.
- **No tocar:** producción `src/**`, migraciones, ficha, configs, `docs/revision-pr/**` desde el agy; mantener 1B/2A.
- **Decisiones:** no hay decisiones pendientes del usuario. El problema es evidencia/ejecución, no un nuevo criterio de producto.

Comandos y probe verificable: [evidencia/comandos.md](../evidencia/comandos.md).
