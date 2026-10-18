# PR #402 — T-369 UI / CC-029 · revisión independiente, ronda 3

**Fecha:** 2026-10-17. **HEAD auditado:** `cd573afbc4c7c6d895145eea26285ca0ee14ffad`. Rama `feat/T-369-ui` → `develop`. **Dictamen: SIN BLOQUEANTES DE CÓDIGO**.

## Cierre H01–H04

| ID | Estado | Comprobación |
|---|---|---|
| H01 | arreglado-sin-verificar | Clave persistida por fingerprint SHA-512 en sessionStorage antes de enviar; recuperable tras remount/reload y no se recicla tras confirmación; tests del autor pasaron en CI. No repetí una compra real en PostgreSQL desde esta revisión. |
| H02 | arreglado-verificado | `handleReportNoShow` ahora captura `Promise.reject` y presenta `INTERNAL_ERROR` persistente en el diálogo; test con `mockRejectedValueOnce` y no republicación. El revisor ejecutó comprobaciones estáticas instrumentadas y cotejó 2739 tests unit SUCCESS en CI. |
| H03 | arreglado-sin-verificar | RPC lista planes con keyset `(sort,id)`, activeOnly y cursor, UI navega y carga más; pgTAP 151 planes, RED de cursor real en CI. No ejecuté BD local. |
| H04 | arreglado-verificado | D01-B: RPC `SECURITY DEFINER` + guarda AAL2, tabla sin SELECT directo, runner D01-B en base efímera con 4 mutaciones reales RED→GREEN y restore por md5+ACL. Auditoría estática propia 14/14 y 7/7 negativos más log CI original. |
| D01 | aceptado | Autorización humana D01-B ya resuelta; no requiere confirmación. |

## H04: RED verdadero verificado en logs del SHA inspeccionado

- Corrida completa: [39087097148](https://github.com/cadeApp/cadeApp/actions/runs/39087097148), [db-tests 117555836464](https://github.com/cadeApp/cadeApp/actions/runs/39087097148/job/117555836464).
- Baseline de pgTAP focalizada: 297 GREEN, 0 fallas; cuatro mutantes instalados sucesivamente y verificados. M1 sin guard AAL2: seis aserciones RED; M2 SELECT grant: cuatro RED; M3 sin predicado cursor: cuatro RED; M3b cursor solo sort: cuatro RED. **Restauró** y volvió a 297 GREEN tras cada uno.
- Misma suite pgTAP sin adulterar expectations; el runner rechaza un falso RED por errores de conexión/sintaxis/timeout. Su función `runSuite()` comprueba `psql` exit=0, plan TAP igual y nombres de aserciones, no solo líneas fabricadas.
- `Files=29, Tests=2764, Result: PASS` suite completa antes y después; `db:types` sin diff. Los 8 escenarios PostgreSQL multisesión de T-369 también pasaron.

## H02: corrección de error de transporte

- `src/features/trips/components/trip-merchant-container.tsx:43-54` protege el await con `try/catch`, no navega en excepción, muestra mensaje de error seguro persistente en diálogo y permite reintentar.
- El test de rechazo usa `merchantReportNoShowAction.mockRejectedValueOnce(new Error('network'))`, verifica `role=alert`, diálogo abierto y sin `republishTripAction`, y un reintento exitoso.
- [Job unit 117555836621](https://github.com/cadeApp/cadeApp/actions/runs/39087097148/job/117555836621): 145 archivos / 2739 tests en PASS. Typecheck, lint, build, audit, bundle-budget también PASS.

## Independencia y límites

- Auditoría propia de fuentes del mismo SHA: 14 propiedades estructurales y 7 controles negativos sobre copias de texto en memoria, todos detectados; script integral [evidencia/comandos.md](../evidencia/comandos.md). Esa comprobación es **estática**, no ejecución de las RPC ni de Vitest por el revisor.
- No se ejecutó Docker/Postgres local por regla de ahorro. La prueba SQL real se ejecutó en GitHub Actions; se inspeccionaron sus logs y el código de runner. Es impropio decir 'DB ejecutada por el revisor'.
- Diff propio entre `dadc753` y `cd573afb`: solo runner, CI +3 líneas, handler/tests no-show, ficha (ampliación autorizada) y bitácora; no migraciones/contratos/privilegios nuevos en ronda 3.
- El job unrelated T-340 de mutación de locks registró un timeout esperado en mutante y GREEN después. No confundir con fallo del camino sano.
- El único gate aún en `error` sobre el SHA inspeccionado es `e2e-preview`: `BLOCKED / REQUIRES DEVELOP MIGRATION`. No se verificó E2E de T-369 en Preview porque falta el despliegue de la migración D01-B en Develop; el paso 3/3 se ocupa de E2E/staging. No disminuir protecciones ni ignorar gates requeridos en la operación de merge.
- `approval-policy` de SHA de código estaba FAIL porque el cuerpo anterior conservaba marcador vacío. Esta revisión completa el informe, sin cambiar el check.

## Decisión final

**SIN BLOQUEANTES encontrados en implementación o controles de T-369 UI.** La revisión documental cierra la ronda 3. No se aprobó ni mergeó. El merge queda en manos de Lautaro073 respetando los gates efectivos; T-369 issue #356 no se cierra y `pilot_active` no se cambia.