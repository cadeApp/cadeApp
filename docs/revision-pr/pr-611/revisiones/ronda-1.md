# Informe de revisión independiente — PR #611 · T-422 · Ronda 1

**Fecha:** 2026-11-05  
**PR:** https://github.com/cadeApp/cadeApp/pull/611  
**Head revisado:** `229a3d06c81a11b45a207a17f94d572eece41afc`  
**Base:** `develop` @ `579fd80b7bca4c88e080d173f975213f2594faef`  
**Resultado:** **SIN BLOQUEANTES (0)**, sin mejoras exigidas, sin aprobación ni merge.

## Alcance y procedimiento

Leídos de `develop`: `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, `docs/tasks/T-422.md`, y las lecciones relevantes de pr-56/62/64/63/68/82. Se leyeron el diff completo, la bitácora de la rama, los comentarios de la PR y la evidencia de Actions. No existe previamente `docs/revision-pr/pr-611/` en la rama.

El diff examinado consta de **un archivo** permitido: `docs/tasks/log/T-422.md` (**+19/-0**, dos hunks). No hay cambios de la ficha, contratos, migraciones, paquetes, workflows, configuración CI ni `src/**`. Comparación contra la base: adelantada 2 commits, sin commits pendientes de develop; GitHub señaló `mergeable=true`. Sin clon por DNS no se ejecutó localmente `git merge-tree`.

### Enumeración de cambios de esta PR

| Fragmento añadido | Contraste con la evidencia |
|---|---|
| Sesión 4: merge de #610 y primera PR interna contra develop | #610 aparece mergeada (`1105eaf4`); su ejecución posterior no se confunde con el gate viejo de #610. |
| Sesión 7: run 42075421860, 116/6, Map sin error reportado | Logs y jobs de Actions confirman checkout de `95f95eed...`, ejecución de Chromium y global-settings y estado SUCCESS. El `RefererNotAllowedMapError` no aparece como falla en esa corrida; la ausencia universal no se certifica. |
| Sesión 7: paso manual en Vercel solo `develop` | El autor registra el comando guardado y comprobado al recargar; el bot confirma que Vercel omitió el deploy de `docs/T-422-cierre`. No se leyó de forma independiente el valor del panel ni se observó todavía un nuevo build de `develop`. |
| Sesión 7: pendiente únicamente merge de #611 | Consistente con el cierre de la ficha y el estado de la PR abierta. #614 es un bug distinto de T-414. |

## Evidencia de ejecución atribuida correctamente

- [E2E run 42075421860](https://github.com/cadeApp/cadeApp/actions/runs/42075421860), evento `workflow_run`: `resolve-pull-request`, `e2e-preview` y `report-preview-status` finalizaron SUCCESS. El log del job muestra `git fetch` y `checkout` explícitos del commit `95f95eedda08ab5b1bb04d289e100ed7649a2b8a`, `APP_URL=http://localhost:3100`, `116 passed (32.6m)`, `6 passed (2.5m)`, `announcements.spec.ts:67` pasó al primer intento; el job de publicación registra `TARGET_SHA` idéntico. El SHA superficial del workflow corresponde a `develop` y **no** es el SHA bajo prueba.
- [CI run 42073826935](https://github.com/cadeApp/cadeApp/actions/runs/42073826935), asociado al mismo SHA de código de #613: 7 jobs SUCCESS; unitarias `193 passed` y 3568 tests; workflows 85/85; db-tests `Files=42, Tests=3396, Result: PASS`, con comprobación final de diff de tipos. Se discriminan los RED temporales del job de DB de su resultado final.
- **Head de #611 distinto:** `229a3d06...` es documental; el CI run 42100320134 está `cancelled` y `approval-policy` en `failure` previo a publicar este informe. No se finge CI GREEN de ese head; tampoco se exige nuevo E2E solo por el commit documental de revisión.

## Comprobación propia RED → GREEN sobre el alcance documental

Un control independiente inspeccionó la bitácora real recuperada en el SHA de la rama. Basal GREEN. Se mutaron *solo copias en memoria*, no archivos del repositorio: (M1) ID de run, (M2) SHA atribuido, (M3) 116→115, (M4) 6→5, (M5) inversión del comando de Vercel y (M6) eliminación del encabezado de sesión 4. **Las seis mutaciones dieron RED**. Script completo y alcance del oráculo en [evidencia/comandos.md](../evidencia/comandos.md).

Estos RED no prueban funcionalidad E2E ni sustituyen a Playwright: evitan que la revisión acepte cifras o comandos documentales alterados. La correspondencia con la realidad se comprobó consultando Actions y el reporte del autor; el contenido interno del panel Vercel sigue fuera de la comprobación independiente.

## D01=A — decisión explícita de Lautaro073 (2026-11-05)

**Decisión:** cerrar documentalmente T-422 aceptando el registro del autor sobre el Ignored Build Step de Vercel. No afirmar que se verificó el panel independientemente.

- **A (elegida):** aceptar la bitácora y las señales externas parciales; no añadir infraestructura ni pedir otra ejecución costosa. Riesgo residual: un cambio posterior o valor de panel diferente no queda cubierto por esta auditoría.
- **B (descartada ahora):** obligar a comprobar manualmente panel y siguiente build. Eleva certeza operativa, pero retrasa una PR de documentación sin indicar defecto del gate.
- **C (descartada ahora):** verificación automatizada separada de Vercel. Más sostenible si hay regresiones de configuración frecuentes, con costo de permisos y mantenimiento que hoy no está justificado por incidentes medidos.
- **Qué falta verificar externamente:** el primer deployment futuro de `develop` con la nueva configuración y que ramas distintas de develop sean omitidas. No es bloqueante por decisión D01=A. Si cambia el costo o vuelve a desplegar ramas, reabrir la evaluación técnica.

## No tocar / límites

- No cambiar el producto de novedades para resolver la persistencia optimista: el defecto de T-414 se sigue por [#614](https://github.com/cadeApp/cadeApp/issues/614). La issue había sido cerrada por automatización sin arreglo; se reabrió y comentó. No es cambio ni bloqueante de #611.
- No inventar test ni adulterar assertions, mocks o salidas para forzar GREEN. Esta PR no requiere pruebas nuevas ni refactors.
- No tocar secretos, Environment remoto, Vercel ni Supabase. Tampoco disparar workflows manualmente.

## Cierre

Sin hallazgos propios dentro del alcance T-422. No se necesita prompt de reparación para el agy; en el único comentario de la PR se incluye un prompt acotado de **continuidad sin cambios**, con `git pull` y límites de edición. No aprobar ni mergear: la decisión de merge corresponde a Lautaro073. Solo se commitea `docs/revision-pr/pr-611/`.
