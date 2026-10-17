# Evidencia real e inspección independiente — PR #397, ronda 3

**SHA código revisado:** `7b2f4c127daa050ab5b70a2c33d835d04f0ec1fe`. **Fecha:** 2026-10-17. GitHub Actions run 39055593220, job 117462791383.

## RED→GREEN observado en log auténtico (no fabricado)

```text
[T369] E1 publicaciones paralelas: métricas {"ok":3,"exhausted":2,"published":3,"reserved":3,"granted":3,"available":0}
[T369] TODOS LOS ESCENARIOS MULTISESIÓN OK (8/8)
[T369] E1 publicaciones paralelas: métricas {"ok":5,"exhausted":0,"published":5,"reserved":5,"granted":3,"available":0}
[T369] H01 RED: AssertionError «E1 publicaciones paralelas: exactamente 3 publican» (actual 5, esperado 3)
[T369] H01 GREEN tras restaurar: la misma función afirma 3 publican / 2 EXHAUSTED
[T369] H03 (carrera) RED: AssertionError «E7b gracia primero, alta después: el plan no se superpone con el derecho legacy» (actual true, esperado false)
[T369] H03 (carrera) GREEN tras restaurar: el plan empieza al fin legacy con la gracia nueva
[T369] H02 RED: falla «H02: misma clave con otra nota da IDEMPOTENCY_CONFLICT»
[T369] H02 GREEN tras restaurar
[T369] H03 RED: falla «H03: ampliar la gracia»
[T369] H03 GREEN tras restaurar
[T369] H04 RED: falla «H04: la parte del lote vencido vuelve como un suelto nuevo»
[T369] H04 GREEN tras restaurar
[T369] H05 RED: falla «H05: la primera compra con 0 % devuelve launchDiscountPct = 0»
[T369] H05 GREEN tras restaurar
Files=28, Tests=2688; Result: PASS
```

Log completo: https://github.com/cadeApp/cadeApp/actions/runs/39055593220/job/117462791383

## Inspección estructural ejecutada por el revisor (sin invocar BD)

Se recuperó el archivo `supabase/tests/integration/t369_publication_credits_concurrency.mjs` **desde el SHA auditado** mediante herramienta GitHub; se aislaron las dos funciones y el oráculo en memoria. Se ejecutaron 8 checks booleanos en código JavaScript (todos TRUE):

1. No aparece `expectInvariant` ni `if (expectInvariant)` en E1 ni E7b.
2. E1 conserva de manera incondicional los cinco `assert.equal` y `assertLedger`.
3. E7b conserva incondicionalmente `assert.equal(overlap,false)` y la igualdad de fechas.
4. E7b tiene `allowDone: true` en el flujo normal, no solo en mutante.
5. El control H01 llama exactamente a `expectInvariantFailure('H01', scenarioPublishRace, Object.values(E1_INVARIANTS))`.
6. El control H03 llama exactamente a `expectInvariantFailure('H03 (carrera)', scenarioGraceThenRegister, [E7B_INVARIANTS.overlap])`.
7. El helper exige `err instanceof assert.AssertionError`, valida `expectedMessages.includes(headline)` y corre `await scenario()`.
8. Ambas mutaciones se restauran en `finally`, y no hay sleeps fijos como oráculo.

Se hicieron **tres mutaciones estáticas de control del instrumento** en copias en memoria: quitar `assert.equal(metrics.ok,3)`, quitar `assert.equal(overlap,false)` y generalizar `AssertionError` a `Error`; cada mutación suprimió la propiedad estructural correspondiente (3/3). **Este análisis no es una mutación de SQL ni una ejecución local de Postgres**; la evidencia de RED/GREEN sobre SQL real proviene explícitamente del job CI de GitHub.

## Código y alcance

- Commit de ronda 2: `64db83cabd74e83c078ae007cab5d65ae6c4cd29`.
- SHA corregido: `7b2f4c127daa050ab5b70a2c33d835d04f0ec1fe` (3 commits posteriores, 2 archivos: runner de concurrencia + log).
- El diff de corrección no toca ninguna RPC, fake, pgTAP, workflow, CC, ni base de datos remota; solo refuerza el instrumento.
- Rama comparada con base develop `711a2f7`: ahead=12, behind=0; PR mergeable según GitHub.
- GitHub Actions `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget`, `db-tests` SUCCESS. `db-types` sin diff comprobado por job.

## Límites

- No se ejecutaron `pnpm`, Docker/Supabase local, comandos SQL ni mutations SQL propias desde esta revisión, conforme a la regla de costo. No se promete equivalencia con pruebas adicionales independientes.
- `approval-policy` se observó FAIL **antes** de sustituir el informe ronda 2; no afirmar verde hasta que el host lo confirme. No forzar workflow ni cambiar la política.
- Se corrige documentación de revisión y metadata del cuerpo, sin cambios de código. **No exigir nuevo CI GREEN solamente por estas modificaciones.**