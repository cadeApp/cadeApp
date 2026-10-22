# PR #326 / T-340 Paso 3 — Ronda 4 independiente

- **Fecha:** 2026-10-13.
- **Rama:** `feat/T-340-limpieza-legacy`.
- **SHA auditado:** `384b2eb1d994efb17eeb7c51fc9a8f6ae898adc0`.
- **Base Develop:** `4eefd119b19792e179e46b1243d07ab957137649`.
- **Resultado técnico: SIN BLOQUEANTES.** A01 previamente aceptada por Lautaro073. **NO significa merge autorizado ni E2E GREEN.**

## 1. Diferencial de la ronda

Desde el commit documental de autorización `00c87b98`, Kira modificó solo `supabase/tests/t340_multi_drop.sql` (test #133; expectativa literal corregida a `Dest Historico`), `supabase/tests/integration/t340_concurrency.mjs` (filtra verdaderas líneas `Failed test` para H13/H01/H02) y `docs/tasks/log/T-340.md` (bitácora). **Ningún código funcional se tocó desde R2**, no hay cambios de permisos, RLS, auth, secretos, CI, migraciones nuevas ni Paso 4.

### H03: arreglado-verificado

El test #133 de R3 era una expectativa equivocada: `recipient_name` se crea como `Dest Historico` en `supabase/tests/t340_multi_drop.sql:1534,1544`, pero la aserción en `:1958` esperaba un literal diferente. Ahora ambos coinciden y no se eliminó ninguna aserción; `plan(136)` se preservó. **GitHub Actions real** sobre HEAD `384b2eb1d994efb17eeb7c51fc9a8f6ae898adc0`: 21 archivos y **2039/2039 pgTAP PASS**, sin fallos ni skips en la suite de T-340. También se ejecutó la mutación H01/H02 después de la suite base, y se volvió a pasar la suite al restaurar SQL. La idempotencia tiene ocho asserts complementarios de notas, monto, destinatario, drops e integridad de borradores.

### H01: arreglado-verificado por CI remoto, no por ejecución local del revisor

Se conserva el `app_private.t340_clean_legacy()` de R2 con preflight/no-draft, abort genérico sin PII y limpieza selectiva de datos respaldados. El job `db-tests` [115577294945](https://github.com/cadeApp/cadeApp/actions/runs/38479185315/job/115577294945) introdujo el mutante que cambia UPDATE seguro por UPDATE global. **RED real**: `Failed test 112,113,135,136` (datos de draft incompleto), exit 1; luego SQL original restaurado en `finally`, **GREEN del mismo pgTAP**. No se llama RED a un error del mutador.

### H02: arreglado-verificado por CI remoto, no por ejecución local del revisor

`app_private.request_cycle` preserva las validaciones de contactos del drop1 antes de borrar legacy. El job sustituyó ambos predicados `v_drop1_notes is distinct from v_request.notes` por `false`. **RED real**: `Failed test 124` (rechazo de publicación divergente) y `125` (preservación de notes), exit 1; restauración de definición y **GREEN** del mismo pgTAP. El runner ahora requiere que las aserciones esperadas aparezcan específicamente entre líneas `Failed test`, evitando falsos RED de un `includes` indiscriminado.

### A01: aceptación expresa, no verificación de código

La ampliación limitada a controles H01/H02 en `supabase/tests/integration/t340_concurrency.mjs` fue autorizada por **Lautaro073 — opción A** y quedó asentada en `docs/tasks/T-340.md`, `hallazgos.jsonl`. Sigue marcada `aceptado`, nunca `arreglado-verificado`.

## 2. Calidad y checks reales del SHA

[Run 38479185315](https://github.com/cadeApp/cadeApp/actions/runs/38479185315) sobre SHA `384b2eb1d994efb17eeb7c51fc9a8f6ae898adc0`:
- `unit`: 129 archivos/2136 PASS; workflow tests 79 y ADR 6 PASS.
- `db-tests`: 21 archivos/2039 PASS, `plan(136)` en T340, mutaciones reales H01/H02 RED específicas + restauración GREEN, tests posteriores de DB nuevamente PASS, tipos regenerados sin drift.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: SUCCESS.
- `Vercel`: SUCCESS.
- `e2e-preview`: **BLOCKED / REQUIRES DEVELOP MIGRATION** — no fue ejecutado en Preview, **NO es GREEN**.
- `approval-policy` antes del informe R4: FAILURE porque la PR aún decía R3 «con bloqueantes», no por el fallo de los tests actuales. Debe volver a comprobarse después de actualizar body, sin falsificar checks.

## 3. Requisitos previos y posteriores al merge

**No hay bloqueantes de código ni de evidencia pgTAP pendientes.** Sin embargo, T-340 Paso 3 es migración, y no puede superar `e2e-preview` en PR por diseño. La excepción de **orden** descrita en `docs/tasks/T-340.md` estaba autorizada **solo para Paso 2**. No extenderla en silencio: antes del merge de Paso 3, Lautaro073 debe decidir expresamente si autoriza repetir exactamente el mecanismo seguro (revisión + CI técnicos green, luego merge propio, migración automática Develop, despliegue, checkpoint real de Chromium+global-settings mediante PR temporal de solo docs, cierre sin merge). **El E2E no se condona**, se verifica posmerge y Paso 4 continúa bloqueado hasta pasar.

**Por qué este orden puede ser razonable:** evita correr el Preview contra un esquema incompatible y no toca los workflows ni ejecuta SQL manual remoto. **Condición de seguridad:** si `migrate-develop` falla por preflight de datos inconsistentes o el E2E posmerge falla, congelar Paso 4 y crear PR de reparación segura antes de cualquier otro despliegue; no ejecutar UPDATE/DELETE manual. La autorización de merge, si se da, es exclusivamente del usuario. Si no se concede la excepción, la PR debe quedar sin merge hasta diseñar un gate E2E premerge que mantenga aislamiento equivalente.

## 4. Alcance de verificación independiente y resultado

El revisor corroboró con `fetch_workflow_job_logs` la salida de GitHub Actions de **un SHA exacto** y comparó el fixture, aserciones y mutación del runner. No levantó Docker/Supabase local ni ejecutó un mutante independiente adicional; las mutaciones del autor se ejecutaron realmente en CI. Los hallazgos H01/H02/H03 pasan a `arreglado-verificado` con método explícito "inspección independiente + logs reales de ejecución CI" sin atribuir ejecución local al revisor. No se observaron pruebas falsificadas ni adulteradas para forzar GREEN.

**Resultado: SIN BLOQUEANTES TÉCNICOS; E2E premerge BLOQUEADO, decisión humana sobre orden pendiente; NO APROBADO, NO MERGEADO.** Se conserva Draft; no iniciar Paso 4.
