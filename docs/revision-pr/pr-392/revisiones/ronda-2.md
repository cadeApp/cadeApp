# Informe revisar-pr — PR #392 — Ronda 2 / Verificación documental

**Fecha:** 2026-10-17 · **HEAD actual:** `a53164916189e4b5d93f51cee285db24523747db` · **HEAD funcional conservado:** `61ebc07c1f2ffc23724bc0be0793dd2ac7c15fb6` · **Resultado: SIN BLOQUEANTES DE CÓDIGO O DOCUMENTACIÓN DE ROLLBACK; H01 arreglado-sin-verificar. MERGE CONDICIONADO A approval-policy VERDE Y AUTORIZACIÓN EXPRESA DE LAUTARO073.**

## Contraste con R1
GitHub compare `a531649...HEAD` = **identical (0 commits nuevos, 0 archivos)**. El autor **solo editó la descripción de PR #392**, con última actualización a las 05:02 UTC. El body ahora:
- Reconoce que CC-025 A/B0 son aditivas, pero `20261015084902_cc026_reconcile_expired_requests.sql:178–195` **REVOKE UPDATE general** en `delivery_requests` y `offers` a authenticated, restaurando solo permisos de columnas específicas; cita pgTAP CC026 251–259 (42501).
- Agrega matriz del `staging@86c98cae`: actions de requests/offers llaman RPCs, cron antiguo usa createAdminClient service_role, onboarding antiguo hace UPSERT directo de courier_documents que CC025 A permite; observa riesgo de caché/consumidores directos no inventariados.
- Explica que un `git revert` + redeploy no deshace migraciones ni permisos, prohíbe GRANT ALL de emergencia y, ante regresión, exige una migración compensatoria forward-only revisada.
- Enumera criterios STOP: migrate-staging/db:types, deploy-staging mismo SHA, health, e2e-staging, smoke onboarding B0/requests/offers/CC028/CC026. **Estos gates aún no están ejecutados**.

**Dictamen PR392-H01:** el error documental concreto de ronda 1 fue corregido por inspección del body y el SQL, se marca `arreglado-sin-verificar` porque no ejecutamos smoke de aplicación legacy sobre DB de staging migrada ni PostgreSQL independiente. No hay evidencia de ruptura real, ni permiso de despliegue anticipado. La frase `service_role (superuser / bypass RLS)` es imprecisa: service_role suele tener BYPASSRLS, no es necesariamente superusuario PostgreSQL. Se solicita ajustar a `service_role con BYPASSRLS y privilegios apropiados` como mejora textual.

## Único gate previo pendiente: approval-policy
[CI #39004412632](https://github.com/cadeApp/cadeApp/actions/runs/39004412632) SUCCESS sobre **`a53164916189e4b5d93f51cee285db24523747db`**: 135 suites / 2492 Vitest, 26 archivos / 2341 pgTAP, tipos locales diff sin drift y typecheck, lint, build, audit, bundle-budget PASS. Sin cambios funcionales desde R1. Vercel Preview develop READY, Supabase Preview SKIPPED.

[approval-policy #39004741813](https://github.com/cadeApp/cadeApp/actions/runs/39004741813) **FAIL**, log: `Falta el informe completo de revisar-pr sin bloqueantes`. La función `hasCompleteReport()` de `.github/workflows/approval-policy.mjs` lee **solo la sección `### Informe de revisión de agy` en la descripción**, exigiendo literalmente `Informe revisar-pr — T-xxx`, `Resultado: SIN BLOQUEANTES`, `Checks locales:`, `BLOQUEANTES:`, `MEJORAS:`, `No revisado / dudas para Lautaro073:`. **Un comentario de revisión no sirve para este check.** Editar PR body dispara `pull_request_target.edited` sin necesidad de tocar el código ni workflows.

El body también declara como HEAD release `a5316491d9d9f52f3e07080fae9910d93ea6b6b7`, SHA **INEXISTENTE** (GitHub API devuelve 422); HEAD real es `a53164916189e4b5d93f51cee285db24523747db`. Es mejora de trazabilidad a rectificar en el mismo edit de body, no defecto funcional.

## Recomendación
**Código de promoción apto condicionalmente** a que agy agregue la sección exacta de revisión independiente al body sin atribuirse su autoría, corrija el SHA, y `approval-policy` quede PASS para el HEAD real. El base `staging@86c98cae` y origen congelado `cf65ce25` siguen intactos. No hay C en el release; preserve 14 archivos staging exclusivos y cuatro migraciones A/B0/CC026/CC028. Después Lautaro073 puede AUTORIZAR explícitamente merge de #392, que automáticamente aplica migraciones antes de desplegar; post-merge verificar workflows en ambiente, no declarar gate CC025 R04 resuelto hasta entonces. #364 queda abierta y no mergeable.

El revisor no ejecutó Docker, pgTAP propio, Supabase remoto ni E2E de staging; no aprobó, mergeó ni desplegó. Sin nuevos hallazgos funcionales.

[Hallazgo](../hallazgos.jsonl) · [Evidencia](../evidencia/comandos.md) · [Prompt continuación](../prompt-agy-ronda-2.md).
