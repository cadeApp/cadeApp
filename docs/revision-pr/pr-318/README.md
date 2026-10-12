# PR #318 — T-340 · Paso 2/4 — Lectores multi-drop

**PR:** https://github.com/cadeApp/cadeApp/pull/318 · **Rama:** `feat/T-340-lectores` → `develop`. **Draft; CON BLOQUEANTES de lectores Paso 2; NO MERGEAR.**

**Autorización Lautaro073:** R4 A: `get_trip_details` con `drops[]` y scalars legacy de salida desde `drops[0]`, sin columnas legacy DB. R5 A: dos fixtures históricos (`cc008_trip_details.sql` y `cc023_private_columns.sql`) ajustables solo en preparación de datos, asserts intactos. Ninguna decisión nueva en R6.

## Rondas independientes

| Ronda | SHA código auditado | Resultado | Informe |
|---|---|---|---|
| 1 | `4e70e934` | Gate 0 sin verificación E2E | [R1](revisiones/ronda-1.md) |
| 2 | `9c5e797` | Gate 0 GREEN, faltaba RED | [R2](revisiones/ronda-2.md) |
| 3 | `e61fab67` | Gate 0 H01/H02 cerrados | [R3](revisiones/ronda-3.md) |
| 4 | `c7cab174` | 7 bloqueantes de lectores | [R4](revisiones/ronda-4.md) |
| 5 | `58811a30` | H03/H08 cerrados, H04–H07 parciales, H09 abierto, H10 nuevo | [R5](revisiones/ronda-5.md) |
| **6** | **`5a6daeed`** (fix mínimo revisor `c1ac1cfa`) | **✅ H04/H07 verificados con CI, H05/H06 parciales, H09 abierto, H10 sin verificación completa; CON BLOQUEANTES** | **[R6](revisiones/ronda-6.md)** |

## R6 — evidencia y próximos pasos

- **H01/H02/H03/H04/H07/H08:** arreglado-verificado. **DB CI del fix mínimo** `c1ac1cfa`: `db-tests` job `114967582555` **21 files / 1995 tests / PASS**. El revisor solo ajustó `plan(90)`→`plan(92)` en `t340_multi_drop.sql`; no tocó assertions. `unit` job `114967582574`: **128 test files, 2092 tests PASS**, cobertura fake 95.32/91.35 (threshold 90).
- **H05 PARCIAL:** feed/live correctos para N y parent nullable, pero aún inventan 1 drop a partir del padre si falta child de solicitud published `drops_count=1`. Debe fail-closed o demostrar caso histórico legítimo probado.
- **H06 PARCIAL BLOQUEANTE:** `src/features/requests/queries.ts` y UI de historial/listas/detalle solo leen destino y paquete de parent (nullable), sustituyen null por `'chico'`/`'cash'`, no leen ni representan 3 drops.
- **H09 ABIERTO BLOQUEANTE:** Playwright E2E permite falso verde ante HTTP fallido (`if(liveRes.ok())`), no exige request+3 drops en API, no valida error del courier ajeno, y no tiene run post-migración. Status `e2e-preview` está `BLOCKED / REQUIRES DEVELOP MIGRATION` por workflow previo al merge: no inventar PASS ni lanzar migración manual.
- **H10 ARREGLADO-SIN-VERIFICAR:** botón/cableado per-drop existe, pero tests nuevos solo cubren la View con callbacks falsos, no dispatch del Container a server actions reales mediante spies.

**Checks SHA `c1ac1cfa`:** typecheck/lint/build/unit/audit/bundle-budget/db-tests ✅, `approval-policy` ❌; `e2e-preview` no acreditado por backend remoto sin migración. **No hay autorización para merge sin completar H06/H09 y cerrar el gate previsto.**

**Flujo:** Asako termina Paso 2 en esta PR Draft y pide ronda 7 → autorización de Lautaro073 + merge/despliegue/checkpoint Develop cuando corresponda → Kira hace Pasos 3/4 y 4/4 en PR distintas, secuenciales.

[Hallazgos JSONL](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).
