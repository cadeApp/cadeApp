# Informe independiente — PR #364 / CC-025 / T-356 — Ronda 7

**Fecha:** 2026-10-17 · **Código auditado:** `4b7117a425bb3aad9de58f8c961fd35a8c04165c` · **Base:** `develop@256ae179dcba9f9e0f5d54f236c93b42ec41281c` · **Resultado: SIN BLOQUEANTES NUEVOS. APTA PARA DECISIÓN HUMANA DE MERGE SOLO A DEVELOP, condicionada a checks del HEAD final. NO APROBAR/MERGEAR POR EL REVISOR.**

## 1. Delta desde R6 y revisión del alcance

La rama PR364 se sincronizó mediante merge normal `493f9fafdfbb879ddf041e1070ae891dcb31e290` y documentó el gate real B-only en el commit `4b7117a425bb3aad9de58f8c961fd35a8c04165c`. `compare origin/develop...PR364` devuelve **ahead=39, behind=0**, GitHub `mergeable=true`; sin conflictos de merge aparentes. Desde el commit independiente R6 `19e1b08ac833e5f809692485e53ae9c7dc7861a7` se modificaron por autor únicamente `docs/contracts/CC-025.md` y `docs/tasks/log/T-356.md`; archivos de PR388, fichas T-359/T-369 y plan general vinieron de merge de `develop`, **no** son scope nuevo del autor de #364. `docs/revision-pr/pr-364/**` no fue editada por el autor. Ficha T-356 leída desde `develop`, CC025 aprobado como vía contract-change ya autorizada.

La migración `20261016210000_cc025_courier_document_replacement.sql`, `src/server/rpc/**`, suites pgTAP, test runners y archivos de código propios de la Fase C **NO fueron editados después de R6**. SQL R06 mantiene prefijo Storage literal y objeto Storage existente; R07 mantiene `REVOKE INSERT, UPDATE, DELETE` a `public, anon, authenticated`, con B0/replace autenticadas `SECURITY DEFINER`. Se preserva el writer de B que llama `submit_courier_onboarding_documents` y el update posterior a `couriers` condicionado por profile_id/status, tanto en develop como en staging. Índices UNIQUE, backfill con `now()+30 days`, locks ordenados y verificación admin son los mismos de R6. No se detectaron bypass, test fake ni debilitamiento nuevo en el delta propio.

## 2. PR364-R04 — GATE B-ONLY STAGING VERIFICADO

Se **cierra R04** como `arreglado-verificado` para su condición específica (desplegar B antes de C en staging), por **comprobación independiente de la ejecución real de GitHub Actions**. Fuente de verdad del despliegue: **`fb7db3f035251a78e5a9e32f5e3465735a36ba4f`** en `staging`, no el HEAD de PR C.

- PR #392 **merged** en `fb7db3f035251a78e5a9e32f5e3465735a36ba4f` (no cambiar staging desde la revisión).
- [`migrate-staging` run 39006887225](https://github.com/cadeApp/cadeApp/actions/runs/39006887225), job 117321063407 **SUCCESS**: logs de `supabase db push --yes` aplican expresamente **20261015084902 CC-026**, **20261015153311 CC-025 A**, **20261016020000 CC-028**, **20261016033941 CC-025 B0**; termina sin error, con `db:types` y `git diff --exit-code` sin drift.
- [`deploy-staging` run 39006925376](https://github.com/cadeApp/cadeApp/actions/runs/39006925376), job 117321173186 **SUCCESS**: checkout comprobado del mismo `fb7db3f035251a78e5a9e32f5e3465735a36ba4f`, build Vercel `cadeapp-staging`, publicación/alias `https://cadeapp-staging.vercel.app` y `/api/health` correcto.
- `e2e-staging` job 117321445165 en el mismo deploy: **82/82 Chromium PASS**; `e2e/specs/courier-onboarding.spec.ts` incluye flujo UI completo (carga documental) y permisos, más tests de ofertas, pedidos y smoke. Validado log real y `PLAYWRIGHT_TEST_BASE_URL` staging, no Preview develop.
- El árbol de `staging` **NO** contiene `20261016210000_cc025_courier_document_replacement.sql`; C no estaba aplicada en la fase B. `staging/src/features/courier-onboarding/actions.ts` invoca RPC autenticada B0, no `.upsert()` de documentos. Exactamente eso reduce el riesgo de `migrate` antes de `deploy` al instalar C más adelante.

**Límite explícito:** logs de deploy + E2E no demuestran ausencia universal de navegadores antiguos en caché, clientes externos o llamadas REST inactivas. La frase del contrato «sin writers legacy» solo está justificada para **el código de la versión desplegada**, no como una medición exhaustiva del tráfico. La búsqueda local `git grep` declarada por el autor no reemplaza observabilidad de conexiones antiguas; no convertir ese riesgo residual hipotético en una falla demostrada. Gate **resuelto para la secuencia técnica**; antes de una posterior promoción de C a staging, confirmar versiones activas y observar tráfico/logs razonablemente.

## 3. Checks del SHA auditado `4b7117a425bb3aad9de58f8c961fd35a8c04165c`

- [CI #39011025442](https://github.com/cadeApp/cadeApp/actions/runs/39011025442) **SUCCESS**: unit **137 suites/2515 tests PASS**; db-tests **27 archivos/2420 pgTAP PASS**; typecheck, lint, build, audit, bundle-budget y approval-policy PASS; `pnpm db:types --local` + diff tipos limpio.
- En job `db-tests` 117333401575 se verificó test multisesión B0+C sin deadlocks `40P01`; mutación real SQL R06 cambiando comparación literal por `LIKE` produce **RED por aceptación indebida de licenseX**, restauración GREEN; R07 reintroduce `GRANT INSERT`+policy y produce RED por bypass, restaura `42501/0 filas` GREEN. Mutación de backfill `now()+30` a `uploaded_at+30` detectada RED y restaurada GREEN. **Estas ejecuciones corresponden a CI del autor, no son pruebas PostgreSQL independientes del revisor.**
- `e2e-preview` sobre HEAD PR C sigue **`error: BLOCKED / REQUIRES DEVELOP MIGRATION`**, [run 39011078532](https://github.com/cadeApp/cadeApp/actions/runs/39011078532). **NO declarar E2E post-C aprobado**. Aplicar C solo mediante workflow al merge autorizado en `develop`, luego correr E2E real post-migración antes de promover C a staging.
- Se inspeccionaron código, revisión histórica, contrato, bitácora, GitHub API logs de migración/deploy staging y CI del SHA; **NO se ejecutó Docker, SQL/Supabase propio, E2E local ni migración remota desde la revisión**. Por eso otros 13 hallazgos conservan `arreglado-sin-verificar` y `verificado_en_sha=null`. R04 únicamente corresponde a gate desplegado y observado independientemente por API, anclado a SHA staging.

## 4. Mejoras de trazabilidad (no bloqueantes)

- En la solicitud/comentario del autor se consigna un SHA completo **`4b7117a4c77c61bf8e05c87fcdebf8ec8ebc0c7f` inexistente como HEAD actual**. SHA real auditado `4b7117a425bb3aad9de58f8c961fd35a8c04165c`. Corregir cualquier referencia del body/comentario donde figure como HEAD, y reemplazar run #39001349502 anterior por la evidencia CI del HEAD actual. No citar SHAs inferidos ni copiarlos de una terminal sin contrastar remoto.
- El body del PR conserva texto histórico sobre `staging` aún «BLOQUEADO»; actualizarlo al **gate R04 completado**, mencionando `staging@fb7db3f0` y los dos runs de despliegue, pero **mantener producción/main bloqueada**.
- El contrato dice «staging opera exclusivamente con escritor RPC B0»; afinar a «**la versión publicada en staging** usa exclusivamente B0; no se acredita ausencia global de sesiones/clients antiguos sin tráfico».
- Si se necesitara una reversión post-C, **Git revert no revierte DDL/grants**: ejecutar exclusivamente una migración compensatoria forward-only revisada y autorizada, preservando datos. No dar por automático el rollback.

## 5. Dictamen y próximos gates

**PR #364 FUNCIONALMENTE APTA para la decisión de Lautaro073 de merge SOLO hacia `develop`** con todos los controles del SHA final verificados. **No aprobar ni mergear por cuenta del revisor.** Ese merge aplicará en Supabase Develop la migración C por `migrate-develop`; vigilar migración, generación de tipos, E2E Preview real con C ya instalada y comprobar writer B0, replace, RLS, auditoría y rechazo 42501 a inserts directos. Si falla, **STOP**; no promover C a staging. `staging` ya está en B-only, pero el rollout de C allí requiere su propia PR/revisión/autorización y `main` continúa sin promoción. No avanzar UI #358 ni cerrar issue #363 antes del gate post-C y la dependencia aprobada.

[Prompt operativo posrevisión](../prompt-agy-ronda-7.md) · [Evidencias](../evidencia/ronda-7.md) · [Hallazgos](../hallazgos.jsonl).
