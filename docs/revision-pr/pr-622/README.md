# PR #622 — T-422 · Hotfix de runner Playwright

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/622 |
| Autor | @Lautaro073 |
| Rama | `fix/T-422-runner-ubuntu-24` → `develop` |
| SHA revisado | `58cb60e0c24b0f28a7300c933e9d3773cbf22c10` |
| Base de referencia | `7809c3991767bd1770b1e5d3d1f945ac38c34463` |
| Fecha | 2026-11-05 |
| Tamaño del cambio | 6 archivos, +40 / -4 líneas (antes de esta revisión) |
| Resultado | **SIN BLOQUEANTES**; 2 mejoras no bloqueantes |

## Rondas

| Ronda | SHA de código revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `58cb60e0c24b0f28a7300c933e9d3773cbf22c10` | PR622-H01 (medio), PR622-H02 (bajo) | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR622-H01 | Test universal usa lista cerrada de tres jobs | medio · test-coverage | abierto, no bloqueante; seguimiento #623 |
| PR622-H02 | La ficha permite y a la vez excluye e2e-staging | bajo · conventions | abierto, editorial, no bloqueante |

**Decisión D01 (urgencia):** A, pin explícito `ubuntu-24.04` en los tres jobs. B (actualizar Playwright y quitar pin) pasa al seguimiento [#623](https://github.com/cadeApp/cadeApp/issues/623); no usar C (override de plataforma sin soporte).

**Pruebas sobre SHA revisado:** CI #42131903532: typecheck, lint, unit 3568/3568, workflow tests 86/86 y build en success; el job db-tests estaba en curso durante la recopilación. El E2E real del workflow nuevo no puede verificarse hasta que el YAML esté en `develop` por `workflow_run`; la caída original sí está comprobada por run #42117303547.

**Entregables:** [hallazgos.jsonl](hallazgos.jsonl) · [comandos](evidencia/comandos.md) · [lecciones](lecciones.md).

## Acción pendiente que requiere intervención humana

El merge de #622 lo realiza una persona autorizada; esta revisión **no hace merge, no activa auto-merge y no aprueba**. Luego del merge verificar una corrida real de `e2e-preview` (Chromium y `global-settings`) con runner Ubuntu 24.04; si falla, abrir la evidencia del step y tratarlo como nuevo defecto en vez de marcar GREEN.
