# PR #654 — T-428 · Hotfix E2E de licencia rechazada por vehículo activo

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/654 |
| Tarea | T-428 · Fase 4 · issue #653 |
| Autor | @Lautaro073 (P1) |
| Rama | `feat/T-428-licencia-por-vehiculo-e2e` → `develop` |
| Base revisada | `4ae5404ee14651d00ad0c9286f250ba6c5441c49` |
| Implementación revisada | `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc` |
| Alcance | 4 archivos, +99/-0 líneas antes de esta revisión |
| Resultado R01 | **SIN BLOQUEANTES de T-428**; E2E propio GREEN sin retry |
| Decisión | **D01=A**, confirmada por Lautaro073 |
| Estado de PR | Draft, abierta; **no aprobada ni mergeada** |

## Rondas

| Ronda | SHA revisado | Hallazgos propios | Informe |
|---|---|---:|---|
| 1 | `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc` | 0 | [ronda-1.md](revisiones/ronda-1.md) |

[Datos estructurados](hallazgos.jsonl) (vacío: cero hallazgos propios) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Estado del gate

- [CI de implementación](https://github.com/cadeApp/cadeApp/actions/runs/42335300787): typecheck, lint, unit, db-tests, build, audit y bundle-budget en verde. Unit 197 archivos / 3.708 tests; pgTAP 43 archivos / 3.582 tests.
- [E2E trusted](https://github.com/cadeApp/cadeApp/actions/runs/42335963853), job 128292871037: checkout explícito de `c3accb7eb748b58dd2f77d918992f3b54f1fb9fc`; `✓ courier-onboarding.spec.ts:1056` en el primer intento (29,9 s). Estado publicado `e2e-preview=success`.
- **Incidencia ajena, no oculta:** `admin-audit-filters.spec.ts:69` falló en intento inicial y retry #1 por texto duplicado; pasó recién en retry #2. Suite: 121 passed + 1 flaky en Chromium, más 7 passed global-settings. No decir que todos los casos pasaron sin retries.
- [Issue #636](https://github.com/cadeApp/cadeApp/issues/636) corresponde a **QA/T-407** y figura cerrado aunque el síntoma sigue en este run. **T-426 / #649** es otro hotfix (notificaciones), no el responsable demostrado del caso T-407.
- `approval-policy` del SHA de implementación falló porque aún no había informe de revisión en el cuerpo del PR; es un control de proceso, no un defecto de la fixture. El informe debe incorporarse a la sección requerida y verificarse en el próximo evento.

## Qué queda por hacer

1. Lautaro073 decide cuándo sacar de Draft y mergear #654; **esta revisión no lo hace**. El SHA probado es el de implementación, aunque el commit documental mueva el HEAD.
2. **Después del merge manual de T-428**, integrar `develop` mediante merge (no rebase) en la rama de la [PR #647](https://github.com/cadeApp/cadeApp/pull/647) y exigir su propio gate E2E sobre el nuevo SHA. No tocar `docs/revision-pr/pr-647/**` en esta tarea.
3. Dar seguimiento separado al flaky T-407/#636 sin adjudicárselo a T-428 ni silenciar sus fallos.

**Fuente de verdad de la ficha:** `docs/tasks/T-428.md` fue creada **en esta rama**, no existía en `develop` al revisar; se cotejó contra issue #653 y la fila T-428 añadida al plan en la misma PR.
