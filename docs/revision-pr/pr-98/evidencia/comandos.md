# Comandos reproducibles — PR #98

## Ronda 6 — SHA 293284d

### H08

`step-indicator.tsx`: `isDone ? 'text-primary-dark' : ...`

`axe-report.json`: 9 superficies, `violationsCount = 0` e `incompleteCount = 0` en todas.

### H13/H14

Fake stateful:
```text
store = Map(profile_id:document:version -> row)
insert(existing key) -> 23505
upsert(existing key, ignoreDuplicates=true) -> no-op, conserva accepted_at
```

Los tests inicializan filas preexistentes y esperan action ok + accepted_at original intacto. Una regresión productiva `upsert -> insert` usa el mismo `fake.insert` y rompe esas expectativas.

### CI

Run `36212781987`:
```text
lint          success
unit          success
db-tests      success
build         success
typecheck     success
audit         success
bundle-budget success
```

Unit: 54/54 files, 593/593 tests; workflow 21/21; ADR 6/6.

DB: Files=9, Tests=1472, Result=PASS; tipos generados exitosamente.

Bundle: `/design-system` 184 kB sobre límite; rutas T-311 OK; job success con warning no bloqueante.