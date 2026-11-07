# PR #647 — T-406 · Incidentes y parámetros A05/A04

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/647 |
| **Tarea** | T-406 · issue #487 |
| **Autor / rama** | @Lautaro073 · `feat/T-406-incidentes-pestanas` → `develop` |
| **SHA aceptado de aplicación** | `2629198c017364b707f308257fb399886feed828` |
| **Base develop integrada** | `b0060d51773f65f3f446d9ea9a1be382e8a153f5` |
| **Dictamen final de revisión** | **ACEPTADA: SIN BLOQUEANTES**, apta técnicamente para merge (a decisión de Lautaro073) |

## Rondas

| Ronda | SHA de implementación evaluado | Resultado | Informe |
|---|---|---|---|
| 1 | `abf3f63873f4c8a9a1288d604735c7689708b0de` | H01 bloqueante, D01=C aprobada | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `4fce771d774ccf5837992e228d46f6de4322f6f1` | H01 verificado, D01 implementada; E2E externo rojo | [ronda-2.md](revisiones/ronda-2.md) |
| 3 (aceptación final) | `2629198c017364b707f308257fb399886feed828` | **SIN BLOQUEANTES**, CI+gate `success` | [ronda-3.md](revisiones/ronda-3.md) |

## Hallazgos y decisiones

| ID | Resultado | Verificación |
|---|---|---|
| PR647-H01 | **arreglado-verificado** (R2, revalidado R3) | Un factor MFA; escenario T-406 E2E official PASS en `4fce771d` y `2629198c` |
| PR647-H02 | **arreglado-verificado** (R2, revalidado R3) | Informe completo incorporado al body; `approval-policy` PASS en SHA final |
| D01=C | **implementada y aceptada** | Conteo inicial del layout + endpoint admin+AAL2 + TanStack Query 60 s mientras visible/refetch foco, sin Realtime |

## Evidencia de aceptación en SHA exacto

- CI general: [42347461806](https://github.com/cadeApp/cadeApp/actions/runs/42347461806) — 7 jobs `success`, unit 198 archivos / 3735 pruebas (declaración local del autor corroborada por CI).
- E2E trusted: [42348140310](https://github.com/cadeApp/cadeApp/actions/runs/42348140310) — `checkout ref: 2629198c...`, gate `success`, 122 tests `passed`, **1 flaky** ajeno a T-406, 0 `failed`; global-settings 7 `passed`.
- T-428 hotfix: merge de develop `b0060d51` con corrección de fixture del vehículo activo; `courier-onboarding.spec.ts:1056` pasó **sin retry**. El E2E T-406 `incidents.spec.ts:372` pasó.
- El flaky persistente de Auditoría (`admin-audit-filters.spec.ts:69`) **falló en primer intento y retry #1; pasó en retry #2**. Tiene seguimiento externo en [issue #639](https://github.com/cadeApp/cadeApp/issues/639) y [PR #655 / T-429](https://github.com/cadeApp/cadeApp/pull/655). No se afirma que esté solucionado ni se deshabilitó para aceptar T-406.
- `approval-policy` y `e2e-preview` aparecen `success` asociados al SHA; GitHub informó `mergeable: true`, base actual incluida como padre. No se ejecutó `git merge-tree` localmente.

**Decisión:** la revisión independiente acepta T-406 sin bloqueantes. El flaky QA sigue registrado con responsable de tarea independiente. El acto de pasar de Draft a Ready y **mergear** corresponde exclusivamente a Lautaro073; el revisor no lo hizo.

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md). Esta ronda preserva intactos los informes de las rondas 1 y 2.
