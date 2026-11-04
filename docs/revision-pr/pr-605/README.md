# PR #605 — T-403 · Postulantes según A01

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/605 |
| Tarea | T-403 · Fase 4 |
| Autor | @Lautaro073 |
| Rama | `feat/T-403-postulantes-a01` → `develop` |
| SHA de código corregido | `5ea4c55a0a3b7e8f7cd875b287f4fa8af725fc6a` |
| SHA exacto con E2E GREEN | `7e52b87a2673ffbacfbd544f3c191b463ebe3c62` |
| Base al revisar | `844bab43491fb30f171b6a72e9ec750a93f40dbc` |
| Diff | 15 archivos · +803/-270 líneas |
| Estado | **Revisión cerrada: SIN BLOQUEANTES / ACEPTADA para integración** (sin aprobar ni mergear automáticamente) |

## Rondas

| Ronda | SHA revisado | Hallazgos nuevos | Informe |
|---|---|---|---|
| 1 | `159ecd0` | H01 (alto, test-coverage) | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `5ea4c55` | 0 nuevos; H01 corregido sin verificación completa | [ronda-2.md](revisiones/ronda-2.md) |
| 3 · cierre | `7e52b87` | 0 nuevos; H01 verificado mediante E2E trusted GREEN | [ronda-3.md](revisiones/ronda-3.md) |

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR605-H01 | E2E no diferencia vehículo de postulación enviada | alto | **arreglado-verificado** · E2E GREEN en `7e52b87` |

- [hallazgos.jsonl](hallazgos.jsonl) conserva el estado estructurado, sin autoverificación.
- [evidencia/comandos.md](evidencia/comandos.md) incluye un control lógico ejecutable y comandos de comprobación; no atribuye RED/GREEN no corridos.
- [lecciones.md](lecciones.md) documenta el patrón y los límites de la revisión.

## Cierre independiente — ronda 3 (2026-11-04)

**RESULTADO: SIN BLOQUEANTES. REVISIÓN ACEPTADA** para integración desde el punto de vista técnico, **sin ejecutar APPROVE, quitar Draft ni merge**.

- H01 de R1 quedó implementado en `5ea4c55` y **verificado** en el HEAD exacto `7e52b87`.
- [Trusted E2E run 41915482723](https://github.com/cadeApp/cadeApp/actions/runs/41915482723): **success**, checkout exacto `7e52b87`; `e2e/specs/admin-applicants-search.spec.ts` PASS en el primer intento (28,0 s); **114 passed + 1 flaky ajeno a T-403** (seguro PDF T-376 pasó al primer reintento), más 6 tests `global-settings` passed.
- [CI run 41913324153](https://github.com/cadeApp/cadeApp/actions/runs/41913324153) sobre SHA de código `5ea4c55`: typecheck, lint, build, unit (3532/3532), db-tests (3396/3396 + db types), audit y bundle-budget SUCCESS. Advertencia advisory de bundle: `/admin/applicants 264 kB` vs 180 kB, no imputable a esta corrección.
- `5ea4c55...7e52b87` cambia **solo documentación de revisión**; el gate E2E corrió contra este último SHA. Un commit posterior que actualice exclusivamente esta carpeta **no altera el código ya verificado** y no necesita repetir E2E por ello.
- Seguimiento **no bloqueante fuera de T-403**: [issue #606](https://github.com/cadeApp/cadeApp/issues/606), mutación SQL aislada y refuerzo pgTAP CC-044. La mutación SQL no se ejecutó y no se declara RED.
- No quedan decisiones abiertas. D01=A resuelta. El mantenimiento del flaky T-376 corresponde al dueño de esa suite, no a T-403.

El [informe final](revisiones/ronda-3.md) y la [evidencia](evidencia/comandos.md) contienen el detalle verificable.
