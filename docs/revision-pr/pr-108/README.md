# PR #108 — CC-010 · Primitivas shadcn Table, Tabs e InputOTP

> ❌ **Ronda 1: CON BLOQUEANTES · 2 bloqueantes, 1 mejora**

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/108 |
| **Tarea** | CC-010 (contract-change) |
| **Autor** | @Lautaro073 |
| **Rama** | `cc/CC-010-admin-shadcn-primitives` → `develop` |
| **Base** | `develop@366a2b859be586278bff9245b3f1ce1d1b6533ec` |
| **SHA revisado** | `e16864d6f3e56a49929e603e4afe5f2e5387c9a3` |
| **Tamaño** | 10 archivos · +520, -1 líneas |
| **Estado** | abierta / en revisión |

## Rondas

| Ronda | SHA revisado | Hallazgos | Resultado | Informe |
|---|---|---|---|---|
| 1 | `e16864d6f3e56a49929e603e4afe5f2e5387c9a3` | 2 bloqueantes, 1 mejora | CON BLOQUEANTES | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Cat. | Estado |
|---|---|---|---|---|
| PR108-H01 | Uso del operador non-null assertion `!` en InputOTPSlot viola AGENTS.md §4 | alto | conventions | abierto (bloqueante) |
| PR108-H02 | TableFooter y TableCaption de CC-010 no son importados ni probados en ui-system.test.tsx | medio | test-coverage | abierto (bloqueante) |
| PR108-H03 | La prueba de TabsTrigger no afirma las clases visuales de activación data-[state=active] | medio | test-coverage | abierto (mejora) |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos y mutaciones: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. **H01**: Reemplazar `inputOTPContext.slots[index]!` en `src/ui/input-otp.tsx:40` por desestructuración segura con fallback (`const slot = inputOTPContext.slots[index]; const char = slot?.char; ...`), eliminando el non-null assertion prohibido por `AGENTS.md §4`.
2. **H02**: Importar y renderizar `TableFooter` y `TableCaption` en `src/ui/ui-system.test.tsx`, garantizando que el contrato esté 100% cubierto y matando las mutaciones M01, M08 y M09.
3. **H03**: Afirmar la presencia de clases de activación visual (`data-[state=active]:bg-background`) en `TabsTrigger` en `src/ui/ui-system.test.tsx`, matando la mutación M07.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md) (`AG-108`).
