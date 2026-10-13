# PR #323 / T-352 — Revisión independiente Ronda 2

**Fecha:** 2026-10-13. **SHA del autor reexaminado:** 087d5c66386acadd449e2ecd655a9607313d2abc. Comparado con revisión R1 commit ac7786cc; los cambios posteriores del autor solo afectan docs/tasks/log/T-352.md (12 líneas añadidas, 6 borradas). La fusión intermedia es merge no destructivo del trabajo de la revisión; no cambia src/.

## Resultado: CON BLOQUEANTE DE EVIDENCIA (1), sin defecto funcional confirmado

**H02 — corregido por inspección, sin medición dinámica:** El autor cambió «Medición después» por «todavía no hay (PR323-H02)» y distingue la redirección eliminada en el código, la predicción de una cadena auth menos y la latencia real desconocida. Documenta que en la traza anterior existían tres GET /merchant/dashboard y que Next puede reordenar/repetir RSC. La corrección resuelve la confusión documental que encontró R1. Se registra `arreglado-sin-verificar` porque no se ha ejecutado una comparación post-publicación con números.

**H01 — permanece BLOQUEANTE:** DoD exige E2E chromium y global-settings verdes y medición numérica posterior. En el SHA 087d5c6 la bitácora mantiene «Falta» en líneas 104–106. El run E2E previo 38345452343 estaba `in_progress` al comprobarlo, no es PASS. Si concluye sobre un HEAD anterior no suplanta el gate del HEAD actual sin verificar SHA objetivo. No subir timeout de 10 s, retries, ni cambiar tests para conseguir verde.

### Comprobaciones

- Diff funcional y pruebas conservados desde R1: `actions.ts` devuelve /merchant/dashboard; `actions.test.ts` prueba los 2 éxitos, sin modificar errores, RPC ni reglas.
- CI técnica confirmada sobre SHA 6dd4bc25: unit 129 suites / 2116 tests, typecheck, lint, build, audit, bundle-budget PASS; en la última lectura de la ronda anterior db-tests estaba en curso. Los commits documentales posteriores necesitan checks propios.
- En esta ronda se leyó el patch GitHub del nuevo commit y su bitácora completa; no se corrió Playwright, Vitest ni SQL local y no se interpretó una predicción como medición.

### Dictamen y seguimiento

**Sin nuevas decisiones de Lautaro073.** La corrección H02 es apropiada, no revertirla ni exigir más código. El autor solo debe obtener el E2E confiable, números after comparables, registrar resultados con URLs/SHA y devolver a revisión. No aprobar, mergear ni liberar el paso 3/4 de T-340.
