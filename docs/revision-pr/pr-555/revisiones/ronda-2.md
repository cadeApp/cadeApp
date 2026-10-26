# Ronda 2 — PR #555 / T-416

**Fecha:** 2026-10-26 · **Revisión independiente** · **HEAD inspeccionado:** `08e3a6804fa5a191085d93c168c2421191dccfb1` · **SHA funcional:** `ad035c64c833ccbacec4bc1d8ac8cdb52e0ac681`.

## Informe revisar-pr

**Resultado: SIN BLOQUEANTES detectados.** Los dos bloqueantes de ronda 1 quedaron corregidos; `PR555-H03` permanece como mejora de rendimiento fuera del bloqueo y tiene issue #561. **No se aprueba ni mergea.**

### PR555-H01 — cerrado por inspección de test y ejecución CI

- Entre `722f3c20` y `ad035c64` se modificaron únicamente `src/domain/t416-zod-v4.test.ts` y la bitácora; no hubo cambios productivos para satisfacer el test.
- La prueba `las fechas que devuelven Postgres y JS...` usa el `isoTimestampSchema` real: espera que `2026-10-26T10:00:00+03:00` pase y `2026-10-26T10:00:00+0300` falle. En `src/domain/rpc-contracts.ts` permanece `z.string().datetime({ offset: true })`, en línea con D01=A.
- CI `unit` en SHA `ad035c64`, job [121430315772](https://github.com/cadeApp/cadeApp/actions/runs/40279643780/job/121430315772): **181 archivos / 3370 pruebas aprobadas**. El control está incluido en el código de ese SHA.
- **Alcance de verificación:** test real presente y ejecución verde remota comprobados; el RED→GREEN por mutación solo consta en la bitácora del autor (3 GREEN, mutante RED 1/3, GREEN 3/3), **no** se reprodujo por cuenta del revisor, porque `git clone` falla con DNS. No confundir esa limitación con una ejecución independiente.

### PR555-H02 — cerrado con ejecución E2E remota

- GitHub registra `e2e-preview=success` para `ad035c64`; job [121430325812](https://github.com/cadeApp/cadeApp/actions/runs/40279765486/job/121430325812) con **111 passed Chromium (29,6 min)** y **6 passed global-settings (2,7 min)**, sin flakies registrados.
- El HEAD `08e3a6804fa5a191085d93c168c2421191dccfb1` es un commit solo de `docs/tasks/log/T-416.md` sobre `ad035c64`; ese movimiento no altera la validación de producto. Se observa nueva ejecución pendiente en ese HEAD, pero la regla del proyecto prohíbe exigir nuevo CI verde solo por bitácora.

### PR555-H03 — mejora abierta, no bloqueante

- Permanece el aumento observado de **+13 kB First Load JS** en 28/62 rutas frente a `develop@24b2e37`. Issue [#561](https://github.com/cadeApp/cadeApp/issues/561) abierto; análisis específico de arrays sin máximos en [#560](https://github.com/cadeApp/cadeApp/issues/560).
- No se propone refactor de bundles en una migración de seguridad que resuelve GHSA-mrhx-c7xc-m3w5.

## CI y alcance

- **`ad035c64`:** success en `typecheck`, `lint`, `unit`, `build`, `bundle-budget`, `db-tests` y `audit`. En `audit`: **3 moderadas**, sin el aviso alto de Zod. El `db-tests` terminó success, incluyendo generación/comparación de tipos; su log incluye mutaciones RED intencionales de otros dominios que fueron restauradas y después `Result: PASS`.
- **`08e3a680`** al consultar: `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget` success; `db-tests` y `e2e-preview` pendientes. `approval-policy` aparece failure antes del comentario nuevo de revisión; no atribuirlo a Zod.
- **Sin comprobación local independiente:** `git ls-remote` devuelve `Could not resolve host: github.com`; no se dispone de clon ni de `node_modules/zod`. No se ejecutaron `pnpm`, `git merge-tree`, ni el harness de mutación. No se falsifican resultados.
- La PR tiene `mergeable=true` en GitHub. Sin cambios en ficha T-416, workflows, migraciones, CC ni ADR dentro del diff. `docs/revision-pr/pr-555/` fue escrita en la ronda 1 exclusivamente por la revisión; no aparece en los commits del autor (`722f3c20..08e3a680`).
- La ficha leída desde `develop` autoriza los cambios de API de Zod y los archivos del PR; no se detectó desvío nuevo.

## Decisiones y cierre

D01=A ya fue resuelta en ronda 1 y aplicada sin cambiar el validador. **No hay nuevas decisiones para Lautaro073.** Se publica ronda 2 con la evidencia anterior; no se solicita otra ronda ni cambios técnicos para T-416. Las promociones a entornos posteriores siguen pendientes y no se confunden con la revisión.

**La revisión no aprueba ni mergea la PR.**
