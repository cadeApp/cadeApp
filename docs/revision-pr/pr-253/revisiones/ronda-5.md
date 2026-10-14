# Ronda 5 — PR #253 (T-309) — Revisión independiente

- **Fecha:** 2026-10-09 UTC
- **PR:** https://github.com/cadeApp/cadeApp/pull/253
- **Autor:** asako669 (P3); revisor independiente: revisión de Lautaro073.
- **SHA funcional y documental inspeccionado:** `66630c1a548639be0e553e28685739f132050f4c`.
- **Base `develop`:** `8ebd5e2164cb895f320cec0562469f1382eedaa8`.
- **Comparación:** ahead 38 / behind 0; GitHub `mergeable=true`, PR en **Draft**.
- **Resultado:** **SIN BLOQUEANTES**, condicionado solamente a que el responsable pase Draft a Ready y decida el merge; no se aprobó ni mergeó.
- **Decisiones nuevas para Lautaro073:** ninguna. D01/1-A (dependencia Axe) ya estaba decidida y registrada.

## 1. Integridad de rama y alcance

Leí `docs/tasks/T-309.md` **desde develop**: objetivo upload lento/corte/retry, MIME inválido, cinco pantallas axe AA, checks, bitácora. La rama amplía la ficha únicamente con D01/1-A autorizada antes: `package.json`, `pnpm-lock.yaml` y `@axe-core/playwright@4.13.0` explícito. Diff actual contra develop: **13 archivos**, de los cuales 8 son informes históricos del revisor de rondas 1–4, los otros son `docs/tasks/{T-309,log/T-309}.md`, `e2e/specs/uploads-a11y.spec.ts`, `package.json`, `pnpm-lock.yaml`. Todos dentro de los archivos permitidos luego de D01. No hay cambios de RPC, RLS, contratos, src de aplicación ni workflows en la PR.

Desde el **último commit de R4 del revisor `3ff898488ea0`** el agente integró develop y actualizó la bitácora; la comparación de commits indica **cero cambios** en `docs/revision-pr/pr-253/**` y **cero cambios** en `e2e/specs/uploads-a11y.spec.ts`. La revisión anterior no fue sobreescrita por el agente. Los cambios posteriores a R4 en otras rutas de compare son integraciones legítimas de develop, no aportaciones adicionales al diff de T-309.

Las correcciones externas **T-350 / PR #308** y **T-351 / PR #310** están incorporadas mediante merge de `develop` `048baa37415c`, sin apropiarlas como código de T-309. **#296 y #297 siguen abiertas como issues administrativos**, aunque sus fixes fueron mergeados y los checks de axe ahora pasan; no constituyen fallos funcionales de esta PR.

## 2. Contratos de E2E y calidad

Leí el blob completo `e2e/specs/uploads-a11y.spec.ts` (335 líneas):

1. **Tags de accesibilidad:** `REQUIRED_WCAG_TAGS` incluye literalmente `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa`, usados por `AxeBuilder.withTags`; prueba expresa de tags.
2. **Corte/red lenta/reintento:** CDP `Network.emulateNetworkConditions` con 400 ms y 500 kbps; se intercepta `POST **/storage/v1/object/**`, se hace `route.abort('failed')` en primer intento, se exige `cutIntercepted===true`, se desactiva el corte y se vuelve a usar **el mismo `page.getByLabel(/DNI frente/i)`** para `setInputFiles`.
3. **Éxito y limpieza real:** espera de path en sessionStorage, comparación contra path capturado del POST real, estado accesible `role=status` con `dni_front.png`; `finally` hace `remove([pathToClean])`, comprueba error nulo y lista negativa del objeto.
4. **Rechazo servidor:** se llama a `courierClient.storage.from('courier-docs').upload` con `contentType: 'text/plain'` y se exige `data=null`, `error!=null` y mensaje que identifique `mime type`, no un rechazo genérico RLS.
5. **Axe AA:** cinco tests independientes para login anónimo, creación de solicitud merchant, feed de courier, viaje `matched` válido y onboarding. Cada ruta comprueba URL y ausencia de `violations`; los cinco exigen `passes.length>0`. No hay `disableRules`, `exclude`, `.skip`, `.only`, `.fixme` ni sleeps.

**Integridad de instrumentos:** en esta ronda el primer detector propio resultó insuficiente (procuraba `expect(audit.violations,` en una sola línea y contabilizaba apariciones de tags incluso en el test, no solo en el builder). Se descartó. Detector corregido busca el arreglo **declarado** de tags, cinco llamadas, cinco oráculos y cinco `passes.length`; baseline **9/9** propiedades verde. Se probaron 8 mutaciones independientes EN MEMORIA (quitar tag 2.2 AA, anular corte, quitar segundo `setInputFiles`, quitar cleanup, usar MIME permitido, omitir axe viaje, silenciar `color-contrast`, restringir tags del builder) y las **8/8** fueron detectadas como RED por su guard estructural. **No se ejecutó Playwright sobre estas mutaciones**, y así se declara en [evidencia](../evidencia/comandos.md).

Las mutaciones **runtime reales** de R4 siguen documentadas con runs `37548183777` (7 fallos del DoD) y `37550262717` (fallo por selector semántico imposible). Fueron revertidas; no hay mutación RED activa en HEAD. No se confunde fail-closed local por credenciales de staging con un RED conductual.

## 3. Evidencia remota exact-HEAD

**Preview que realmente corrió:** Vercel deployment `dpl_83DXhHGWqxYYp74cTDo2D5mweQHZ` en proyecto `cadeapp-develop`, **READY**, metadata `githubCommitSha=66630c1a548639be0e553e28685739f132050f4c`, rama `feat/T-309-uploads-a11y`. El workflow `repository_dispatch` **aparece etiquetado con el HEAD de develop `8ebd5e2`**, pero la identidad del **Preview bajo prueba** se verificó independientemente por el deployment ID y sus metadatos: `66630c1a548639be0e553e28685739f132050f4c`; no atribuir el run al código de develop.

[Run E2E 37995617834](https://github.com/cadeApp/cadeApp/actions/runs/37995617834), job `114040832810`: **SUCCESS real** (job `e2e-preview` ejecutado, no skipped), 67 Chromium PASS + 3 `global-settings` PASS. Los **8/8 tests T-309** están expresamente en el log en `uploads-a11y.spec.ts:48,64,209,250,262,278,294,320`; todos `✓` al primer intento, sin flaky ni skips. Se recuperó la auditoría de viaje y onboarding antes rojas por contraste/aria-hidden-focus.

[CI 37995517926](https://github.com/cadeApp/cadeApp/actions/runs/37995517926), evento `pull_request` **head_sha=66630c1a548639be0e553e28685739f132050f4c**, siete jobs **SUCCESS**:
- `unit`: **125 archivos / 2014 Vitest PASS**; workflows 79 PASS, ADR 6 PASS; ramas `src/domain/testing/rpc-fake.ts` **90,04%**.
- `db-tests`: **20 archivos / 1903 pgTAP PASS**, migraciones aplicadas en ambiente de CI, tipos `db:types --local` generados y sin diff pendiente.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`: SUCCESS.
- `approval-policy`: SUCCESS en PR #253 (el revisor no emitió aprobación propia).

**Checks locales reportados por autor** en bitácora: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `git diff --check` exit 0. Este revisor **no ejecutó** tales comandos localmente ni Docker/Supabase; reprodujo y leyó los logs CI del HEAD. El Playwright local fail-closed para 6 casos se declara `NO EJECUTADO EN LOCAL`, no como error de negocio.

## 4. Resultado y seguimiento

**BLOQUEANTES:** ninguno. No se abren nuevos `PR253-H13+`: los 12 hallazgos originales permanecen como `arreglado-verificado` por rondas previas, y el informe conserva su trazabilidad por SHA.

**MEJORAS:** cierre administrativo separado de [#296](https://github.com/cadeApp/cadeApp/issues/296) y [#297](https://github.com/cadeApp/cadeApp/issues/297), que siguen abiertas aunque sus PR correctivas están merged. No reabrir alcance de T-309 por eso.

**No revisado / dudas para Lautaro073:** no hubo reproducción local del stack ni `git merge-tree` ejecutado (GitHub `mergeable=true`, behind=0). La revisión no inspeccionó artefactos binarios de capturas de Playwright; sí comparó código, metadatos de deployment y logs E2E. El cambio de estado de Draft a Ready queda pendiente de usuario/autor; **no mergear PR en Draft**. Esta revisión agrega archivos de documentación y por eso mueve HEAD, lo cual dispara nuevos checks: deben finalizar verdes sobre el nuevo SHA antes del merge.

**Veredicto:** **SIN BLOQUEANTES EN RONDA 5**. Una vez que estén verdes los checks sobre el commit documental de esta revisión y que Lautaro073 cambie Draft a Ready, T-309 puede mergearse a `develop`. **No se aprobó ni mergeó**.
