# PR #605 — T-403 · Postulantes según A01

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/605 |
| Tarea | T-403 · Fase 4 |
| Autor | @Lautaro073 |
| Rama | `feat/T-403-postulantes-a01` → `develop` |
| SHA de implementación revisado | `5ea4c55a0a3b7e8f7cd875b287f4fa8af725fc6a` |
| Base al revisar | `844bab43491fb30f171b6a72e9ec750a93f40dbc` |
| Diff | 15 archivos · +803/-270 líneas |
| Estado | Ronda 2, **H01 corregido por inspección; sin verificación E2E final**; no aprobar/mergear hasta gates |

## Rondas

| Ronda | SHA revisado | Hallazgos nuevos | Informe |
|---|---|---|---|
| 1 | `159ecd0` | H01 (alto, test-coverage) | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `5ea4c55` | 0 nuevos; H01 corregido sin verificación completa | [ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR605-H01 | E2E no diferencia vehículo de postulación enviada | alto | arreglado-sin-verificar · D01=A aplicado en `5ea4c55` |

- [hallazgos.jsonl](hallazgos.jsonl) conserva el estado estructurado, sin autoverificación.
- [evidencia/comandos.md](evidencia/comandos.md) incluye un control lógico ejecutable y comandos de comprobación; no atribuye RED/GREEN no corridos.
- [lecciones.md](lecciones.md) documenta el patrón y los límites de la revisión.

## Qué falta (ronda 2)

1. La implementación de D01=A ya está presente y pasó la auditoría estructural independiente (ronda 1 RED, ronda 2 GREEN, ablación en memoria RED). No se ejecutó el mutante SQL de CC-044.
2. **CI/E2E del SHA de código `5ea4c55`**: typecheck, lint, build, unit y bundle-budget finalizaron SUCCESS; `db-tests` y `e2e-preview` seguían **in_progress** al registrar esta ronda, por lo que no se certifica GREEN ni se declara la PR apta para merge.
3. Seguimiento **fuera de T-403**: [#606](https://github.com/cadeApp/cadeApp/issues/606), refuerzo del pgTAP CC-044 y mutación real de SQL aislada.
4. Una revisión posterior del **resultado terminado** de [e2e-preview run 41913467285](https://github.com/cadeApp/cadeApp/actions/runs/41913467285) y [CI run 41913324153](https://github.com/cadeApp/cadeApp/actions/runs/41913324153) debe actualizar la verificación antes de merge; no basta con que el autor declare un GREEN.

Decisión de Lautaro073: **D01=A**, resuelta y aplicada. No quedan decisiones abiertas de producto.
