# PR #582 — T-400 — Revisión independiente · Ronda 4

**Fecha:** 2026-11-03 · **SHA de código revisado:** `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b` · **Base develop:** `f4bd475bdec8378fa819fc75388fc505b808bd25`.  
**Resultado: SIN BLOQUEANTES de implementación.** PR Draft, no aprobada ni mergeada. **Gates externos pendientes antes de permitir merge:** `db-tests`, `e2e-preview` y re-evaluación de `approval-policy` al actualizar el informe del cuerpo.

## Alcance y trazabilidad

- Comparación `bc7a3978...9a0b6f5d`: **un commit** y **dos archivos** alterados por el autor: `src/features/admin/audit-catalog.test.ts` (+46/-10) y `docs/tasks/log/T-400.md` (+25); ambos autorizados en `docs/tasks/T-400.md` leído desde `develop`.
- Head del PR y rama `feat/T-400-audit-readable` coinciden con `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b`. Base `develop` conserva `f4bd475b...`. GitHub indica `mergeable: true`; no equivale al `git merge-tree` local inaccesible.
- Ninguna intervención del autor en `docs/revision-pr/pr-582/**` desde el commit anterior del revisor. Sin threads adicionales ni ampliación de ficha. No aparecen decisiones 🔵.

## Cierre de hallazgos históricos

| Hallazgo | Resolución examinada | Verificación independiente y límite |
|---|---|---|
| **H01 — medio** | `asAuditReason` conserva cadena original; solo cuatro acciones admitidas; `whitespace-pre-wrap` | Sonda V8 independiente 5 casos, incl. espacios iniciales/finales y saltos finales; inspección DOM; CI unit oficial success. No se ejecutó Vitest/E2E propio |
| **H02 — alto** | `comparedDomain` deriva valor por migración; compara exacto; `resolve` usa dominio dinámico; `calledDomain` valida callers | Sonda V8 en SQL **T-369 y CC-007**: cada dominio inicial = 7 declarados; añadir `new_unlabeled_action` en memoria = 8, sin etiqueta. CI unit success. No se ejecutó el Vitest mutado propio |
| **H03 — alto** | `scrubSql` distingue comentario/literal ejecutable | Mismo harness del revisor con casos `-- return`, `/* return */`, `raise notice 'return'`, strings E escapados: falsos verdes anteriores ahora rechazados. No full Vitest propio |
| **H04 — alto** | `scrubSql` procesa comentarios de bloque **anidados** y `returnsBeforeWrite` rastrea la profundidad de IF: solo `RETURN` a profundidad 0 | 17/17 casos del revisor en V8 con función SQL real: H04-1/H04-2/H04-3 pasan de `true` incorrecto a `false` correcto, `RETURN` directo y control positivo `true`. CI unit success. No full Vitest propio |

**Estado estructurado:** H01–H04 pasan a `arreglado-verificado`, **limitado explícitamente a las sondas ejecutadas por el revisor y la observación del job unit oficial**; `verificado_en_sha` = `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b`. No se inventan resultados locales de Vitest: los RED de ese runner corresponden a la bitácora del autor y a su harness. El alcance verificable no se confunde con un E2E ni con la suite de DB.

**El arreglo es técnicamente coherente:** `scrubSql` distingue `--`, `/* */` anidados, strings simples y `E'...'` con escapes; el analizador de `returnsBeforeWrite` descuenta subramas de IF, detecta el retorno directo antes de llegar al `INSERT` y rechaza de forma conservadora otras estructuras. Las mutaciones adversariales independientes confirman las propiedades que habían fallado en rondas 2 y 3. No se encontraron nuevas regresiones sustentadas en la ronda 4.

## Comprobaciones oficiales al SHA

- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, `unit` — **success** (GitHub Actions run [41698034807](https://github.com/cadeApp/cadeApp/actions/runs/41698034807)). En log unit se corroboró `Test Files 189 passed (189)`; suites Node workflow `81/81`, ADR `6/6`.
- `db-tests` — **en ejecución** en el mismo run, sin modificar `supabase/**` ni `src/server/**` en el PR. No atribuir verde hasta leer log `Files=/Tests=/Result:`, más comparación de tipos.
- `e2e-preview` — **pendiente/cola**: [run 41698361572](https://github.com/cadeApp/cadeApp/actions/runs/41698361572) y contexto `e2e-preview` pending sobre el SHA `9a0b6f5d2c6ca1811dc2c9000dbe2269a1714a3b`. El workflow del event dispatch muestra `head_sha` de la rama por defecto por diseño, pero resuelve el SHA del Preview en el job `resolve-preview`; no citar un E2E local sobre `2764de21` como el E2E oficial de `9a0b6f5d`.
- `approval-policy` — **failure** previo a esta revisión porque el cuerpo del PR tiene la sección `### Informe de revisión de agy` como «Pendiente»; el workflow lee el **cuerpo**, no comentarios. Tras publicar el informe `SIN BLOQUEANTES` allí, `pull_request_target.edited` reevalúa el control. No declarar éxito hasta su salida.

## Riesgo residual, mejoras y decisiones

**BLOQUEANTES:** ninguno en código. **MEJORAS:** ninguna nueva sustentada. **🔵 DECISIONES:** ninguna. Aún quedan los requisitos administrativos/CI pendientes: no mergear hasta que `db-tests`, `e2e-preview` y `approval-policy` estén verdes. Si falla uno, investigar resultado real antes de afirmar DoD.

**Limitación del entorno:** `git ls-remote` falló por DNS `github.com` y `pnpm` no está disponible. No se ejecutó `git merge-tree`, Vitest del repo, ni el agregador `analizar.mjs`; la verificación de los helpers se realizó en V8 contra SQL real con transcripción explícita y el resto mediante CI oficial por SHA.

## Entrega

Informes R1–R3, evidencia y lecciones se conservan. Esta ronda actualiza solo `docs/revision-pr/pr-582/**`, sin código. El comentario de la PR y la sección de su cuerpo contienen el reporte final. **No volver a exigir CI completo solo por el commit documental de la revisión.**
