# Informe de revisión independiente — PR #613 · T-422 · Ronda 1

**Fecha:** 2026-11-05  
**PR:** https://github.com/cadeApp/cadeApp/pull/613  
**SHA del código revisado:** `95f95eedda08ab5b1bb04d289e100ed7649a2b8a`  
**Base develop:** `fb08ab5f7ee76bf3d1dab6703ec659aafe330d90`  
**Resultado:** **SIN BLOQUEANTES (0)**. No se aprobó ni mergeó la PR.

## Alcance y contratos
Se leyeron de `develop`: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `docs/tasks/T-422.md`, y antecedentes AG-32–38, AG-57–60, AG-61–63, AG-64–71, AG-73–75 y AG-76–77. También el código de T-414 (banner y acción) para distinguir fallo del test de fallo de producción.

La comparación GitHub `develop...95f95eedda08ab5b1bb04d289e100ed7649a2b8a` da 1 commit adelantado y 0 atrasados; el PR estaba marcado `mergeable=true`, sin conflictos declarados. No hubo clon/fetch local: no se pudo ejecutar `git merge-tree` independiente.

| Archivo modificado | Comprobación |
|---|---|
| `.github/workflows/e2e-preview.yml:45` | Job `e2e` pasó de 45 a 75 min; no cambió permisos, checkout, Environment, disparador ni steps. |
| `.github/workflows/verify-workflows.test.mjs:1421` | Test afirmativo y dirigido al job E2E, que exige timeout 75. El autor declaró RED al volver a 45, 84/85. |
| `e2e/specs/announcements.spec.ts:124-133` | `waitForResponse` armado antes del clic, filtra POST a `/merchant/dashboard`, afirma `ok()` antes de `reload()`, y conserva verificación de ausencia posterior. |
| `docs/tasks/T-422.md` | Agrega decisión de ampliar T-422 y el spec en archivos permitidos; la ampliación se reconoció expresamente en la bitácora/PR, sin tocar funcionalidades de `src/**`. |
| `docs/tasks/log/T-422.md` | Sesión 6 documenta run fallido previo, arreglo y pruebas. |

**Se verificó la clase completa de cambios de esta PR:** exactamente 5 rutas. No hay nuevos paquetes, tablas/RLS, contratos, migraciones ni dependencias.

## Evidencia ejecutada en GitHub Actions
1. [Run anterior 42061362490](https://github.com/cadeApp/cadeApp/actions/runs/42061362490): 114 passed / 1 flaky / 1 failed, con `announcements.spec.ts:67` fallando en tres intentos; Chromium tardó 39,4 min. La explicación de POST abortado (estado -1) surge de la bitácora del autor; no se volvió a abrir su trace para certificar ese estado.
2. [Run 42075421860](https://github.com/cadeApp/cadeApp/actions/runs/42075421860): en el log de `e2e-preview` figuran `git fetch` y `git checkout` del SHA exacto `95f95eedda08ab5b1bb04d289e100ed7649a2b8a`; `announcements.spec.ts:67` pasó al primer intento (28,9 s), `116 passed (32.6m)` y `6 passed (2.5m)`; el reporte publicó `TARGET_SHA=95f95eedda08ab5b1bb04d289e100ed7649a2b8a`, `RESULT: success`. Todos los jobs del run concluyeron success.
3. [CI 42073826935](https://github.com/cadeApp/cadeApp/actions/runs/42073826935): `unit`: 193 archivos/3568 tests; `verify-workflows`: 85/85; `db-tests`: 42 archivos, 3396 tests, resultado final PASS y comparación `git diff --exit-code`; `typecheck`, `lint`, `build`, `bundle-budget` en success. El log de db-tests contiene RED deliberados de sus propios controles por mutación: se tomó **el resultado final**, no cada línea de `FAIL` como falla del job.

## Mutaciones propias y limitaciones
Se inspeccionaron los fuentes reales por API de GitHub en el SHA revisado. Un primer control independiente en memoria dio baseline GREEN y detectó timeout 45, ausencia del await y cambio de método. Se elaboró además un harness reproducible con **5 mutaciones propias** del timeout y de la secuencia de cierre: en fixture aislado produce control GREEN y 5/5 RED sin escribir el repo. Script completo: [evidencia/comandos.md](../evidencia/comandos.md).

**No afirmar ejecución local sobre el SHA:** el contenedor de revisión no resolvió `github.com` para clonar. La ejecución de Playwright y de `node --test` está verificada en logs del CI sobre el SHA, no reproducida en nuestro clon. La evidencia RED declarada por el autor (84/85 con timeout 45) es plausible y está protegida por el matcher, pero no se reprodujo literalmente la salida mediante un `node --test` local del checkout original.

## D01 · resuelta por Lautaro073: A
El banner del producto (`src/features/announcements/components/announcement-banner.tsx`) usa `setHidden(true)` antes de `await dismissAnnouncementAction`. Eso explica por qué un test que recargaba inmediatamente podía perder la persistencia. **La PR #613 corrige la sincronización del test, no la durabilidad del cierre del usuario.** La acción y el producto no son modificaciones de esta PR.

Lautaro073 seleccionó **A: seguir con el alcance T-422** y reparar el defecto funcional por separado en el issue [#614](https://github.com/cadeApp/cadeApp/issues/614), con tarea propia, contrato UX y tests. Esto **no es un bloqueante de #613** y no habilita al agy a tocar `src/**` ni `docs/revision-pr/**`.

## No tocar / no confundir
- No agrandar T-422 para reescribir `AnnouncementBanner` ni agregar hacks de tests o `if (test)` para forzar GREEN; #614 es independiente.
- No cambiar las expectativas del spec, eliminar el oráculo de ausencia tras recarga ni debilitar los tests.
- El test exacto `timeout-minutes: 75` es rígido ante una futura ampliación legítima, pero detecta correctamente volver a 45 y no bloquea este ajuste puntual.
- No confundir `workflow_run.head_sha` (SHA de `develop`) con el SHA efectivamente desplegado: el log de checkout y `TARGET_SHA` identifican el commit de la PR.

## Señales que no son el resultado del gate
El status `e2e-preview` está **success**. En el mismo SHA constaban los statuses `Vercel` / `Vercel Deployments – Lautaro` en failure y el check `approval-policy` en failure antes del informe; la revisión no inspeccionó la causa del error externo de Vercel. Si alguno es requerido por reglas de rama, resolverlo antes de mergear; no se presenta como defecto demostrado del cambio.

## Cierre
**Sin bloqueantes ni mejoras pedidas al autor dentro de T-422.** El reviewer solo commitea la carpeta `docs/revision-pr/pr-613/`, publica un único comentario con este informe y un prompt de aislamiento de #614, y **no aprueba ni mergea**. El siguiente E2E no se exige exclusivamente por mover el head mediante documentación de revisión.
