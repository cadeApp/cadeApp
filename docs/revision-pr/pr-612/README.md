# PR #612 — T-422 · Maps y push del runner E2E

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/612 |
| Tarea | T-422 · Fase 4 |
| Autor | @Lautaro073 |
| Rama | `fix/T-422-runner-env` → `develop` |
| Base develop | `1105eaf42ae457b68cfd004ae182acebae68f3c7` |
| Estado | **Ronda 2: SIN BLOQUEANTES**; H01/H02 verificados y D01 aceptada |

## Rondas

| Ronda | SHA de código revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `aa2357d3646e3e963941c979d8ddb452489d313c` | H01/H02 mejoras; D01 aceptada | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `4dfca21602da7fc067bae4c82ba04c1e1fcd2366` | **SIN BLOQUEANTES** | [Ronda 2](revisiones/ronda-2.md) |

## Estado de hallazgos

| ID | Descripción | Severidad | Estado |
|---|---|---|---|
| PR612-H01 | Guardas de Maps antes del build | medio | arreglado-verificado en 4dfca216 |
| PR612-H02 | D01 en ficha, runbook y bitácora | bajo | arreglado-verificado en 4dfca216 |
| PR612-H03 | Reusar clave Preview ahora; CI propia solo ante error/consumo | decisión | aceptado, no equivale a activar B |

[Datos estructurados](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Pendientes operativos

- CI [42056929601](https://github.com/cadeApp/cadeApp/actions/runs/42056929601): **7/7 jobs en success**, incluido `db-tests` con **Files=42, Tests=3396, Result: PASS**; en `unit`, Vitest 193/193 archivos, 3568/3568 tests y workflows 84/84.
- La primera ejecución de E2E **con este YAML** es posterior al merge (por `workflow_run` desde `develop`). Solo tras un `e2e-preview success` se desactivan los Previews por rama de Vercel.
- Si aparece `RefererNotAllowedMapError` o problemas medidos de consumo compartido, aplicar la contingencia B autorizada. No alterar ahora claves, referrers ni cuotas.

La carpeta la escribe el revisor, no el agente implementador. El SHA de verificación corresponde al código inspeccionado, no al commit de la carpeta. No se aprobó ni mergeó la PR.
