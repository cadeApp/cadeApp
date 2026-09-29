# PR #61 — T-111 · Alta de comercio

|            |                                                                                         |
| ---------- | --------------------------------------------------------------------------------------- |
| **PR**     | https://github.com/cadeApp/cadeApp/pull/61                                              |
| **Tarea**  | T-111 (Fase 1 — Núcleo transaccional y flujos) · Issue #17                              |
| **Autor**  | @asako669 (P2)                                                                          |
| **Rama**   | `feat/T-111-merchant-onboarding` → `develop`                                            |
| **Base**   | `0e8c235` (`origin/develop`)                                                            |
| **Tamaño** | 14 archivos de tarea (+1323 / −4)                                                       |
| **Estado** | 🟢 **SIN BLOQUEANTES** · 9 hallazgos en 2 rondas (9 `arreglado-verificado` `H01`–`H09`) |

## Rondas

| Ronda | SHA revisado                               | Hallazgos                                                   | Informe                                          |
| ----- | ------------------------------------------ | ----------------------------------------------------------- | ------------------------------------------------ |
| 1     | `49642ed4e18a23909587545f04642149ad736f57` | **4 bloqueantes** (`H01`–`H04`) + 5 mejoras (`H05`–`H09`)   | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2     | `efd8d9f8db8337ea48fc97ed79cd2e12b73b4a96` | **0 bloqueantes** · `H01`–`H09` verificados como arreglados | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID        | Título                                                                                      | Sev.     | Estado                         |
| --------- | ------------------------------------------------------------------------------------------- | -------- | ------------------------------ |
| **`H01`** | `server.ts` falta `import 'server-only'` (regla 20)                                         | 🟡 medio | ✅ `arreglado-verificado` (R2) |
| **`H02`** | `actions.ts:19` — doble cast `as unknown as AppSupabaseClient` (equivale a `@ts-ignore`)    | 🟡 medio | ✅ `arreglado-verificado` (R2) |
| **`H03`** | El formulario no usa `useForm` + `zodResolver` (regla 25)                                   | 🟡 medio | ✅ `arreglado-verificado` (R2) |
| **`H04`** | Fallback silencioso `'1.0'` para `pilot_terms_version` en `actions.ts:59-64` (patrón AG-54) | 🟠 alto  | ✅ `arreglado-verificado` (R2) |
| `H05`     | Cinco textos en español hardcodeados en `onboarding-form.tsx` fuera de `copy.ts`            | 🔵 bajo  | ✅ `arreglado-verificado` (R2) |
| `H06`     | Checkbox de términos `h-4 w-4` (16×16 px, < 48px target táctil mínimo)                      | 🔵 bajo  | ✅ `arreglado-verificado` (R2) |
| `H07`     | Valor arbitrario `min-h-[80px]` en textarea (regla 60)                                      | 🔵 bajo  | ✅ `arreglado-verificado` (R2) |
| `H08`     | `accepted_at` generado por `new Date()` del servidor en vez del `DEFAULT` de la base        | 🔵 bajo  | ✅ `arreglado-verificado` (R2) |
| `H09`     | `docs/tasks/log/T-111.md` fuera de formato Prettier                                         | 🔵 bajo  | ✅ `arreglado-verificado` (R2) |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)
