# Revisión independiente — PR #610 / T-422 — Ronda 1

**Fecha:** 2026-11-04 (ART) · **SHA revisado:** `7c3f6a044a1e76e86d9ca8f17fcdaac49a24f0b9` · **base:** `7d07fdf80d94bce49580ec84cc39722b5bff4756`.
**Estado:** CON BLOQUEANTES (2), MEJORA A TOMAR (1). No aprobar/no mergear.
**Autor:** Lautaro073 · **reviewer:** revisión independiente asistida.

## Precondiciones y alcance

Leídos `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, `.agents/skills/revisar-pr/SKILL.md`, lecciones históricas, comentarios y bitácora. No había revisiones humanas ni hilos anteriores y tampoco carpeta de revisión `pr-610`. El SHA coincide con el HEAD remoto y la API informa `mergeable: true`; **no se ejecutó git merge-tree en clon local**, debido a falta de acceso DNS desde la terminal.

`docs/tasks/T-422.md` **no existe en develop** (se agrega en esta PR); el usuario aprobó conscientemente la excepción **D01=B**, que queda documentada como aceptación de proceso. Su contenido se contrastó con issue #608, el diff y el DoD. Los nueve archivos cambiados están dentro de su lista original. D03=B agrega una excepción puntual y aprobada para `e2e-mutation.yml`, inicialmente excluido; el autor debe reflejarla en la ficha cuando haga el ajuste mínimo.

## Controles correctos observados

- `workflow_run` suscrito a `CI` `completed` y resolvedor desde código de `develop` sin Environment ni secretos.
- `matchPullRequest` comprueba `event: pull_request`, `conclusion: success`, SHA de 40 hexadecimales, PR interna abierta contra `develop`, unicidad, head exacto y número válido.
- Bloqueo de `supabase/migrations/**` como status `error` sin ejecutar el job privilegiado.
- El job E2E usa checkout del SHA resuelto, servidor loopback, health 200, Playwright chromium y global-settings; mismo grupo de exclusión `cadeapp-develop-e2e`. El status final `success` depende del resultado E2E y no de un proxy.

Enumeración de clase: se comprobaron las guardas del resolvedor (evento, conclusión, SHA, abierta, base, repo, unicidad, head, número, migraciones), los steps que reciben secretos y los **dos** consumidores del grupo de concurrencia. Las pruebas originales de workflow solo afirman parte de las condiciones y no cubren la identidad de PR disparadora ni aislamiento build/runtime.

## BLOQUEANTES

### PR610-H01 · ALTO · El build corre con secretos privilegiados

**Ubicación:** `.github/workflows/e2e-preview.yml:90-109`; `.github/workflows/verify-workflows.test.mjs:1254-1290`.
El step `Run preview E2E gate` tiene `SUPABASE_SERVICE_ROLE_KEY`, `DNI_HMAC_SECRET` y `CRON_SECRET` en `env` y ejecuta `pnpm build` antes de iniciar servidor y tests. El código de la PR ejecutado durante build puede acceder a esas credenciales. No se observó exfiltración; se demuestra la exposición, no un incidente.

**Corrección autorizada D02=B:** step `Build PR without privileged secrets` con únicamente `NEXT_PUBLIC_APP_URL=http://localhost:3100`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=e2e-intercepted-maps-key` (más variables públicas imprescindibles, si se prueban). Separar `pnpm build` antes del step con `SUPABASE_SERVICE_ROLE_KEY`, `DNI_HMAC_SECRET` y `CRON_SECRET`. El step posterior arranca `next start`, exige health 200 y corre chromium y global-settings, sin reconstruir ni subir logs. Mantener `Verify Supabase Develop target` antes de cualquier acceso remoto. **Test de estructura por step**, no mera comprobación de ausencia de secretos fuera del step E2E.

**Evidencia:** inspector independiente del env + comando del build: `H01_build_without_secrets RED` en SHA original. Los tests del autor buscan secretos fuera del step completo, por lo que no detectan la exposición **dentro** del build. **Patrón:** `P08-control-no-cubre-lo-que-dice`.

### PR610-H02 · ALTO · No se ata el CI a la PR que lo disparó

**Ubicación:** `.github/workflows/e2e-preview-target.mjs:72-116`, en `matchPullRequest`.
El resolvedor busca `/commits/{head_sha}/pulls` y selecciona la PR interna abierta contra `develop`, pero **no verifica `workflow_run.pull_requests`**. El CI de una PR contra `staging` (o `main`) con el mismo SHA que una PR abierta a `develop` puede habilitar el E2E y publicar status sobre la segunda aunque no sea el CI que la validó. `CI` admite pull requests a esas tres bases; el payload real del run `41945869055` incluye `pull_requests[0].number=610`, `base.ref=develop` y `head.sha=7c3f6a0...`.

**Corrección:** exigir asociación positiva y única entre la PR seleccionada y el evento del `workflow_run`: número, `base.ref=develop`, head SHA exacto y repositorio/base correspondiente. Si `run.pull_requests` falta, está vacío, ambiguo o apunta a otra PR/base → `skip` o `reject` sin secretos ni status verde. Evitar tomar cualquier PR abierta del mismo commit como prueba de CI de esa PR.

**Prueba RED independiente:** construir `run.pull_requests=[{number:1000, base:{ref:'staging'}, head:{sha}}]` y `pulls=[PR interna #999 a develop con ese sha]`; el código original devuelve `match` (debería rechazar). Caso positivo con asociación #999 debe continuar verde; agregar variantes vacío, otra PR, base main y múltiples. **Patrón:** `P08-control-no-cubre-lo-que-dice`.

## MEJORA ACORDADA (requerida para completar D03)

### PR610-H03 · MEDIO · Queue ampliada en los dos workflows

**Ubicación:** `.github/workflows/e2e-preview.yml:50-52`, `.github/workflows/e2e-mutation.yml` (bloque `jobs.mutation.concurrency`), `docs/runbooks/e2e-preview.md`.
El comportamiento heredado `cancel-in-progress: false` solo conserva un pendiente por grupo por defecto. P1 decidió **D03=B**, `queue: max`; GitHub soporta hasta 100 pendientes y no admite combinarla con `cancel-in-progress: true`. Es mejora de eficiencia, no defecto demostrado del DoD original.

**Implementación aprobada:** agregar `queue: max` en ambos jobs que usan `cadeapp-develop-e2e`, conservar `cancel-in-progress: false` y el nombre del grupo; actualizar los dos tests de estructura del workflow y el runbook, explicando el límite 100, cancelación al llenarse y orden FIFO de espera (no orden del despacho). Actualizar ficha mínimamente para registrar excepción de `e2e-mutation.yml`, autorizada por P1; sin tocar el resto del workflow de mutaciones.

**Prueba:** ambos tests positivos deben dar GREEN con `queue: max`; mutar quitándolo en cada workflow por separado debe dejar el test correspondiente RED. **Patrón:** `P06-enumeracion-incompleta` (dos consumidores del mismo contrato).

## CI / cobertura y limitaciones

- CI run `41945869055` del SHA `7c3f6a044a1e76e86d9ca8f17fcdaac49a24f0b9`: `build`, `typecheck`, `lint`, `unit`, `db-tests`, `audit`, `bundle-budget` verdes. Bitácora autor: 80/80, typecheck/lint y pnpm test; confirmados por CI unit para 192 archivos de Vitest, 80/80 de workflow y 6/6 ADR.
- `db-tests`: `Files=42, Tests=3396, Result: PASS`; también controles RED por mutación y `git diff --exit-code` de tipos sin cambios, en el job de ese SHA.
- Verificación independiente en la herramienta GitHub: las guardas y mutaciones del helper probadas EN MEMORIA (control inicial GREEN; mutantes M01–M05 RED). `H02_CI_wrong_PR` y `H01_build_without_secrets` RED. `queue: max` ausente en los dos workflows.
- No se pudo hacer `pnpm typecheck/lint/test` en el clon, ni `git merge-tree`, porque el contenedor no resuelve `github.com`. El script autónomo completo está en evidencia; sintaxis revisada con `node --check` y se verificó el comportamiento de los helpers usando los contenidos exactos leídos por GitHub.
- No se corrió Supabase/Docker local ni se tocaron Environment, Vercel o secretos.
- El nuevo disparador `workflow_run` **no es ejecutable antes del merge**: la PR sigue pasando por el gate Preview viejo. Primero hay que resolver H01/H02 y la mejora H03; la validación E2E real post-merge queda como procedimiento operativo separado.

## Decisiones P1

**D01=B:** acepta excepcionalmente que la ficha nazca en la misma PR. **D02=B:** aislamiento del build. **D03=B:** queue: max en ambos workflows; ampliación de alcance aprobada únicamente para el bloque de concurrencia y tests asociados. No queda decisión por consultar.

## Próxima ronda y cierre

El autor **no toca `docs/revision-pr/**` ni marca hallazgos verificados. Arregla código y tests de producción con RED→GREEN auténtico, actualiza bitácora como `hecho/pruebas/falta`, commitea y pushea sin rebase/force/amend; la revisión independiente verifica el nuevo SHA en ronda 2. No exigir nuevo CI verde solo porque esta ronda agregue documentación. Queda pendiente acción manual de Vercel **después** del primer E2E GREEN con el gate nuevo, jamás antes.
