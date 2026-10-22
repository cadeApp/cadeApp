# PR #188 — T-324 · Estado real de documentos del courier en pantalla de verificación

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/188 |
| **Tarea** | T-324 (Fase 3) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-324-courier-documents-status` → `develop` |
| **SHA funcional revisado R3** | `a3d32c484898a83392d546ad55f95ba9ed3bba6f` |
| **develop actual al cerrar R3** | `163d4ade24c192e79e713b46ca9de4ec0aa02b7d` |
| **Estado** | Sin bloqueantes funcionales · pendiente sync de develop + CI final |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `86328317dd3d31f17a58e1d8a528bcc04ef810ee` | 4 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `c5964452bf1624669e69a56483bb5be4c8562139` | H01–H04 verificados; H05 nuevo | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `a3d32c484898a83392d546ad55f95ba9ed3bba6f` | H05 verificado; 0 hallazgos abiertos | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| PR188-H01 | Falta controlar cableado página → query → StatusView y redirect | alto | arreglado-verificado |
| PR188-H02 | `rejected` no estaba cubierto | medio | arreglado-verificado |
| PR188-H03 | No se resolvía historial del mismo `kind` | alto | arreglado-verificado |
| PR188-H04 | Obligatorios incompletamente enumerados | medio | arreglado-verificado |
| PR188-H05 | DNI parcialmente rechazado se mostraba Pendiente | medio | arreglado-verificado |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

No quedan cambios funcionales de T-324.

Antes del merge:
1. pullear este commit de revisión;
2. mergear `origin/develop` en la rama, sin rebase;
3. confirmar que la sincronización no toca/resuelve manualmente archivos T-324;
4. esperar CI completo verde sobre el nuevo HEAD;
5. pedir comprobación final corta.

Al cerrar R3 la rama estaba **9 commits detrás de develop**. Se compararon esos 9 commits y **no hay solapamiento de archivos con T-324**; por eso no se abre un hallazgo funcional nuevo.

## Decisiones P1 incorporadas

- `rejected` → **Observado**, incluso en DNI parcial cuando el otro lado falta.
- Para filas repetidas del mismo `kind`, manda la más reciente por `uploaded_at`.
- `uploaded_at` solo se usa server-side; al Client Component llegan únicamente `kind` y `status`.

## CI R3 — #859

Sobre `a3d32c484898a83392d546ad55f95ba9ed3bba6f`:
- typecheck ✅
- lint ✅
- unit ✅ **111 files / 1645 tests**
- DB ✅ **13 files / 1621 tests**
- audit ✅
- build ✅
- bundle-budget ✅
- `/courier/onboarding/status`: **175 kB**, dentro del límite de 180 kB.

Las rutas admin y `/design-system` que superan el presupuesto son warnings preexistentes y ajenos a T-324.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). No se propone una regla AG nueva: H05 es una instancia concreta de P06.
