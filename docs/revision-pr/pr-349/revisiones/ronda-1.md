# PR #349 — Promoción controlada de #336 a staging — Ronda 1

**Fecha:** 2026-10-14 (Argentina; UTC ya 2026-10-15). **HEAD funcional:** `10ab26a11d02653309d6e065a30052471af6d463`. **Base:** `staging@edf5f860876e7b996a170cc2f586ee78769bbaf7`. **Develop:** `a3681e98f1a1d3aa5d2c3e97e535d7d9219c9d93`.

**DICTAMEN: SIN BLOQUEANTES DE CÓDIGO.** Merge **condicionado** a todos los controles propios de la PR y Vercel en verde; no confundir con CI de develop.

## Reconciliación de ramas (revisión por blobs Git)
- Última promoción: `develop@fbb6e5052a6473a0f7063e60a711b4fa452835f3` contra staging `edf5f860`. Las diferencias entre esos dos árboles Git son **nueve rutas**: cinco documentos de la revisión #335 y cuatro rutas de customización UI de staging.
- Cambio posterior de develop: `fbb6e505..a3681e98` altera exactamente **12 archivos**: query admin y test, tipos, migración, pgTAP y documentos/bitácora de #337.
- En **los doce archivos**, los blobs SHA de staging coincidían con el estado previo de develop (`fbb6e505`). Se descartó intersección: **cero conflictos**, todos los cambios fueron compatibles por igualdad de base.
- Árbol propuesto: sobre staging se agregaron los doce blobs de develop sin cambiar otro archivo. Tree SHA `e43054f5b3b1f7d4ebcf63cf33eac76c3b48cf58`. Se creó commit de merge con **dos padres**: primero staging `edf5f860`, después develop `a3681e98`. `git compare staging..release` muestra **12 archivos exactos**. No force-push, rebase ni push directo a staging.
- Se preservan los 4 archivos UI de staging: `src/app/(public)/layout.tsx`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/icon.svg` y el histórico `docs/revision-pr/pr-335/**`.

## Alcance y seguridad
- El cambio funcional proviene sin adulteración de la PR #337, previamente revisada independientemente y **SIN BLOQUEANTES** R2. No cambia más código que la RPC admin batch, su migración nueva y tipos/tests asociados.
- Migración `20261014180000_admin_merchant_delivered_counts.sql`: `SECURITY DEFINER` con `assert_admin_aal2()`, `search_path` fijo; cuentas por comercio y estado `delivered`, `REVOKE`/`GRANT EXECUTE` sin reabrir SELECT de tabla protegido por CC-023. En pgTAP 28 aserciones de roles, privacidad y conteos; las mutaciones RED del autor se comprobaron por logs de CI en PRs #338/#339; ninguna modificación en esta promoción.
- Solo **una nueva migración SQL** respecto a staging, ya aplicada en Develop mediante `migrate-develop` [run 38667902731](https://github.com/cadeApp/cadeApp/actions/runs/38667902731). No incluye migraciones destructivas adicionales. Preservar cuentas existentes; no reset, truncate, borrado de Auth ni SQL remoto directo.

## Evidencia de CI y pendientes
- `develop@a3681e98`: [CI run 38667902624](https://github.com/cadeApp/cadeApp/actions/runs/38667902624) **SUCCESS**; `migrate-develop` **SUCCESS** con log de aplicación de migración #336 y tipos sin drift.
- PR staging: nuevo [CI run 38669947827](https://github.com/cadeApp/cadeApp/actions/runs/38669947827) se encontraba **in_progress** durante el examen inicial (release HEAD `10ab26a1`). `approval-policy` inicial FAIL porque faltaba el informe independiente en el body, no por código. El commit exclusivo de documentos de revisión dará un HEAD posterior y exigirá **verificar de nuevo sus checks** antes del merge. Ningún job futuro se declara exitoso hasta comprobarse.
- Staging previo: Vercel `cadeapp-staging.vercel.app` READY sobre `edf5f860`, no posee hotfix. `migrate-staging` **solo** se inicia con push a staging después del merge; staging y producción no fueron modificados durante la revisión.

## Bloqueantes
Ninguno de implementación o de integración identificado. **Condición externa de merge:** comprobar CI completo + approval-policy + Vercel sobre el último HEAD.

## Postmerge / manual
- Verificar job real `migrate-staging` sobre SHA nuevo y logs `Applying migration 20261014180000_admin_merchant_delivered_counts.sql` y `Finished supabase db push`, así como drift cero de tipos.
- Confirmar deployment Vercel READY sobre el merge SHA, posteriormente ingresar a `/admin/merchants` con admin MFA AAL2 y comprobar que no hay `permission denied` y que el listado funciona.
- No declarar E2E de admin ni comprobación humana si no sucedieron. Issue #336 se cerró automáticamente por workflow board-sync, pero el paso operativo pendiente figura en [comentario de seguimiento](https://github.com/cadeApp/cadeApp/issues/336#issuecomment-6182578566).

## Metodología
Inspección vía GitHub de árboles completos recursivos, hashes, diff y logs Actions. Sin clon independiente, Docker, Supabase local, Playwright, ni consulta SQL remota. No atribuir al revisor los tests de CI del autor. La autorización explícita para merge viene de Lautaro073; no se emite aprobación GitHub en su nombre.
