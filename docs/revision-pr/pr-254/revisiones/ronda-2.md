# Informe de revisión — PR #254 / T-302 — Ronda 2

**Head SHA revisado:** `13caf3f68c5c28613487290a0797852c8a161b7c`  
**Base:** `develop` @ `f1ae16106e61bbb6707b4adf17f7572bafbbd23b`  
**Fecha:** 2026-10-05

## Resultado

**CON BLOQUEANTES (2 nuevos).** H01–H04 están corregidos por inspección, pero permanecen `arreglado-sin-verificar` porque la rama no aporta ejecución GREEN del E2E corregido ni las mutaciones RED exigidas.

## Sincronización y alcance

- `develop...HEAD`: ahead 6 / behind 0.
- Mergeable: sí.
- Archivos del PR dentro de la ficha T-302: sí (`docs/revision-pr/**`, ficha, bitácora y spec).
- La rama integró `develop` mediante merge commit `de4ea3a...`; la bitácora lo llama “rebase”, pero el historial no fue reescrito. Se deja como mejora documental, no bloqueante.

## Estado de H01–H04

| Hallazgo | Estado R2 | Evidencia estática |
|---|---|---|
| H01 | arreglado-sin-verificar | El DNI duplicado se envía ahora por UI y se afirma alert + no navegación + DB. |
| H02 | arreglado-sin-verificar | No quedan `if(isVisible/isEnabled)` ni fallbacks a status/RPC en los flujos revisados. |
| H03 | arreglado-sin-verificar | Existe reset explícito a pending, available=false, vehicle/dni/decision null. |
| H04 | arreglado-sin-verificar | El TOTP se introduce en `/login/mfa` del browser y la aprobación final ocurre solo por UI. |

## H05 — 🔴 No hay GREEN post-arreglo ni mutaciones RED de la Ronda 1

**Archivo:** `docs/tasks/log/T-302.md`  
**Estado:** `[ANÁLISIS]`

La sesión de las 17:30 registra `pnpm typecheck`, `pnpm lint`, `pnpm test` y `pnpm exec playwright test --list`. `--list` solo descubre los tests: no ejecuta ninguno. El único bloque “Fase RED” de la bitácora es de la sesión inicial, anterior a la Ronda 1; justamente esos controles fueron declarados insuficientes.

Ronda 1 pidió cuatro mutaciones concretas (dedup neutralizada, submit disabled, vehicle_type null y browser sin completar MFA). Ninguna aparece ejecutada ni con salida RED en la sesión nueva. Por eso no puede afirmarse todavía que los controles corregidos realmente detecten esas roturas.

Además, `docs/tasks/T-302.md` marca `Falla si se quita el chequeo de MFA o la deduplicación` como `[x]` antes de aportar esa evidencia. Ese checkbox debe volver a pendiente hasta demostrarlo.

**Arreglo:** ejecutar el spec real en GREEN con `--workers=1`, ejecutar las cuatro mutaciones temporales pedidas, pegar en una nueva entrada append-only de la bitácora comando + fallo relevante + GREEN final, restaurar toda mutación y dejar el árbol limpio.

## H06 — 🔴 El setup de DNI puede usar un secreto distinto de producción

**Archivo:** `e2e/specs/courier-onboarding.spec.ts:214,456`  
**Estado:** `[ANÁLISIS]`

Los dos escenarios de DNI usan `process.env.DNI_HMAC_SECRET || 'test-e2e-dni-hmac-secret-min32chars!'`, pero producción exige `DNI_HMAC_SECRET` y `courierOnboardingAction` calcula el HMAC con `serverEnv.DNI_HMAC_SECRET`. Si el runner no recibe el secreto real, el spec siembra un hash con otra clave y deja de preparar el mismo DNI lógico que procesa la aplicación.

**Arreglo:** no inventar fallback. Leer `process.env.DNI_HMAC_SECRET`; si falta, lanzar un error explícito de precondición. Reutilizar un helper local para ambos escenarios.

## CI observado

- Vercel deployment del SHA: ✅ success.
- CI: `typecheck` ✅, `unit` ✅, `db-tests` ✅, `build` ✅; `bundle-budget` estaba aún en cola al revisar; `lint`/`audit` figuraban cancelados en ese run.
- `approval-policy`: ❌ únicamente porque falta aprobación vigente de `Lautaro073`. Esto es una acción humana posterior, no un defecto del código.
- `e2e-preview`: había runs `repository_dispatch` en cola/pendientes; todavía no existía un status `e2e-preview` publicado para este SHA al cerrar esta ronda.

## MEJORA

- En la próxima entrada append-only de bitácora aclarar que la integración de `develop` fue un **merge**, no un rebase. No reescribir la sesión ya cerrada.

## Decisiones para Lautaro073

Ninguna. H05 y H06 tienen una corrección técnica determinada; no requieren elegir alternativa.