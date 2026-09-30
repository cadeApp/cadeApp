# PR #140 — T-009 · Mensajes claros cuando falla el registro

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/140 |
| **Referencia usada por el PR** | T-009 |
| **Autor** | @Lautaro073 |
| **Rama** | `fix/T-009-register-errors` → `develop` |
| **Base de revisión** | `75950cdf2a8a47d5f0642c3caa479c6f364e13bc` |
| **Head de implementación revisado** | `faef9f075b2eb29ba20a22cde2e1d58854d60ea7` |
| **Estado** | bloqueada — ronda 1 · 5 bloqueantes, 2 requieren decisión de Lautaro073 |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `faef9f075b2eb29ba20a22cde2e1d58854d60ea7` | 5 bloqueantes · 2 decisiones | `revisiones/ronda-1.md` |

## Estado por hallazgo

- **PR140-H01** · decisión · `decision-pendiente` · la PR reutiliza T-009 ya cerrada y usa un branch `fix/T-009-*` contra develop sin issue/tarea activos.
- **PR140-H02** · decisión · `decision-pendiente` · convertir la respuesta ofuscada `identities: []` en “ya existe una cuenta” deshace la protección anti-enumeración de Supabase.
- **PR140-H03** · alto · `abierto` · el default de errores de `signUp` convierte fallos operativos/configuración en `VALIDATION_ERROR`.
- **PR140-H04** · medio · `abierto` · el nuevo `catch` del formulario no tiene prueba que haga rechazar `registerAction`.
- **PR140-H05** · medio · `abierto` · no hay entrada de bitácora de esta sesión y la evidencia del body omite el comando global `pnpm test`.

Datos estructurados: `hallazgos.jsonl` · evidencia: `evidencia/comandos.md`.

## CI observado

Sobre `faef9f075b2eb29ba20a22cde2e1d58854d60ea7`:
- typecheck ✅
- lint ✅
- unit / coverage ✅ — 104 archivos, 1396 tests
- db-tests ✅
- build ✅
- bundle-budget ✅
- audit ✅
- board-sync ✅
- approval-policy ❌ únicamente porque el cuerpo todavía no contiene un informe independiente `SIN BLOQUEANTES`.

## Próximo paso

Primero Lautaro073 resuelve H01 y H02. El agy no debe elegir esas decisiones por su cuenta. Después se corrigen H03–H05 bajo el alcance que resulte de H01.
