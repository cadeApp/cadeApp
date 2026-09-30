# PR #142 — T-318 · Mensajes claros y seguros cuando falla el registro

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/142 |
| **Tarea declarada** | T-318 · Issue #141 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-318-register-errors` → `develop` |
| **Base de revisión** | `75950cdf2a8a47d5f0642c3caa479c6f364e13bc` |
| **Head de implementación revisado** | `9d34f42841ec9ed9875324e8d81f36dd7234315a` |
| **Estado** | bloqueada — 3 bloqueantes en Ronda 2 de la cadena #140 → #142 |

## Contexto

#142 reemplaza #140 después de las decisiones de Lautaro073:
- 1-A: separar el bug de T-009 y crear T-318.
- 2-A: preservar la protección anti-enumeración de Supabase.

H03, H04 y H05 de #140 quedaron corregidos y verificados sobre este head. H01/H02 de #140 quedan parciales porque la nueva tarea todavía tiene dos problemas de constitución y la anti-enumeración sigue siendo observable.

## Hallazgos propios de #142

- **PR142-H01** · alto · anti-enumeración todavía observable por `ok:true` vs `ok:false`.
- **PR142-H02** · alto · la ficha T-318 no existe en `develop`; se implementó antes de que la tarea fuera oficial.
- **PR142-A01** · alto · `docs/implementation-plan.md` está fuera de los «Archivos permitidos» de la ficha T-318.

## CI exact-head

Sobre `9d34f42841ec9ed9875324e8d81f36dd7234315a`:
- unit ✅ — 104 archivos / 1433 tests
- typecheck ✅
- lint ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅
- board-sync ✅
- approval-policy ❌: falta informe independiente `SIN BLOQUEANTES` (esperado mientras esta ronda esté bloqueada)

## Próximo paso

Primero separar y mergear una PR documental de ficha T-318 desde `develop`, igual que se hizo con T-317 / PR #138. Después sincronizar #142 con el nuevo `develop` y recién entonces corregir PR142-H01.
