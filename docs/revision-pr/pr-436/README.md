# PR #436 — CC-033 / T-376 · Alta posterior de documentos opcionales

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/436 |
| Contrato | CC-033, issue #434 |
| Tarea futura | T-376, issue #435 |
| Autor | @Lautaro073 |
| Rama | `cc/CC-033-courier-optional-documents` → `develop` |
| Base revisada | `54bbdcd7b079fa208e970725efa66832a8fac724` |
| SHA revisado | `639ea6dc74ad87a27fb533dfd460d21e72f7dcc8` |
| Alcance original | 3 documentos, +261/-0; sin código ni SQL |
| Estado | **CON BLOQUEANTES (3)**; PR Draft; no apta para merge hasta corrección y segunda ronda |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `639ea6dc74ad87a27fb533dfd460d21e72f7dcc8` | 3 bloqueantes documentales (H01–H03) | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Severidad | Motivo | Estado |
|---|---|---|---|
| PR436-H01 | alto | Falta bloquear carga posterior mientras `vehicle_type IS NULL` | abierto; decisión A tomada por Lautaro073 |
| PR436-H02 | medio | El contrato no exige pruebas reales de carrera con sesiones simultáneas en la implementación | abierto |
| PR436-H03 | medio | Rollback no ordena retirar UI antes de retirar RPC | abierto |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y comandos: [evidencia/comandos.md](evidencia/comandos.md). Lecciones: [lecciones.md](lecciones.md).

## Alcance de esta ronda

**Solo revisión documental y lectura estática de código.** La PR no implementa la RPC. No se exigieron ni ejecutaron `e2e-preview`, `db-tests`, `pnpm test:db`, Docker o Supabase local. El autor declaró `pnpm vitest run tools/verify-fichas.test.ts` (7/7) y `git diff --check` limpio, no reproducidos por el revisor en un checkout local. No atribuir GREEN de CI ni pruebas de concurrencia a esta ronda.

La ficha `docs/tasks/T-376.md` se crea en esta misma PR y **no existe en develop**, por lo que se comparó su contenido de la rama contra el plan en develop, en vez de afirmar que fue leída desde develop.

## Próximo paso

El autor hace `git pull` del commit de la revisión y corrige **solo** `docs/contracts/CC-033.md`, `docs/tasks/T-376.md` y la fila T-376 de `docs/implementation-plan.md`; sin tocar `docs/revision-pr/**`. Registra la decisión A, los requisitos de las pruebas futuras y el orden de rollback; corre únicamente verificaciones documentales y publica commit + push. La revisión independiente abre ronda 2 sobre el nuevo SHA.

**Sin aprobación y sin merge en ronda 1.**
