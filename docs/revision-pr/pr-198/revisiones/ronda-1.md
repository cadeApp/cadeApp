# Ronda 1 — PR #198 / T-306

**Fecha:** 2026-10-02  
**SHA revisado:** `97314707933b07657a9b64ed8a305643c5d4157a`  
**Resultado:** CON BLOQUEANTES (7)

## Precondición antes de arreglar

La rama estaba **38 commits detrás de `develop`**. Antes de cualquier arreglo hay que traer `origin/develop` mediante merge, nunca rebase. Esto importa especialmente porque `develop` ya contiene la separación Supabase Develop + Vercel Preview y el workflow de E2E confiable.

## BLOQUEANTES

### PR198-H01 — la suite declarada como `global-settings` no pertenece ni se ejecuta en ese proyecto
El archivo entregado es `e2e/specs/subscription.spec.ts`, mientras `playwright.config.ts` selecciona para `global-settings` únicamente nombres que terminan en `global-settings.spec.ts`. Además, el gate `e2e-preview` actual ejecuta explícitamente solo `smoke.spec.ts` y `main-flow.spec.ts` con `--project=chromium`.

**Decisión:** Lautaro073 eligió renombrar a `subscription.global-settings.spec.ts` y ampliar T-306 para tocar `.github/workflows/e2e-preview.yml`.

### PR198-H02 — el caso “paid_until vencido” no ejerce `paid_until`
En el caso negativo se configura `subscription_status = 'expired'`. El dominio/RPC rechaza ese estado antes de necesitar evaluar la fecha. La prueba seguiría rechazando aunque se rompiera o eliminara la lógica de `paid_until`.

**Arreglo esperado:** piloto apagado + `subscription_status = 'active'` + `paid_until` inequívocamente pasado.

### PR198-H03 — los casos positivos no prueban que la solicitud fue publicada
Tras enviar el formulario, los casos positivos buscan la solicitud por `notes`, navegan al detalle y solo comprueban que se vea “paquete chico”. No consultan `delivery_requests.status`.

La revisión comprobó además que el flujo productivo actual inserta `status = 'draft'` y no llama `publish_request`. Se abrió **#209** y Lautaro decidió mantener ese arreglo fuera de T-306. T-306 queda bloqueada hasta que #209 esté mergeada.

**Arreglo esperado del E2E:** consultar el ID exacto creado y exigir `status === 'published'`.

### PR198-H04 — el caso negativo contradice su propia fixture
`stagingContext` ejecuta `seedStagingData(... requestsCount: 1 ...)`, y el seed crea esa solicitud con `status = 'published'`. Sin embargo el caso negativo consulta todas las solicitudes `published` del mismo comercio y exige longitud 0.

El test puede fallar con la implementación correcta por datos que creó él mismo.

**Arreglo esperado:** afirmar únicamente la solicitud marcada por el `notesMarker` de ese intento, no el total histórico/seed del comercio.

### PR198-H05 — la “mutación” de `publish_request` es tautológica y no toca producción
El caso DoD 5 crea una función local `mutatedPublishCheck` que siempre retorna `ok: true` y luego comprueba que difiera de `canMerchantPublishRequest`. Ninguna modificación de `publish_request`, de su llamada real ni de la aplicación puede hacer fallar esa prueba.

La bitácora agrava la evidencia: declara una fase RED y luego dice que “se ajustaron las aserciones a GREEN”, sin cambio productivo que cierre la propiedad.

**Arreglo esperado:** eliminar esta simulación. La evidencia RED debe salir de una mutación real del camino que protege `publish_request`; si el entorno no permite demostrarla de forma legítima, se declara pendiente, nunca se reemplaza por una función falsa o por expectativas acomodadas.

### PR198-H06 — la restauración del setting global es fail-open y el control final hardcodea `true`
Los tests capturan `pilot_active`, pero ante cualquier error de lectura usan silenciosamente `true` como fallback y después restauran ese valor. El DoD 4 también exige directamente `setting?.value === true`, que no demuestra “restaurar el valor original”.

Una lectura fallida podría terminar modificando un setting compartido y dejarlo en un valor inventado.

**Arreglo esperado:** lectura obligatoria y tipada; si no se obtiene un booleano válido, fallar antes de mutar. Guardar el valor exacto y restaurarlo en `finally`, verificando después que coincide.

### PR198-H07 — el PR marca el DoD como completo sin evidencia de haber ejecutado el E2E
La bitácora declara `typecheck`, `lint` y `test`, pero no una ejecución de Playwright de `subscription.spec.ts`. El cuerpo de la PR marca todos los casos E2E y la mutación como verificados.

Además, la última entrada de bitácora todavía dice que falta hacer push y abrir el PR, aunque ambos ya ocurrieron.

**Arreglo esperado:** después de #209 y de traer `develop`, ejecutar la suite real contra el Preview/Develop permitido, registrar comando/run y resultado exactos, y actualizar la bitácora sin usar “verificado” para autocertificar.

## MEJORAS

No separo mejoras en esta ronda: primero hay que hacer que la suite ejecute el contrato real y produzca evidencia válida.

## Checks de esta ronda

- Alcance contra ficha de `develop`: los 3 archivos actuales estaban permitidos por la ficha original.
- Comparación de ficha: la rama solo había marcado checkboxes; no había ampliado el alcance antes de la decisión de Lautaro.
- Comentarios/reviews previos del PR: ninguno al iniciar la ronda.
- Mergeability informada por GitHub: `mergeable = true`, pero la rama estaba 38 commits detrás.
- CI general: **no evaluado** por regla de revisión mientras existen bloqueantes.
- Playwright T-306: **sin evidencia reproducible aportada por el autor**.
- No se levantó Supabase ni Docker local.

## Decisiones incorporadas antes de cerrar

- Renombre al patrón `*.global-settings.spec.ts`: **A**.
- Gate Preview automático con Supabase Develop: **A**.
- Defecto productivo separado: issue **#209**, no se corrige en T-306.

## Estado

Ronda cerrada con bloqueantes. No aprobar ni mergear.
