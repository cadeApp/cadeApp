# PR #397 — T-369 / CC-029 · revisión independiente, ronda 3

**Código revisado** `7b2f4c127daa050ab5b70a2c33d835d04f0ec1fe` · 2026-10-17. Branch `feat/T-369-db-rpc` → `develop`. **Resultado: SIN BLOQUEANTES**.

## Alcance de la ronda 3

Comparación respecto al commit documental de revisión `64db83cabd74e83c078ae007cab5d65ae6c4cd29`: solo `supabase/tests/integration/t369_publication_credits_concurrency.mjs` y `docs/tasks/log/T-369.md` cambiaron. No cambió migración SQL, permisos/RLS, fake, pruebas pgTAP, `.github/workflows/ci.yml` ni umbrales. La rama está al día con la base develop al revisarla (base `711a2f7`, detrás 0).

## PR397-R01 — RESUELTO

- Se eliminó `expectInvariant` de `scenarioPublishRace()` y `scenarioGraceThenRegister()`. E1 ahora ejecuta **siempre** los cinco `assert.equal` (3 OK, 2 EXHAUSTED, 3 publicadas, 3 reservadas, saldo 0) y `assertLedger`.
- E7b usa `waitLockWaiting([register], { allowDone: true })` tanto contra SQL sano como mutado, sin condicionar el oráculo. **Siempre** exige `overlap === false` y `starts_at === legacyEnd`.
- `runMutationChecks()` llama **las mismas funciones** de los escenarios GREEN bajo SQL mutado. El helper `expectInvariantFailure` solo acepta un `assert.AssertionError` cuya primera línea coincide con el mensaje propio de una invariante permitida, rechazando timeout, sintaxis, errores ajenos y falsos GREEN. SQL restaurado en `finally`, luego ejecuta GREEN normal.
- **Verificación independiente ejecutada:** 8/8 controles estáticos del oráculo y 3/3 comprobaciones negativas en copias textuales instrumentadas por el revisor (ver evidencia). Esto no sustituye Postgres, pero confirma que ya no existe el interruptor de expectativas.

## CI verificable del SHA inspeccionado

- [Run 39055593220](https://github.com/cadeApp/cadeApp/actions/runs/39055593220), [db-tests job 117462791383](https://github.com/cadeApp/cadeApp/actions/runs/39055593220/job/117462791383): **PASS**. pgTAP: `Files=28, Tests=2688, Result: PASS` antes y después de mutaciones.
- Runner multisesión GREEN: ocho escenarios contra PostgreSQL físico, dos pasadas; E1 reporta `{ok:3, exhausted:2, published:3, reserved:3, granted:3, available:0}`.
- **H01 mutado, RED real:** log `AssertionError «E1 publicaciones paralelas: exactamente 3 publican» (actual 5, esperado 3)`; misma función tras restaurar: GREEN 3/2.
- **H03 carrera mutada, RED real:** log `AssertionError «E7b gracia primero, alta después: el plan no se superpone con el derecho legacy» (actual true, esperado false)`; misma función tras restaurar: GREEN, plan al final de gracia nueva.
- H02, H03 secuencial, H04 y H05 produjeron RED pgTAP esperado y GREEN tras restaurar. `db:types --local` generó tipos sin diff. Unit, typecheck, lint, build, audit, bundle-budget también terminaron SUCCESS.
- `approval-policy` sobre ese SHA estaba FAIL porque aún contenía en el cuerpo de PR el informe de ronda 2 con un bloqueante, no por falla funcional ni por modificar CI. Esta revisión reemplaza el informe en el cuerpo por ronda 3 SIN BLOQUEANTES; **no** se toca la política ni se finge su ejecución posterior.

## Estado de hallazgos

| ID | Estado | Observación |
|---|---|---|
| H01 | arreglado-sin-verificar | Multisesión real en CI, cambio funcional sin ejecución de DB por revisor |
| H02 | arreglado-sin-verificar | Nota en idempotencia; RED/GREEN pgTAP en CI y código alineado |
| H03 | arreglado-sin-verificar | Guarda de gracia + locks; GREEN y RED del autor |
| H04 | arreglado-sin-verificar | `clock_timestamp()` y prueba de cruce de vencimiento |
| H05 | arreglado-sin-verificar | Primera compra al 0%, ledger de beneficio |
| H06 | arreglado-sin-verificar | Texto de rollback forward-only coherente con contrato |
| R01 | arreglado-verificado | Verificación estructural independiente + contraste con RED real y GREEN en CI del SHA `7b2f4c127daa050ab5b70a2c33d835d04f0ec1fe` |

**Importante:** `arreglado-sin-verificar` no significa un fallo activo: se conserva para indicar que no se corrieron pruebas SQL localmente desde la revisión independiente, por decisión de no gastar Docker/Supabase; la evidencia CI se inspeccionó por dentro y se limita a lo que prueba.

## Correcciones menores de descripción del PR

El cuerpo aún arrastraba `Concurrencia real [ ]`, `inserción de descuento solo con pct > 0` y `Sin cambios en workflows`: son texto obsoleto de antes de los arreglos. Se actualiza solo metadata de la PR para reflejar **1-A**, **2-A** y el runner agregado a CI; no modificar código ni pruebas.

## Dictamen de cierre

**SIN BLOQUEANTES en el alcance de T-369 paso DB/RPC al SHA revisado.** Revisión cerrada; no se aprueba ni mergea sin indicación explícita de Lautaro073. La implementación UI y el E2E/staging siguen como pasos 2 y 3 en PRs distintas, respetando el piloto. No cerrar issue #356.