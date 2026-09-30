# PR #142 — T-318 · Mensajes claros y seguros cuando falla el registro

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/142 |
| **Tarea** | T-318 · Issue #141 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-318-register-errors` → `develop` |
| **Head R2** | `9d34f42841ec9ed9875324e8d81f36dd7234315a` |
| **Head R3 revisado** | `6947d68ffca5c5510aa0e943355fa1ff33e8bc23` |
| **Base R3** | `develop` @ `158f83b2b1bf6211a2bf8e53ae7cd90130edc445` |
| **Estado** | bloqueada — Ronda 3 · 1 bloqueante |

## Contexto

#142 reemplaza #140 después de las decisiones de Lautaro073:
- 1-A: separar el bug de T-009 y crear T-318.
- 2-A: preservar la protección anti-enumeración de Supabase.

La ficha oficial ya fue mergeada por PR #143 y la implementación está sincronizada con ese `develop`.

## Hallazgos propios de #142

- **PR142-H01** · alto · abierto · el `ActionResult` ya es indistinguible, pero con Confirm Email desactivado el alta nueva conserva una sesión de Supabase y la cuenta existente no; la navegación efectiva puede divergir.
- **PR142-H02** · alto · arreglado-verificado · la ficha T-318 ya está en `develop`.
- **PR142-A01** · alto · arreglado-verificado · ficha y plan salieron del diff de implementación tras mergear #143.

## CI exact-head

Sobre `6947d68ffca5c5510aa0e943355fa1ff33e8bc23`:
- typecheck ✅
- lint ✅
- unit ✅
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅

## Próximo paso

Neutralizar cualquier sesión creada por `signUp` cuando Confirm Email esté desactivado y demostrarlo con RED→GREEN real. No cambiar configuración de Supabase ni contratos de dominio.
