# PR #213 — CC-017 · Zonas activas sin centroide verificado

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/213 |
| **Contract-change correcto** | CC-017 · Issue #189 |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-015-zones-without-centroid-impl` → `develop` |
| **SHA funcional revisado** | `a6cab08fa6aa86762f03f455bc4e67a9919b988e` |
| **Base develop** | `721f6e0b0fcbab466ce97812c2a31694a2fbff88` |
| **Estado** | Draft · CON 1 BLOQUEANTE |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `a6cab08fa6aa86762f03f455bc4e67a9919b988e` | 1 bloqueante + 1 mejora | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR213-H01 | La implementación usa CC-015 aunque #189 fue renumerado a CC-017 | alto | abierto |
| PR213-H02 | pgTAP compara mensajes exactos de PostgreSQL | bajo | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Verificación funcional R1

La lógica de zonas está bien:
- migración elimina únicamente `zones_active_centroid`;
- `zones_centroid_pair` y bounds permanecen;
- RLS continúa habilitada;
- pgTAP nuevo se ejecutó realmente en CI;
- requests conserva creación con distancia null si falta un centroide;
- no se modificó `actions.ts`.

El bloqueo es de identidad/trazabilidad del contrato: CC-015 ya pertenece a #181.

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

Corregir H01 y, aprovechando la misma ronda, H02. No mergear todavía.
