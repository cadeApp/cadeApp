# PR #213 — CC-017 · Zonas activas sin centroide verificado

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/213 |
| **Contract-change correcto** | CC-017 · Issue #189 |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-015-zones-without-centroid-impl` → `develop` |
| **SHA funcional revisado** | `a6cab08fa6aa86762f03f455bc4e67a9919b988e` |
| **Base develop** | `721f6e0b0fcbab466ce97812c2a31694a2fbff88` |
| **Estado** | SIN BLOQUEANTES · listo para sincronización final con develop |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `a6cab08fa6aa86762f03f455bc4e67a9919b988e` | 2 bloqueantes + 1 mejora | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR213-H01 | La implementación usa CC-015 aunque #189 fue renumerado a CC-017 | alto | arreglado-verificado |
| PR213-H02 | pgTAP compara mensajes exactos de PostgreSQL | bajo | arreglado-verificado |
| PR213-H03 | M1/M2 de DB exigidas por el contrato no se demostraron en rojo | medio | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Verificación funcional R1

La lógica de zonas está bien:
- migración elimina únicamente `zones_active_centroid`;
- `zones_centroid_pair` y bounds permanecen;
- RLS continúa habilitada;
- pgTAP nuevo se ejecutó realmente en CI;
- requests conserva creación con distancia null si falta un centroide;
- no se modificó `actions.ts`.

Los bloqueos pendientes son la identidad/trazabilidad del contrato y la evidencia RED de las mutaciones DB M1/M2.

## CI

Run #917:
- typecheck ✅
- lint ✅
- unit ✅ 113 files / 1682 tests
- DB ✅ 15 files / 1660 tests
- audit ✅
- build ✅
- bundle-budget ✅

`e2e-preview` figura bloqueado por diseño: `BLOCKED / REQUIRES DEVELOP MIGRATION`, porque esta PR agrega una migración y Supabase Develop solo la recibe después del merge.

## Próximo paso

Corregir H01, demostrar H03 y, aprovechando la misma ronda, resolver H02. No mergear todavía.


## Ronda 2 — cierre

- CC-015 histórico restaurado exactamente desde PR #181.
- Contrato de zonas separado como CC-017 / #189.
- T-326 depende de CC-017 / PR #213 y sigue bloqueada hasta merge.
- H02 resuelto: `throws_ok` mantiene SQLSTATE y usa `null::text`.
- M1 RED: run #928 / `37052789350`.
- M2 RED: run #931 / `37069932109`.
- HEAD restaurado GREEN: run #932 / `37070408547`.
- Unit: **113 files / 1682 tests PASS**.
- DB: **15 files / 1660 tests PASS**.

Al cerrar R2, develop avanzó 4 commits sin solapamiento con archivos de esta PR. Solo resta sincronización mecánica y CI final sobre el árbol combinado.
