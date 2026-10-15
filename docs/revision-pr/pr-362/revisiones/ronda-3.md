# Informe de revisión independiente — PR #362 / T-353 — Ronda 3

**Fecha:** 2026-10-15
**SHA de código revisado:** `55fa228e8d8b37b3d06426d02e816ce776398419`.
**Base:** `develop@14c28ed3c41cb2bde92705fc018c7dd0df73245b`.
**Comparación con R2:** `57f748c5..55fa228` = 1 commit, 3 archivos cambiados, todos autorizados.
**Resultado:** **CON BLOQUEANTES: H06 y H07**. No aprobar ni mergear.

## Qué quedó solucionado en el diff (por inspección, NO verificado runtime)

- **H08:** `e2e/specs/multi-drop.spec.ts:976-1002` localiza `data-testid="drop-card-0"`, y el teléfono se comprueba con `await expect(phoneInput).toBeVisible()` **fuera de cualquier rama condicional**. El falso verde de la R2 quedó eliminado en el código. Estado `arreglado-sin-verificar`: sin corrida Playwright/mutación real.
- **H06 (parte UI):** `e2e/specs/courier-onboarding.spec.ts:687-737` precarga documentos como el otro flujo de esa misma spec, demuestra DNI inválido → error y botón deshabilitado → DNI válido → botón habilitado → navegación a `/courier/onboarding/vehicle` → DNI preservado. No es una prueba de carga real de documentos y no se declara que lo sea.
- **H06 (parte creación):** `e2e/specs/multi-drop.spec.ts:959-1096` agrega datos sintéticos, demuestra error específico, corrección, conservación de otros campos, navegación y consulta de tabla pública/privada para teléfono canónico. Mejora efectiva sobre R2, pendiente de E2E.
- **H07 (parte documental):** la sesión `2026-10-15 01:20` de `docs/tasks/log/T-353.md:100-132` conserva la bitácora append-only y corrige referencias imposibles por nombre exacto de tests; no reescribe entradas anteriores.
- **H01–H05** siguen `arreglado-sin-verificar`. Las decisiones de Lautaro `1B` y `2A` siguen intactas.

## H06 — bloqueante residual de E2E y control de no-escritura

**[ANÁLISIS] `e2e/specs/multi-drop.spec.ts:1017-1025,1048-1061`.** El test envía un formulario con teléfono inválido, muestra error y afirma solo que `page.url()` aún contiene `/merchant/requests/new`. Esto **no prueba que la solicitud no haya sido escrita**: una regresión que produzca un efecto parcial y no navegue deja esa aserción en verde. Después de la corrección se consulta el registro más reciente del mismo comercio, sin vincularlo por identificador al intento del test. Un registro ajeno/preexistente que cumpla las expectativas podría ocultar una falla de correlación.

**Arreglo exacto:** usar cliente `createAdminClient()` y `stagingContext.merchantUser` antes del intento inválido; leer los IDs de `delivery_requests` de ese merchant. Tras intentar publicar teléfono inválido, repetir select de `id` y afirmar que no apareció ningún ID adicional. Tras corregir y publicar, calcular la diferencia de IDs y exigir **exactamente uno nuevo**, registrar **ese ID** con `trackEntityForCleanup` y usarlo para verificar drops, tabla de contactos privada y ausencia de PII en público. No usar `order(created_at).limit(1)` como sustituto de identidad. Conservar la prueba de teléfono canónico y ruta. El conjunto de IDs de base evita depender de timestamp.

**E2E faltante:** al consultar checks del commit `55fa228` se observaron diez checks: seis de CI verde (`lint`, `unit`, `typecheck`, `build`, `audit`, `bundle-budget`), `db-tests` en curso, `approval-policy` en failure, `Supabase Preview` skipped y `Vercel Preview Comments` successful. **No aparece el contexto `e2e-preview`** publicado por el workflow confiable `.github/workflows/e2e-preview.yml` (se dispara mediante `repository_dispatch` de Vercel). El autor reconoce `E2E Playwright -> PENDIENTE`. No afirmar fallo del E2E: **aún no se ejecutó según evidencia disponible**.

**Cierre de H06:** aportar run ID del workflow `e2e-preview`, SHA exacto, resultado y logs resumidos del test nuevo en Vercel Preview + Supabase Develop, sin correr contra producción ni disparar workflows manualmente. Si el dispatch no llega, registrar bloqueo con estado y dejar pendientes las comprobaciones remotas; nunca reemplazar por un test falso. Si la PR recibe commits del revisor, el run deberá corresponder al nuevo HEAD apropiado, sin atribuirlo retroactivamente al SHA antiguo.

## H07 — bloqueante residual de evidencia RED→GREEN

**[ANÁLISIS] `docs/tasks/log/T-353.md:100-128`.** El agy corrigió las referencias por nombre exacto, lo que resuelve la crítica de líneas imposibles. Sin embargo, la bitácora **solo contiene resultados verdes** (`8 archivos/228 tests`) y descripciones de supuestas mutaciones de la sesión anterior, **sin comandos ni salida roja `Test Files/Tests` reproducible**, exigidos por `docs/tasks/T-353.md:60,68`. Un test que solo pasa no certifica que detecta el invariante roto.

**Arreglo:** agregar una nueva entrada de bitácora, sin editar las anteriores, con comandos/resultado REAL de un control GREEN original → RED al cambiar reversible/localmente cada invariante (mínimo los afectados H01–H05 y H08 donde el entorno seguro lo permita) → GREEN restaurado; distinguir los casos que no pudieron correrse. Para cambios unitarios usar script auxiliar en `/tmp` con contenido original leído en memoria y restauración `finally`, sin `git checkout`, rebase ni commit de mutaciones. Ejecutar exactamente la suite afectada y adjuntar las aserciones/errores que caen, nunca errores del arnés. Para mutaciones E2E de seguridad se aplica exclusivamente el mecanismo `e2e-mutation` existente (target develop), NO desplegar PR mutada ni disparar `repository_dispatch` manual.

**No son pendientes de producto:** no hacen falta nuevas decisiones 🔵. Si faltan credenciales/evento de Vercel que solo un administrador puede tocar, describir el bloqueo objetivo sin inventar solución o resultado.

## Por qué los checks verdes no cierran
- `unit` es distinto del gate `e2e-preview`.
- Las suites Vitest pueden pasar aunque se eliminen aserciones de una spec Playwright.
- `approval-policy` rojo se informó como estado observado, no se manipuló. No asegura autoría de revisión.
- `db-tests` no se declaró verde: estaba en curso al consultar.

## NO TOCAR
- `src/**`, schemas ya corregidos, contratos, RPC, migraciones, dependencias y workflows.
- `docs/revision-pr/pr-362/**` reservado al revisor, nunca al autor.
- Tests fabricados, `if (locator.isVisible())` para omitir aserciones, `test.skip`, cambios en fixtures o falsos resúmenes GREEN.

## Limitaciones y metodología
Se inspeccionaron archivos exact-head mediante GitHub, se comparó `57f748c5..55fa228`, comentarios de autor y estados CI/commit. **No se ejecutaron** Git local, Playwright, Vitest ni mutaciones independientes: el contenedor carece de clon con dependencias y no resuelve github.com en git. Todas las filas `verificado_en_sha` siguen `null`; registrar `arreglado-sin-verificar` no equivale a certificación de ejecución.

[Comandos/evidencia](../evidencia/comandos.md).
