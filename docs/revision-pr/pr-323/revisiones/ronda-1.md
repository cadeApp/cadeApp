# Revisión independiente — PR #323 / T-352 — Ronda 1

**Fecha:** 2026-10-13. **HEAD:** 6dd4bc251de1ecf6fffe040069d6f73086a7e419. **Base:** 875f8621fa727c115326cc2f83036e44859ad52e. **Estado:** Draft, abierta, no mergeada.

## Dictamen: CON BLOQUEANTE DE EVIDENCIA (H01). Sin defectos de código demostrados.

**Qué está bien y fue verificado por diff:** solo modifica src/features/requests/actions.ts, src/features/requests/actions.test.ts y docs/tasks/log/T-352.md: todos están expresamente permitidos por la ficha de develop. El único cambio productivo es devolver redirectTo='/merchant/dashboard' en lugar de '/merchant/requests' tras publish_request exitoso. La forma del contrato, controles de rol, consentimiento, piloto, suscripción, errores y RPC no cambian; el formulario mantiene router.push(result.data.redirectTo) y la ruta alias sigue disponible. Las dos aserciones reales del destino se cambiaron juntas y no se debilitaron las pruebas negativas.

### H01 — BLOQUEANTE: DoD de E2E y medición después aún incompletos

La bitácora y el body de PR declaran pendientes el GREEN real de e2e-preview y la medición posterior numérica. La ficha T-352 (leída de develop) los exige explícitamente, con ambos proyectos Chromium y global-settings, incluida subscription.global-settings.spec.ts DoD 2 y t340-legacy-checkpoint.spec.ts sin aumentar los 10 segundos. Al examinar, [run 38345452343](https://github.com/cadeApp/cadeApp/actions/runs/38345452343) tenía el job E2E pending y el run 38345453091 tenía E2E skipped: ninguno certifica GREEN. Además db-tests estaba in_progress. El run 38340200745 es la línea base de la PR #320, **no** prueba de la mejora de T-352.

**Cómo cerrar H01:** ejecutar/esperar resultados del E2E confiable del HEAD de aplicación; si falla, diagnosticar el primer error real sin editar tiempos/retries ni saltar tests. Extraer números posteriores comparables de la navegación (clic→URL final, rutas/status, latencias, cantidad de requests/cadenas auth) usando un método seguro read-only. Si no existe traza de tests PASS por configuración on-first-retry, documentar la falta de evidencia e instrumentar una medición autorizada; no fabricar un número. Registrar SHA, runs, comparación y resultados en docs/tasks/log/T-352.md y body, marcar DoD solo si fue demostrado y pedir ronda nueva. No hay que alterar el código actual para cerrar una falta exclusivamente de pruebas.

### H02 — MEJORA: ahorro cuantitativo de cadena auth presentado como probado sin after

La bitácora llama «Medición después — estructural» a una proyección de un request y una cadena de autenticación menos y estima ahorro 1427 ms. El baseline del autor registra **dos** GET /merchant/requests → 307 (1427 y 788 ms) y varios GET /merchant/dashboard RSC; el resultado nuevo todavía no fue medido. Eliminar el alias de destino está comprobado por código, pero no permite afirmar por sí solo cantidad efectiva de requests ni milisegundos ahorrados en Next.js. Separar claramente predicción, medición y efecto causal. Si el test sigue superando 10 s aun sin alias, informar evidencia y obtener autorización antes de modificar auth/guards/layouts.

### Checks sobre SHA 6dd4bc251de1ecf6fffe040069d6f73086a7e419

- [CI](https://github.com/cadeApp/cadeApp/actions/runs/38345371360): unit **129 suites, 2116 tests PASS** visto en log de job 115125436341; workflows 79 PASS y ADR 6 PASS. typecheck, lint, build, audit, bundle-budget SUCCESS. db-tests seguía en ejecución en esa consulta.
- Vercel reportó SUCCESS; E2E PENDING; approval-policy FAILURE por falta de informe de revisión.
- No se ejecutó pnpm ni Playwright local, ni SQL/Supabase remoto desde esta revisión. El RED de 2 tests y el GREEN de 8 suites/117 tests del autor constan en la bitácora pero no se reprodujeron localmente aquí.

### No revisado / dudas

No hay decisión pendiente sobre cambiar redirectTo: ya está autorizado por T-352. Si el E2E real demuestra que hace falta optimizar otros módulos de auth/SSR, la ficha exige autorización explícita de Lautaro073 **antes de ampliar alcance**. No aprobar ni mergear todavía, y no dar por cerrado el checkpoint de PR #320.
