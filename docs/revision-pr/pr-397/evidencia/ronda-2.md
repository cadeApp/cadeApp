# Evidencia real — PR #397, ronda 2

**SHA auditado:** `2e3517a6c861815bbaef4e584ad74d0a3c8e5ea3`. Se inspeccionaron los SQL, tests, fake, workflow, runner y logs de CI de ese HEAD.

## CI HEAD 2e3517a

- Run https://github.com/cadeApp/cadeApp/actions/runs/39050294029, job db-tests https://github.com/cadeApp/cadeApp/actions/runs/39050294029/job/117447325749, resultado SUCCESS.
- Log: `Files=28, Tests=2688`, `All tests successful.` antes y después de las mutaciones.
- `[T369] E1 ... OK (3 publican, 2 EXHAUSTED, reservado 3/3)`.
- `[T369] E2 ... OK (1 publica, 1 cargo corriente)`.
- `[T369] E3 ... OK (accept=true, cancel=false, cargo=consumed)`.
- `[T369] E4 ... OK (una liberación, sin match, sin deadlock)`.
- `[T369] E5 ... OK (una fila y una auditoría por clave)`.
- `[T369] E6 ... OK (una sola primera compra)`.
- `[T369] E7b ... OK (el alta esperó y agendó con gracia 10)`.
- `[T369] E7a ... OK (el cambio esperó y se rechazó con INVALID_SETTING_VALUE)`.
- `TODOS LOS ESCENARIOS MULTISESIÓN OK (8/8)` (dos ejecuciones).

## Mutaciones observadas y lo que realmente prueban

- H01: log `H01 mutado: {"ok":5,"exhausted":0,"published":5,"reserved":5,"granted":3}`; luego `H01 GREEN tras restaurar`. El log prueba que el mutante quebró el saldo; NO que falló la aserción original (`expectInvariant:false`).
- H03 carrera: log `H03 (carrera) RED: plan superpuesto con el derecho legacy` + GREEN. Mismo problema: `expectInvariant:false`, comprobación invertida.
- H02: pgTAP falló `H02: misma clave con otra nota da IDEMPOTENCY_CONFLICT`; GREEN.
- H03 secuencial: pgTAP falló `H03: ampliar la gracia`; GREEN.
- H04: pgTAP falló `H04: la parte del lote vencido vuelve como un suelto nuevo`; GREEN.
- H05: pgTAP falló `H05: la primera compra con 0 % devuelve launchDiscountPct = 0`; GREEN.

## Inspección exacta del oráculo que falta

- `supabase/tests/integration/t369_publication_credits_concurrency.mjs:339`: `scenarioPublishRace({ expectInvariant = true })`.
- `:364`: `if (expectInvariant) { ... assertions ... }`; `:745` con `false` evita esa rama; `:751` valida el inverso `metrics.reserved > metrics.granted`.
- `:577`: `scenarioGraceThenRegister({ expectInvariant = true })`; `:593`: `allowDone: !expectInvariant`, `:604`: salta `assert.equal(overlap,false)` cuando false. `:764` usa false, `:768` afirma `overlap === true`.

## Oráculo RED correcto para la próxima ronda (propuesta sin ejecución)

1. Eliminar la opción `expectInvariant` en ambas funciones y sus `if`; las expectativas del caso normal se aplican incondicionalmente.
2. Ejecutar caso normal: GREEN. Aplicar mutación efímera sin cambiar fixture/expectativas; invocar exactamente misma función; capturar `AssertionError` con mensaje específico (número de publicaciones, reservas o solape) como RED. Si mutante devuelve correctamente o falla por timeout/sintaxis/otro caso, fallar CI.
3. Restaurar funciones en `finally` sin cambiar pruebas. Ejecutar caso normal otra vez: GREEN. Mantener `db-tests` original sin debilitamiento.
4. Para E7b permitir tanto caso waiter realmente bloqueado como operación completada (`allowDone:true`) y comprobar siempre invariancia de fin legacy vs inicio del plan; si mutante opera temprano, falla aserción de solape en vez de timeout.

## Qué no se ejecutó desde esta revisión

- Docker/Supabase/Postgres local, pnpm, pgTAP o Vitest. No se presentaron tests simulados ni logs fabricados.
- `node docs/revision-pr/analizar.mjs` no ejecutado. Se comprobó formato JSONL mediante parseo JS en esta revisión.
- No se escribió en código del producto ni CI; solo se agregarán artefactos de revisión en rama.