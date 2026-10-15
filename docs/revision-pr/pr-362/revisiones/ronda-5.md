# Informe de revisión independiente — PR #362 / T-353 — Ronda 5

**Fecha:** 2026-10-15
**SHA del autor examinado:** `c751cc8fd32b4d402670fbe637dac7d251f23f9b`
**Base:** `develop@14c28ed3c41cb2bde92705fc018c7dd0df73245b`
**Rango incremental:** `34a72cc..c751cc8` (1 commit P2, **solo** `docs/tasks/log/T-353.md`, 42 líneas añadidas/1 eliminada).
**Resultado:** **CON BLOQUEANTES (1): H06 — E2E Preview no acreditado**.
**Decisiones:** ya resueltas por Lautaro073 (1B / 2A), sin nuevas preguntas.
**Método:** lectura directa desde GitHub del único archivo cambiado y de Actions/PR; verificación de estado de deployment en Vercel; sin checkout ni ejecución local de Vitest/Playwright de este SHA.

## H07 — corrección satisfecha por inspección documental; runtime NO certificado

El apéndice append-only `docs/tasks/log/T-353.md:190-229` reconoce expresamente que el mutante previo `if (false && !parsed.success)` provocaba `TypeError` y no prueba semántica real. La nueva evidencia usa el mutante **de predicado** recomendado en R4: `src/features/requests/schemas.ts`, en la regla `recipientName`, reemplaza temporalmente `.refine((val) => !/[<>]/.test(val), {...})` por `.refine(() => true, {...})`, conservando la estructura de Zod y `parsed.data`. La bitácora registra:

- GREEN original: `pnpm exec vitest run src/features/requests/actions.test.ts` → 1 suite/13 tests passed, exit 0.
- RED mutante: 1 test fallido por **AssertionError** `{ok:false,code:'INTERNAL_ERROR'}` frente al `VALIDATION_ERROR` esperado, exit 1; no TypeError, SyntaxError ni timeout declarados.
- GREEN restaurado: 1 suite/13 tests passed, exit 0 y `git diff --exit-code -- src/features/requests/schemas.ts` limpio.
- Describe además mutantes H01–H04, sus scripts/objetivos de sustitución, tests y salidas resumidas.

**Juicio:** la evidencia escrita ahora describe un mutante que entra al flujo válido de ejecución y rompe una aserción de comportamiento, en vez de dejar `data` indefinido. Es una corrección válida **por inspección** de H07, aun cuando el error concreto (`INTERNAL_ERROR`) no pruebe por sí solo ausencia/presencia de llamada a RPC. El test existente también tiene `expect(mockRpc).not.toHaveBeenCalled()` tras la primera aserción; no se ejecuta esa segunda aserción cuando falla la primera. No confundir esta limitación con un defecto demostrado de producción.

Se marca **`arreglado-sin-verificar`**, `verificado_en_sha=null`, porque la revisión no ejecutó de forma independiente el harness ni pudo reproducir las mutaciones Vitest. El historial previo queda inalterado. No se exige una sexta ronda de edición del mismo apartado: se revalidará mediante una corrida independiente cuando exista acceso a entorno de ejecución.

## H06 — único bloqueante: E2E Preview real no acreditado

### Lo verificado
1. La prueba E2E de la R4, sin cambios de código en la R5, conserva la secuencia DNI inválido → corrección → avance a vehículo y multi-drop con ausencia de escritura, ID diferencial, publicación, contacto privado y privacidad de información.
2. **Vercel Deployment READY**: `dpl_AFZ99p7UwAUewGuCTYiP8an3y4yY`, proyecto `cadeapp-staging`, rama `feat/T-353-validacion-formularios`, metadato `githubCommitSha=c751cc8fd32b4d402670fbe637dac7d251f23f9b`. Verificación por el conector autenticado de Vercel, solo lectura.
3. `GET /repos/cadeApp/cadeApp/commits/c751cc8.../check-runs` arroja diez check-runs: `lint`, `typecheck`, `audit`, `Vercel Preview Comments` en success; `unit`, `db-tests`, `build`, `bundle-budget` terminaron **cancelled** en una consulta posterior (no se declaran verdes); `approval-policy` failure y `Supabase Preview` skipped. Combined status: solo `Vercel – cadeapp-staging = success`; **ningún `e2e-preview`**.
4. El workflow confiable `.github/workflows/e2e-preview.yml` se activa exclusivamente por `repository_dispatch` de `vercel.deployment.ready` o `vercel.deployment.success` y debe publicar un commit status `e2e-preview` del SHA probado. **Deployment READY no demuestra que ocurrió dispatch ni que Playwright corrió.**
5. Se intentó leer la lista de webhooks del proyecto mediante `mcp__Vercel__get_webhooks({projectId:'prj_EZM8RFPCoFeyksobhkDfzwAle4SN'})`, exclusivamente en modo lectura; la API respondió `403 forbidden: don't have permission to list the webhook`. Por tanto, el revisor **no puede confirmar la configuración/delivery ni atribuir una causa definitiva**. No se modificó ninguna integración/configuración/secret ni se disparó workflow.
6. El log de `approval-policy` (job `116254399640`) dice **`El PR requiere aprobación vigente de Lautaro073.`**: es una condición de política esperada para PR de P2, NO corregir workflows ni simular aprobación. Requiere acción humana solo DESPUÉS de cerrar bloqueantes; no se recomienda aprobar ahora.

### Cierre de H06
- **Acción humana necesaria:** el administrador de la integración Vercel/GitHub debe inspeccionar los webhooks/eventos del deployment del proyecto `cadeapp-staging`, en particular la emisión/entrega autorizada de `repository_dispatch` `vercel.deployment.ready` o `vercel.deployment.success` hacia `cadeApp/cadeApp`, y consultar los runs del workflow `e2e-preview`. Revisar el delivery, permisos y filtros sin divulgar ni pegar secretos.
- Si el webhook/dispatch no está configurado o falla, repararlo en la consola con permisos de administrador. **No** emitir un dispatch manual ni deshabilitar `e2e-preview`/approval-policy, ni editar secrets o workflows desde esta revisión.
- Tras un evento automático verdadero, registrar **commit SHA, deployment Preview y URL, workflow run ID, `resolve-preview` / `e2e-preview` / `report-preview-status`, resultado de Playwright T-353 y estado del commit exact-head**. Si el gate falla, investigar aserciones reales sin adulterar tests. Si no aparece, mantener H06 abierto, comunicar el bloqueo y NO mergear.

### Limitaciones y seguridad
- `approval-policy` rojo hasta aprobación humana de P1, sin relación con las aserciones de E2E.
- No se corrieron tests locales, conexión a Supabase, Playwright, ni mutaciones independientes (sin clon/worktree con dependencias); no se afirma 228 tests reproducidos.
- No hay nuevos cambios de producción ni nuevos hallazgos de código en este commit solo documental.
- H01–H05/H07/H08: **arreglado-sin-verificar** por inspección; no se completó `verificado_en_sha` de ninguno.
- No hay preguntas de producto pendientes. **NO APROBAR NI MERGEAR**.

[Evidencia](../evidencia/comandos.md) · [Hallazgos JSONL](../hallazgos.jsonl).
