# PR #60 — T-009 · Auth base

|            |                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------ |
| **PR**     | https://github.com/cadeApp/cadeApp/pull/60                                                                   |
| **Tarea**  | T-009 (Fase 0 — Fundaciones y contratos) · Issue #10                                                         |
| **Autor**  | @asako669 (P2)                                                                                               |
| **Rama**   | `feat/T-009-auth-base` → `develop`                                                                           |
| **Base**   | `d100c3a`                                                                                                    |
| **Tamaño** | 19 archivos de tarea (+1505 / −7)                                                                            |
| **Estado** | 🟢 **SIN BLOQUEANTES** · 8 hallazgos en 2 rondas (7 `arreglado-verificado` `H01`–`H07`, 1 mejora baja `H08`) |

## Rondas

| Ronda | SHA revisado                               | Hallazgos                                                                                    | Informe                                          |
| ----- | ------------------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1     | `b29eca168784ce105f8304b3d325305b130f5c31` | **6 bloqueantes** (`H01`–`H06`) + 1 mejora (`H07`)                                           | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2     | `576d6fe55ccaa1cf6f87e0ed0f47cd0b6186cee7` | **0 bloqueantes** · `H01`–`H07` verificados como arreglados + 1 mejora no bloqueante (`H08`) | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID        | Título                                                                                                                                                                                                   | Sev.       | Estado                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------ |
| **`H01`** | Escalada silenciosa a `role: 'merchant'` cuando `profiles` devuelve `null` o error (`server.ts:61`, `queries.ts:36`, `actions.ts:35`)                                                                    | 🔴 crítico | ✅ `arreglado-verificado` (R2) |
| **`H02`** | `evaluateRouteGuard` e `is*Route`: route groups en URL, default-allow (`isPublicRoute` sin llamar), colisión `/couriers` y `/merchants` de admin con `startsWith`, y bucle en `/login/mfa` (`guards.ts`) | 🟠 alto    | ✅ `arreglado-verificado` (R2) |
| **`H03`** | `updateSession` descarta las cookies rotadas por `@supabase/ssr` al redirigir (`server.ts:68-74`), lee en cascada y tiene **0 % de cobertura** (`0/77` líneas)                                           | 🟠 alto    | ✅ `arreglado-verificado` (R2) |
| **`H04`** | Open Redirect y salto de guarda por rol vía `searchParams.redirectTo` sin validar (`login/page.tsx:8-9`, `login-form.tsx:35-36`)                                                                         | 🟠 alto    | ✅ `arreglado-verificado` (R2) |
| **`H05`** | Tres sleeps fijos (`setTimeout`) en `actions.test.ts:164,194` y `queries.test.ts:38` (prohibidos por Regla 40) y fase roja documentada solo por `Failed to resolve import`                               | 🟡 medio   | ✅ `arreglado-verificado` (R2) |
| **`H06`** | Cinco usos de `text-xs` (12px, Cláusula Anti-12px D16), botón de ojo de `20×20 px` (`< 48px`), tarjetas de rol sin `aria-pressed` y `acceptTerms` validado solo en UI                                    | 🟡 medio   | ✅ `arreglado-verificado` (R2) |
| `H07`     | `guards.ts` y `docs/tasks/log/T-009.md` fuera de formato Prettier, e ítem final del DoD en `docs/tasks/T-009.md:35` en `[ ]`                                                                             | 🔵 bajo    | ✅ `arreglado-verificado` (R2) |
| `H08`     | `resolvePostLoginRedirect` no rechaza barras invertidas (`'\\'`) en `redirectTo` (`guards.ts:99`)                                                                                                        | 🔵 bajo    | 🟡 abierto (mejora)            |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)
