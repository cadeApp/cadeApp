# Informe revisar-pr — T-359 — PR #360 — ronda 5

**Fecha:** 2026-10-15 · **SHA inspeccionado:** `e1e7e53ee1c50bdfa89468132ff5194d6b781860` · **Base de PR:** `develop` (SHA observado `14c28ed3c41cb2bde92705fc018c7dd0df73245b`).

**RESULTADO: CON BLOQUEO DE MERGE POR E2E PENDIENTE. SIN NUEVOS DEFECTOS FUNCIONALES DETECTADOS POR INSPECCIÓN.** No aprobar, no mergear, no falsear checks.

## Qué cambió desde ronda 4

Compare `efb22c421b1ded80f48380fef4edc9e4981831f5...e1e7e53ee1c50bdfa89468132ff5194d6b781860`: exactamente un commit del autor `docs(T-359): session log ronda 4 [T-359]`, que toca **únicamente** `docs/tasks/log/T-359.md`. El cambio documenta los checks y la causa de `e2e-preview` omitido. No se modificó aplicación, E2E, schema, RPC, permisos ni workflows. El archivo pertenece al alcance autorizado de T-359. La descripción PR mantiene E2E [ ].

## Hallazgo H05 — bloqueo operativo VERIFICADO; implementación sin nuevos cambios

1. `e2e/specs/main-flow.spec.ts` conserva dos contextos, lectura DB única aceptación, aceptación ganadora y perdida, courier real, monto, medio de pago, WhatsApp, reload/Back y ruta canónica; estos son hallazgos **por inspección**, no prueba de ejecución Playwright.
2. Los dispatch automáticos `e2e-preview` ocurren: runs **38683340222** y **38683340102**, entre otros (04:51–04:56 UTC), tienen `resolve-preview SUCCESS`, pero `e2e-preview SKIPPED` y `report-preview-status SKIPPED`. Logs: **«El deployment no pertenece al proyecto Vercel de develop.»**
3. Código de confianza `.github/workflows/e2e-preview-target.mjs`, función `matchPreview`: si `client_payload.project.id !== secrets.VERCEL_PROJECT_ID` del Environment `develop`, devuelve `skip`, escribe `run=false` y **no publica** un estado e2e-preview. El comportamiento es **fail-closed intencional**; nunca tratar su éxito superficial como tests ejecutados.
4. Inspección autenticada, solo lectura en Vercel: existen los proyectos distintos `cadeapp-staging` y `cadeapp-develop`. El SHA `e1e7e53ee1c50bdfa89468132ff5194d6b781860` tiene deployment `READY` tanto en `cadeapp-staging` como en `cadeapp-develop`. **La existencia del deployment de develop no prueba que su webhook haya enviado un evento aceptado**.
5. La comprobación de webhooks mediante conexión Vercel devolvió **403 Forbidden**; por tanto **NO** se verificó la configuración exacta de cada webhook, ni cabe afirmar que esté ausente. Los eventos anteriores parecen provenir de un proyecto distinto al configurado para el gate; hay que contrastar la identidad de Vercel develop que origina el `repository_dispatch`, no reducir la validación.
6. Hay runs automáticos posteriores capaces de producir `PR interna #368 contra develop`, señal de que el mecanismo funciona para al menos otras PRs, **pero eso no acredita E2E del SHA de T-359**. El check `e2e-preview` en este SHA no consta.

**Acción recomendada (operación, no refactor):** verificar en interfaz de Vercel la suscripción webhook `vercel.deployment.ready`/`success` del proyecto `cadeapp-develop` hacia la integración GitHub `repository_dispatch` y su `client_payload.project.id`; contrastar, sin exponer IDs o claves, que coincide con la variable de identificación `VERCEL_PROJECT_ID` del GitHub Environment `develop`. Repetir mediante un nuevo deployment legítimo de esa rama después de la corrección operativa (sin disparos manuales ni cambios de seguridad). Inspeccionar `resolve-preview` para un `PR interna #360` y luego exigir job E2E real `success` en el **SHA efectivo**. Si Vercel Authentication protege el Preview, la prueba fallará hasta configurar el acceso autorizado, nunca ignorar 302/401.

**Prohibido:** cambiar la condición `project.id`, copiar credenciales a la PR, apuntar E2E a staging o producción, forzar status verde, publicar resultados falsos, alterar `.github/**` por cuenta del agy ni forzar dispatch.

## CI SHA inspeccionado

| Check | Evidencia |
|---|---|
| unit | SUCCESS, 130 suites Vitest; 79 workflow tests; 6 ADR |
| db-tests | SUCCESS, logs `Files=22, Tests=2205, Result: PASS` |
| typecheck/lint/build/audit/bundle-budget | SUCCESS |
| Vercel staging | deployment listo en `cadeapp-staging`, no sustituye al E2E develop |
| Vercel develop | deployment READY del mismo SHA (inspección de Vercel, sin job E2E asociado) |
| e2e-preview | SIN resultado para este SHA; runs de dispatch anteriores saltaron prueba |
| approval-policy | FAIL, requiere aprobación vigente de Lautaro073 |
| Mutación local independiente | NO EJECUTADA: no hay clon/pnpm en este entorno |

El usuario todavía debe **comprobar/corregir desde la configuración de Vercel/GitHub** el enlace de eventos si no hay un webhook correctamente enroutado; el revisor no tiene permiso de lectura de webhooks (403), ni se modificaron secretos. No se pidió decisión nueva de diseño. Si aparece un resultado E2E real o se encuentra un bloqueo concreto adicional, solicitar siguiente revisión con SHA y run.

## Historial y proceso

Se copiaron los bytes de la ronda 4 desde la rama `docs/revisiones` a esta carpeta, preservando su contenido y autoría. La tabla antigua de `docs/revision-pr/COMO-ENTREGAR.md` contradice las **reglas actuales explícitas del usuario**, que mandan commitear en la rama del PR. Esta ronda sigue esa regla. Todo commit de revisión mueve HEAD, por lo que antes de otra corrección el agy debe hacer `git pull --ff-only`, nunca rebase/force-push. No confundir el SHA probado con el SHA de documentación de la revisión.
