# PR #330 — Revisión independiente · Ronda 2

Fecha 2026-10-14; SHA revisado b29d8e8f6638a5d56d9652e33c045ff04c49adac; develop 3a453762445ce866a373eeab4a86365aacaca7e5. PR abierta Draft.
**RESULTADO: CON BLOQUEANTE FUNCIONAL H03.** H05 corregido/verificado; H04 y H06 corregidos por inspección pero pendientes del nuevo E2E; H01/H02 tienen evidencia E2E real del SHA anterior y requieren revalidación del actual.

## Cambios realmente nuevos
Comparación d0c492c3..b29d8e8: 2 commits de asako669 (1 de implementación, 1 de bitácora), 4 archivos modificados: map-privacy.spec.ts, multi-drop.spec.ts, create-request-form.test.tsx y docs/tasks/log/T-340.md. **No se rehízo el trabajo de Kira**, no se implementó RPC, no se tocó docs/revision-pr/pr-330 por el autor.

## Hallazgos

**H01 — ARREGLADO SIN VERIFICAR EN SHA ACTUAL.** E2E writer real pasó con pickup y negativos/positivos en 046e103, run 38519053397, no en b29d8e8 todavía.
**H02 — ARREGLADO SIN VERIFICAR EN SHA ACTUAL.** Oferta real submit_offer y accept_offer pasó en mismo run anterior; revalidar al cerrar Preview actual.
**H03 — ABIERTO, BLOQUEANTE.** actions.ts:54–178 inserta request, pickup, drops y contactos por llamadas independientes y luego publish_request. Errores intermedios no revierten lo ya insertado. CC-024 #332 fue mergeado como documento, pero no existe backend RPC atómica. El Gate 2/3 permanece a cargo de Lautaro073 (issue #331). NO introducir RPC/SQL en PR330.
**H04 — ARREGLADO POR INSPECCIÓN, SIN VERIFICAR E2E DEL SHA.** La prueba de 3 drops y el escenario todos failed ahora inspeccionan TripCourierView real, no solo multiplicación local; verifica total $4500 y A cobrar $3000 o $0. Preview nuevo aún en curso. Sin mutaciones independientes atribuidas.
**H05 — ARREGLADO Y VERIFICADO EN SHA ACTUAL.** create-request-form.test.tsx reemplazó cuatro non-null assertions de mockZones[0] por fixture pickupZone con guard tipado. CI unit HEAD b29d8e8 PASS 129/129 archivos y 2143/2143 tests, sin cambiar asserts para silenciar errores.
**H06 — REGRESIÓN PREVIA CORREGIDA POR INSPECCIÓN, SIN VERIFICAR E2E DEL SHA.** Antes, map-privacy.spec.ts:657 tenía locator que no alcanzaba el GPS: run 38519053397 dio 73 PASS/1 FAIL. Nuevo código usa getByTestId('drop-card-0'), acorde con Card real del JSX. Solo Playwright actual puede acreditar cierre.

## CI sobre HEAD b29d8e8 (comprobado en GitHub)
- unit, typecheck, lint, build, audit y bundle-budget SUCCESS; unit: 129/129 suites, 2143/2143 tests. Vercel SUCCESS.
- db-tests FAIL **de infraestructura**, run 38560544025, job 115840252038: Error response from daemon 'toomanyrequests: Rate exceeded', y posteriormente 'failed to bind host port 0.0.0.0:54322: address already in use'. Falla antes de pgTAP; no afirmar fallos SQL ni etiquetarlo como PASS. Debe revalidarse un run limpio.
- approval-policy FAIL, revisión aún con bloqueantes.
- e2e-preview run 38560715122 IN_PROGRESS al verificar; no adjudicar PASS/FAIL ni afirmar global-settings green todavía.
- Este revisor NO corrió tests locales, SQL, Docker, mutaciones ni workflows manuales. La evidencia runtime procede solo de los jobs del SHA identificado.

## Dictamen y próximos pasos
Primero: esperar resultado auténtico de E2E actual para H01/H02/H04/H06, y revalidar db-tests en condiciones de runner sin conflicto Docker; no editar CI ni tests para forzar verde. Segundo: completar y desplegar backend de CC-024 en PR separada, luego una sola llamada a su RPC desde actions.ts y demostrar atomicidad/idempotencia, E2E completo. Tercero: revisión independiente posterior y autorización de merge de Lautaro073.

**No aprobé ni mergeé. No se requiere nueva decisión de producto para las correcciones actualmente identificadas.**
