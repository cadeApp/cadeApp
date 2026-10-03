# PR #224 — T-308 · E2E de incidentes y suspensión cautelar

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/224 |
| **Tarea** | T-308 · Issue #40 |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-308-incidents-e2e` → `develop` |
| **SHA funcional revisado** | `9c2a5f3447f0b8e3c4c215cda0846088e75b8507` |
| **Base del autor** | `125728b591950f0de2ecd520eea2617415ac9508` |
| **develop al revisar** | `20db1bdbfd44f5a398dbfa984cc8ea291a56a493` |
| **Estado** | Draft · CON 4 BLOQUEANTES · behind=49 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `9c2a5f3447f0b8e3c4c215cda0846088e75b8507` | 4 bloqueantes + rama 49 commits detrás | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Hallazgos

| ID | Sev. | Estado | Resumen |
|---|---:|---|---|
| PR224-H01 | alto | abierto · bloqueante | El helper E2E intenta crear un auth user con `role: 'admin'`, que `handle_new_user` rechaza con `INVALID_SIGNUP_ROLE`. |
| PR224-H02 | alto | abierto · bloqueante | DoD 1 construye una solicitud `matched` sin `accepted_offer_id`; `get_trip_details` la rechaza antes de renderizar el botón de reporte. |
| PR224-H03 | medio | abierto · bloqueante | DoD 1 llama `LoginPage.login()`, que espera salir de todo `/login/*`, y luego pretende continuar en `/login/mfa`; el helper no puede retornar en ese punto. |
| PR224-H04 | alto | abierto · bloqueante | La bitácora no contiene RED reproducible por prueba ni un GREEN E2E; `playwright --list` solo demuestra discovery. |

## Precondición de la próxima ronda

La rama está **49 commits detrás de `develop`**. Entre esos commits cambiaron la infraestructura E2E, fixtures, workflows y `src/server/e2e/staging-seed.ts`. Antes de corregir los hallazgos hay que:

```bash
git pull
git fetch origin
git merge origin/develop
```

Sin rebase, force-push ni amend. Si hubiera conflicto en `docs/tasks/T-308.md`, gana la versión de `origin/develop`.

## Alcance

El diff funcional del SHA revisado toca únicamente:

```text
docs/tasks/log/T-308.md
e2e/specs/incidents.spec.ts
```

Ambos están autorizados por T-308. La ficha no fue modificada.

## Estado de CI

No se usó el color del CI para cerrar esta ronda: hay bloqueantes estáticos previos. La bitácora del autor registra typecheck/lint/verificadores y `playwright --list`, pero no una ejecución E2E verde del flujo. Conforme al procedimiento de revisión, el CI completo se inspeccionará cuando la ronda esté técnicamente en condiciones de aprobar.

**No mergear todavía.**
