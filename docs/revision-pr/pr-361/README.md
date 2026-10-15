# PR #361 — T-364 · Cancelar desde «Mis solicitudes»

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/361 |
| Tarea | T-364 · Fase 3 |
| Autor | @asako669 |
| Rama | `feat/T-364-cancelar-desde-mis-solicitudes` → `develop` |
| Base al revisar | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| Diff revisado | 2 archivos, +196/-2 |
| Estado | Draft: **con bloqueantes** |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `5d1be4bc129e96a4ba16e493ef355206ee74c44e` | H01–H04 abiertos | [ronda-1.md](revisiones/ronda-1.md) |

## Estado
- **H01** alto — funcionalidad y E2E aún sin implementar.
- **H02** alto — mock de refresh compartido invalida oráculo del caso de error.
- **H03** medio — mock de error usa `error` en vez de `code`.
- **H04** medio — fixture publicada ya vencida contradice comportamiento RPC.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md).

**Próximo paso:** P2 completar implementación y tests; pedir nueva ronda. No mergear aún. La evidencia de autor sigue no reproducida por la revisión.
