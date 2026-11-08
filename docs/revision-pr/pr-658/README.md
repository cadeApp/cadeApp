# PR #658 — T-408 · Endurecimiento administrativo CC-047

| Dato | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/658 |
| Tarea | T-408 · Fase 4 · CC-047 mergeado en #657 |
| Autor | @Lautaro073 |
| Rama | `feat/T-408-admin-hardening` → `develop` |
| Base de contraste | `fd86f9b2a25b39607e2719e76ad1821f84f44eef` |
| SHA funcional revisado | `3a396ee1258b39c6c6e111f157399fccdb8ae42f` |
| Head inicial de la ronda | `1f0cbc4d3678aa158f92f7822558ae46e0499751` (solo bitácora) |
| Diff observado | 18 archivos, +834/-24 antes del commit de revisión |
| Estado R1 | **CON BLOQUEANTES (6), sin aprobación ni merge** |

## Rondas

| Ronda | SHA de código | Resultado | Informe |
|---|---|---|---|
| 1 | `3a396ee1` | 6 hallazgos abiertos · decisiones D01=B y D02=A resueltas | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Severidad | Síntesis | Estado |
|---|---|---|---|
| PR658-H01 | medio | Denegar SELECT de `rate_limits` según decisión D01=B | abierto |
| PR658-H02 | alto | Control de catálogo de policies de escritura admin | abierto |
| PR658-H03 | alto | SEC-03: INSERT/UPDATE/DELETE en Storage sin prueba directa | abierto |
| PR658-H04 | alto | D1: concurrencia no detecta supresión de `FOR UPDATE` | abierto |
| PR658-H05 | medio | D3: cobertura incompleta por actor, AAL y columna | abierto |
| PR658-H06 | medio | SEC-11: escenarios insuficientes y control de no-backfill | abierto |

## Decisiones P1 recibidas

- **D01=B:** reemplazar `rate_limits_select_admin` por `FOR SELECT TO authenticated USING (false)`; medir cero filas con `aal1` y `aal2` y una RPC de rate limit real.
- **D02=A:** aceptar la ampliación de la ficha a `cc043` y concurrencias `cc025`/`cc033`, porque restaura los contratos probados sin debilitar las aserciones.
- Los casos `cc047` 13–16 no son sensores de la policy: los triggers `trg_lock_draft_drops` y `trg_lock_draft_drop_contacts` de T-340 bloquean escrituras de quien no es comercio dueño en borrador. Usar control de catálogo, no fabricar RED funcional.
- Una sentencia de limpieza de notas en la migración ocurre antes del fixture pgTAP: tres escenarios de RPC y **inspección de SQL de migración** por separado, sin afirmar mutación DB RED inexistente.

## Evidencia y estado operativo

- CI RED sin migración: [42438514865](https://github.com/cadeApp/cadeApp/actions/runs/42438514865) — 48/66 fallos.
- CI GREEN del SHA revisado: [42439999763](https://github.com/cadeApp/cadeApp/actions/runs/42439999763) — `db-tests` 44 archivos / 3651 tests PASS; Vitest 199 archivos / 3755 tests PASS.
- Mutaciones **del autor, no del revisor**: [42440751262](https://github.com/cadeApp/cadeApp/actions/runs/42440751262) — `cc047` 18/67 fallos y `rpc_admin` 1/111 fallo.
- Cuatro controles **estáticos independientes**: original GREEN; mutaciones propias detectadas en RED. No prueban RLS en PostgreSQL. Harness completo en [evidencia/comandos.md](evidencia/comandos.md).
- `e2e-preview`: BLOCKED / REQUIRES DEVELOP MIGRATION previsto en runbook; E2E remoto pendiente en staging tras migración. `develop` no dispone de E2E post-merge automático según runbook.

## Próximos pasos

El autor debe realizar solo los seis arreglos acotados, preservar la bitácora y aportar mutaciones RED→GREEN legítimas. La revisión independiente realizará ronda 2 sobre el nuevo SHA. Antes de promover cada ambiente, Lautaro073 revisa manualmente los candidatos de `merchants.notes` con la consulta de CC-047; no se exponen notas en logs ni se promueve con candidatos pendientes.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [lecciones.md](lecciones.md).