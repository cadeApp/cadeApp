# Revisión independiente — PR #454 / T-384 — Ronda 2

**Fecha:** 2026-10-20
**SHA revisado:** `cb32fdce9986ed133db68def0d1a2017122b90a7` · **base:** `develop@fee28dbdf2cf358aa8d36198d81b3cb04f81e61b`
**Rama:** `feat/T-384-cc033-optional-document` · **PR:** Draft.
**Resultado:** **CON BLOQUEANTES (3)** (H01, H03, H04) · **MEJORA de proceso:** H07.
**Decisiones 🔵:** ninguna: CC-033 mergeado ya define el comportamiento.

## Alcance y sincronización

16 archivos cambiados, todos permitidos por T-384 leída desde develop. CC-033 leído en su versión mergeada. No se cambiaron ni ficha T-384 ni UI, rutas, RLS o migraciones antiguas; la migración nueva mantiene security definer, search_path y privilegios previstos. GitHub informó la rama adelantada 16 commits, 0 detrás, sin conflictos de fusión (mergeable=true). No se pudo ejecutar git fetch, git merge-tree ni Vitest local por falta de resolución DNS para github.com en el contenedor de revisión. No se ejecutó Supabase ni Docker local.

## Revalidación de los seis hallazgos anteriores

| ID | Resultado ronda 2 | Evidencia y residual |
|---|---|---|
| **H01** | **PARCIAL / BLOQUEANTE** | pgTAP amplió su cobertura y pasó CI. Sigue faltando caso de consentimiento inactivo y alta **license para pending completo**; el caso de INSERT directo usa `throws_matching(..., '42501|permission denied')`, que no comprueba SQLSTATE 42501. |
| **H02** | **ARREGLADO, aún sin mutación propia** | `cc033_concurrency.mjs` existe y corre cuatro carreras de dos sesiones reales, con barreras por `pg_blocking_pids`. CI ejecutó modo normal y mutación de orden de locks (job 118678566374). El revisor no reprodujo mutación independiente. |
| **H03** | **PARCIAL / BLOQUEANTE** | SQL rechaza `kind` nulo, idempotencyKey no canónica y `.PNG` con `!~`. Pero `rpc-fake.ts` usa la regex con bandera `/i` y **acepta `.PNG`**; un fake así no es equivalente al SQL aprobado. |
| **H04** | **PARCIAL / BLOQUEANTE** | CI pasó cobertura de ramas de `rpc-fake.ts` (**90,63 %**, umbral 90 %). La suite nueva no prueba consentimiento inactivo, actor no courier ni alta exitosa de un `approved`. La subida correcta tampoco afirma explícitamente la existencia del documento con `getDocument`. |
| **H05** | **ARREGLADO, sin mutación propia** | Los tests de wrapper ahora observan `fn: 'add_courier_optional_document'`, `p_payload` con/sin clave, llamadas cero para input inválido y error interno para respuesta/throw defectuosos. Unit pasó en CI. |
| **H06** | **ARREGLADO Y VERIFICADO por CI** | `db-tests` completo pasó, incluido el paso `git diff --exit-code -- src/types/database.types.ts`, sobre el SHA revisado. |

## Bloqueantes residuales (correcciones acotadas)

### H01 — Completar los oráculos pgTAP de CC-033
`supabase/tests/cc033_add_courier_optional_document.sql`, en la sección de actores y altas. Aunque el contrato exige revalidar `profiles.consent_status = active`, los fixtures ponen todos los perfiles en `active` y nunca ejecutan una RPC de alta con consentimiento inactivo. Remover la comprobación de consentimiento de la función no alteraría esas aserciones. Además, falta el alta de `license` por un `pending` completo (ya están `approved/license`, `approved/insurance`, `pending/insurance`), y `throws_matching` no exige el SQLSTATE prometido del INSERT directo. Agregar los casos con afirmación de no crear documentos ni auditoría, y un `throws_ok` para `42501`. No introducir tests tautológicos.

### H03 — Paridad fake/SQL de extensiones
`src/domain/testing/rpc-fake.ts`, en `add_courier_optional_document`: reemplazar `/^[0-9]+[.](png|jpe?g|webp|pdf)$/i` por la misma regex **sin** `i`. El SQL utiliza `!~` y CC-033 exige minúsculas; el fake debe devolver `VALIDATION_ERROR` para `insurance_1730000000005.PNG` aunque la ruta exista en la semilla de Storage. El test de fake debe demostrar rojo con `/i` y verde sin `/i`.

### H04 — Completar matriz de fake con efectos observables
`src/domain/cc033-add-courier-optional-document.test.ts`: agregar actor `merchant`, actor `courier` con `consentStatus: 'reconsent_required'`, éxito `approved` para ambos `kind` y afirmaciones por `getDocument(documentId)` de existencia, `status=submitted`, `isCurrent=true` y path canónico. En rechazos, comprobar que ni estado ni documento cambian. La cobertura numérica no sustituye la cobertura contractual.

## Observación no bloqueante H07 — Propiedad del informe

El commit `46114f51`, escrito por el agente que implementa, modificó `docs/revision-pr/pr-454/revisiones/ronda-1.md`. Se comparó con `f9e67809`: solo quitó tres espacios finales (líneas 3–5), sin adulterar hallazgos ni su resultado. Queda registrado por la regla de propiedad del revisor. **No repetir la edición de `docs/revision-pr/**` desde el agente de implementación**.

## CI comprobado

Run [39437579550](https://github.com/cadeApp/cadeApp/actions/runs/39437579550), HEAD `cb32fdce9986ed133db68def0d1a2017122b90a7`:
- Unit job 118678566926: **152 Test Files / 2961 Tests PASS**; fake branch coverage 90,63 %.
- DB job 118678566374: **34 Files / 3012 Tests SQL PASS**; runner CC-033 normal completado, mutación `40P01` detectada en CI y definición restaurada; drift de tipos sin diff.
- Typecheck, lint, build, audit y bundle-budget: PASS.
- La salida de CI registra avisos transitorios del daemon y fallos controlados de otras suites de mutación; el job terminó SUCCESS. No se equiparan esos fallos intencionales a falla de la PR.

## Limitaciones de verificación

Inspección estática del SQL/fake/tests sobre el blob publicado y lectura directa de CI. La prueba aislada de flags regex (`.PNG`) se ejecutó en Node, pero **no se ejecutó el FakeRpcClient del repositorio ni se realizó una mutación independiente**; por tanto H01/H03/H04 no se presentan como RED→GREEN demostrados en runtime. Ver [evidencia/comandos.md](../evidencia/comandos.md).

## Cierre

**NO MERGEAR aún**. Resolver H01, H03 y H04 en la rama, publicar nueva bitácora y pedir ronda 3. No existe decisión de producto pendiente ni autorización para tocar más archivos.
