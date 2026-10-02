# PR #188 — T-324 · Estado real de documentos del courier en pantalla de verificación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/188 |
| **Tarea** | T-324 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-324-courier-documents-status` → `develop` |
| **SHA funcional revisado R2** | `c5964452bf1624669e69a56483bb5be4c8562139` |
| **Base develop R2** | `db2cf1709178383ea027e984e1a6783ee74766fa` |
| **Estado** | Draft · CON 1 BLOQUEANTE |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `86328317dd3d31f17a58e1d8a528bcc04ef810ee` | 4 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `c5964452bf1624669e69a56483bb5be4c8562139` | H01–H04 verificados; H05 nuevo | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR188-H01 | Falta controlar cableado página → query → StatusView y redirect | alto | arreglado-verificado |
| PR188-H02 | `rejected` no estaba cubierto | medio | arreglado-verificado |
| PR188-H03 | No se resolvía historial del mismo `kind` | alto | arreglado-verificado |
| PR188-H04 | Obligatorios incompletamente enumerados | medio | arreglado-verificado |
| PR188-H05 | DNI parcialmente rechazado se muestra como Pendiente en vez de Observado | medio | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Corregir únicamente PR188-H05.
2. Agregar RED para `dni_front rejected + dni_back ausente` y la combinación inversa.
3. Repetir targeted + typecheck/lint/test.
4. Pedir Ronda 3.
5. **No mergear todavía.**

## Decisiones P1 vigentes

- Todo documento con `status = rejected` debe representarse como **Observado**; no como `Listo` ni como simple ausencia.
- Si existen varias filas del mismo `kind`, manda la más reciente por `uploaded_at`.
- `uploaded_at` queda server-side; al Client Component solo llegan `kind` y `status`.

## CI R2

CI #853:
- typecheck ✅
- lint ✅
- unit ✅ **111 files / 1642 tests**
- DB ✅ **13 files / 1621 tests**
- audit ✅
- build: primer intento falló en `next/font` fuera del diff; rerun del mismo job ✅
- bundle-budget ✅

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). H05 refuerza P06: al agrupar dos documentos en una fila visual, hay que enumerar precedencias de estado además de presencia/ausencia.
