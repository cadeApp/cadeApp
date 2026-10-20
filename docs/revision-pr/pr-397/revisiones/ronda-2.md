# PR #397 — T-369 · revisión independiente, ronda 2

**Código inspeccionado en HEAD** `2e3517a6c861815bbaef4e584ad74d0a3c8e5ea3` (base develop `711a2f7054d77fd664d3ec09b3bbdd24efb88476`). **Fecha** 2026-10-17. **Resultado: CON BLOQUEANTES (1), PR397-R01.**

## Cambios verificados en la corrección

- **H01, parcial.** Se añadió `supabase/tests/integration/t369_publication_credits_concurrency.mjs`, ejecutado de forma real por `.github/workflows/ci.yml` `db-tests` en 8 escenarios PostgreSQL. Job 117447325749: 3 publicadas y 2 rechazadas con 3 créditos; mismo request una sola publicación/cargo; match/cancel, reconciliación, operaciones administrativas y gracia en carrera correctos. **Queda el bloqueo R01 por la demostración RED**.
- **H02, corregido sin ejecución independiente.** SQL de ambas RPC coteja ahora `note is distinct from v_note` con nota normalizada. Fake/pgTAP y Vitest agregan escenarios; los mutantes SQL provocaron fallos específicos y se restauraron.
- **H03, parcial.** `admin_update_setting('subscription_grace_days')` rechaza cambio incompatible con períodos futuros. Admin register/subscription hacen `FOR SHARE` del setting bajo lock del comercio; pruebas E7a/E7b verdes. **Queda R01 en la mutación de la carrera E7b**. La mutación secuencial de H03 sí falla aserciones originales en pgTAP.
- **H04, corregido sin ejecución independiente.** `release_publication` usa `clock_timestamp()` y la pgTAP crea un lote que venció luego del comienzo de transacción; prueba RED con `now()` y GREEN al restaurar.
- **H05, corregido sin ejecución independiente.** Tabla y snapshots admiten 0%, primera compra al 0 queda consumida, segunda compra ya no obtiene descuento; prueba RED/ GREEN, fake alineado.
- **H06, mejora corregida por lectura.** Body de PR describe rollback forward-only y preservación de derechos; no hay DROP destructivo. No se ejecutó un rollback.

## BLOQUEANTE NUEVO — PR397-R01 (alto)

**Archivo:** `supabase/tests/integration/t369_publication_credits_concurrency.mjs:339-373,577-612,735-771`.

**Reproducción por inspección:**

```js
async function scenarioPublishRace({ expectInvariant = true } = {}) {
  // ...
  if (expectInvariant) { assert.equal(metrics.ok, 3); /* restantes invariantes */ }
}
// El mutante de H01 saltea todo lo anterior:
metrics = await scenarioPublishRace({ expectInvariant: false });
assert.ok(metrics.reserved > metrics.granted); // oráculo invertido

// El mutante de H03 usa igual escape:
result = await scenarioGraceThenRegister({ expectInvariant: false });
assert.equal(result.overlap, true); // oráculo invertido
```

La evidencia RED no es falsa en sus métricas (se observaron **5 reservas sobre 3** y **solape legacy/plan** al mutar código real). El problema es la **metodología de prueba**: la ruta RED desactiva la propia aserción que debía ser sensible a quitar los locks. Esto viola la regla de pruebas de T-369: una mutación RED debe hacer fallar la misma prueba original, nunca una variante donde se saltean/invierten expectativas.

**Corrección:** no modificar código productivo. Hacer que `scenarioPublishRace()` siempre compruebe los conteos originales y `assertLedger`, incluso bajo mutación. `runMutationChecks` debe capturar la excepción de aserción **específica** resultante en modo mutante sin tocar las expectativas. Para E7b, usar sincronización que permita a la RPC tanto esperar lock como terminar anticipadamente (`waitLockWaiting` ya tiene `allowDone`), **en ambas ejecuciones**, y comprobar siempre `legacyEnd <= starts_at`. Una vez detectado el fallo específico de invariante bajo mutación, restaurar funciones en `finally`, ejecutar prueba original GREEN. No aceptar únicamente timeout o error SQL sintáctico como evidencia de RED; tampoco tocar fixture para inducir fallo ajeno. No es necesario volver a preguntarle a Lautaro073.

## Evidencia independiente observada

- **CI HEAD:** [run 39050294029](https://github.com/cadeApp/cadeApp/actions/runs/39050294029), job [db-tests 117447325749](https://github.com/cadeApp/cadeApp/actions/runs/39050294029/job/117447325749): **28 archivos/2688 pgTAP**, ocho escenarios concurrentes GREEN dos veces, mutaciones de H01, H02, H03 (secuencial y carrera), H04, H05 RED->GREEN, final GREEN. Unit, build, lint, typecheck, audit, bundle-budget pasaron.
- `approval-policy` rojo por informe vigente de ronda 1 con 5 bloqueantes; tras publicar ronda 2 con 1 permanecerá correctamente bloqueado hasta corregir R01.
- Base develop sincronizada: comparación `develop` → HEAD `ahead 12, behind 0`, sin conflictos al consultar.
- **No** corrí Docker, Supabase, unit ni pgTAP directamente; estas afirmaciones citan el job auténtico de GitHub y la lectura de implementación. Nadie distinto al autor ejecutó pruebas de DB aquí; **no** marcar hallazgos como `arreglado-verificado`.

## Alcance para próxima corrección

Solo `supabase/tests/integration/t369_publication_credits_concurrency.mjs` y bitácora `docs/tasks/log/T-369.md`; quizás cuerpo PR para actualizar evidencia. No retocar migración, fake, CI, catálogo, settings, RLS o tests pgTAP que ya pasaron sin nueva evidencia. No escribir `docs/revision-pr/pr-397/**` desde agy.

**Dictamen:** no aprobar ni mergear. R01 es bloqueante de integridad de la evidencia RED, no error confirmado del saldo en producción. Una nueva ronda comprueba RED auténtico, GREEN y HEAD exacto.