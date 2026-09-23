# PR #61 — T-111 · Alta de comercio

|            |                                                                                |
| ---------- | ------------------------------------------------------------------------------ |
| **PR**     | https://github.com/cadeApp/cadeApp/pull/61                                     |
| **Tarea**  | T-111 (Fase 1 — Núcleo transaccional y flujos) · Issue #17                     |
| **Autor**  | @asako669 (P2)                                                                 |
| **Rama**   | `feat/T-111-merchant-onboarding` → `develop`                                   |
| **Base**   | `origin/develop`                                                               |
| **Tamaño** | 13 archivos (+1048 / −4)                                                       |
| **Estado** | 🔴 **CON BLOQUEANTES (4)** · 9 hallazgos en ronda 1 (4 bloqueantes, 5 mejoras) |

## Rondas

| Ronda | SHA revisado                               | Hallazgos                                                 | Informe                                          |
| ----- | ------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------ |
| 1     | `49642ed4e18a23909587545f04642149ad736f57` | **4 bloqueantes** (`H01`–`H04`) + 5 mejoras (`H05`–`H09`) | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID        | Título                                                                                      | Sev.     | Estado                  |
| --------- | ------------------------------------------------------------------------------------------- | -------- | ----------------------- |
| **`H01`** | `server.ts` falta `import 'server-only'` (regla 20)                                         | 🟡 medio | 🔴 abierto (bloqueante) |
| **`H02`** | `actions.ts:19` — doble cast `as unknown as AppSupabaseClient` (equivale a `@ts-ignore`)    | 🟡 medio | 🔴 abierto (bloqueante) |
| **`H03`** | El formulario no usa `react-hook-form` + `zodResolver` (regla 25)                           | 🟡 medio | 🔴 abierto (bloqueante) |
| **`H04`** | Fallback silencioso `'1.0'` para `pilot_terms_version` en `actions.ts:59-64` (patrón AG-54) | 🟠 alto  | 🔴 abierto (bloqueante) |
| `H05`     | Cinco textos en español hardcodeados en `onboarding-form.tsx` fuera de `copy.ts`            | 🔵 bajo  | 🔴 abierto (mejora)     |
| `H06`     | Checkbox de términos `h-4 w-4` (16×16 px, < 48px target táctil mínimo)                      | 🔵 bajo  | 🔴 abierto (mejora)     |
| `H07`     | Valor arbitrario `min-h-[80px]` en textarea (regla 60)                                      | 🔵 bajo  | 🔴 abierto (mejora)     |
| `H08`     | `accepted_at` generado por `new Date()` del servidor en vez del `DEFAULT` de la base        | 🔵 bajo  | 🔴 abierto (mejora)     |
| `H09`     | `docs/tasks/log/T-111.md` fuera de formato Prettier                                         | 🔵 bajo  | 🔴 abierto (mejora)     |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)
