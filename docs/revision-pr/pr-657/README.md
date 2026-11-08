# PR #657 — T-408 / CC-047 · Hardening administrativo

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/657 |
| Issue del CC | #656 |
| Tarea bloqueada | T-408 (#495) |
| Autor | @Lautaro073 |
| Rama | `cc/CC-047-admin-hardening` → `develop` |
| Base | `4e700aa2d5f3edb362446675a736903fbb55dd35` |
| Head revisado | `f4878f8814f0002a758545d6e9617ae2da7299b7` |
| Diff inicial | 2 archivos; +232 / -6 líneas; solo documentación |
| Estado ronda 1 | **CON BLOQUEANTES (4)**; decisiones D1=A, D2=B, D3=B confirmadas por Lautaro073 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `f4878f8814f0002a758545d6e9617ae2da7299b7` | 4 abiertos | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Tema | Severidad | Estado |
|---|---|---|---|
| PR657-H01 | Trigger SECURITY DEFINER y current_user (SEC-02) | alto | abierto |
| PR657-H02 | RPC de corrección/revocación y suites CC-031 (SEC-01) | alto | abierto |
| PR657-H03 | rpc_admin.sql fuera del impacto (SEC-11) | alto | abierto |
| PR657-H04 | Backfill sin procedencia suficiente y orden por created_at (SEC-11) | alto | abierto |

Las decisiones de producto ya fueron tomadas por Lautaro073 y figuran en la ronda; los hallazgos quedan abiertos hasta nueva revisión independiente de otro SHA.

Datos: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y comandos: [evidencia/comandos.md](evidencia/comandos.md). Lecciones: [lecciones.md](lecciones.md).

## Siguiente paso

Corregir únicamente `docs/contracts/CC-047.md` y `docs/tasks/T-408.md` en la rama de la PR, actualizar descripción de las suites y DoD. No implementar SQL en este CC. Después, bitácora (si existe dentro de alcance) y siguiente ronda independiente. No aprobar ni mergear todavía.

**Operación humana posterior (D2):** Lautaro073 ejecutará una consulta SQL de solo lectura para listar candidatos en cada ambiente y resolverlos antes de promover T-408. La revisión documental no ejecuta comandos contra bases remotas.
