# PR #47 — T-000 · Scaffold mínimo de Next.js App Router y fronteras de arquitectura

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/47 |
| **Tarea** | T-000 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 (código generado por agente) |
| **Rama** | `feat/T-000-scaffold` → `develop` |
| **Base** | `42fd11f` |
| **Tamaño** | 40 archivos, +6620 líneas |
| **Estado** | Abierta · **16/16 defectos cerrados**; solo queda la decisión H14 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `f71d858` | 15 | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `d026834` | 11 arreglados, 3 parciales, 1 decisión, **1 regresión nueva** | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | árbol de trabajo | R01 cerrado, **R02 nuevo**: el lint falla | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `4abf24a` | **Todo cerrado y verificado**; R02 nunca se commiteó | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | `publicEnv` lanza en el navegador | 🔴 | ✅ arreglado |
| H02 | Comentario antes de `'use client'` desactiva la regla | 🟠 | ✅ arreglado |
| H03 | `font-size:14px` invierte la cláusula Anti-12px | 🟠 | ✅ arreglado |
| H04 | Test de `server-only` tautológico | 🟠 | ✅ arreglado |
| H05 | Denylist vs allowlist de paquetes | 🟠 | ✅ arreglado |
| H06 | Regla ignora `export * from` | 🟡 | ✅ arreglado |
| H07 | `includes('/server')` falso positivo | 🟡 | ✅ arreglado |
| H08 | `entry-point` incompleto | 🟡 | ✅ arreglado |
| H09 | `feature`→`server` sin restricción | 🟡 | ✅ arreglado |
| H10 | `middleware.ts` no se lintea | 🟡 | ✅ arreglado |
| H11 | Server Actions inalcanzables | 🟡 | ✅ arreglado |
| H12 | `queryKey` fijo | 🟡 | ✅ arreglado |
| H13 | `maximumScale:1` bloquea el zoom | 🟡 | ✅ arreglado |
| H14 | `middleware.ts` no vacío | 🔵 | 🔵 decisión pendiente |
| H15 | Rangos caret | 🔵 | ✅ arreglado |
| **R01** | **Regresión:** `overrides` desactiva la denylist en features | 🔴 | ✅ arreglado (ronda 3) |
| **R02** | **Regresión:** partir el elemento `feature` rompe los imports intra-feature | 🟠 | ✅ nunca se commiteó |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos reproducibles: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

Solo **H14**: decisión de @Lautaro073 sobre si `middleware.ts` debe quedar vacío como pide la ficha T-000, o si se acepta el desvío y se registra en la aprobación. No hay trabajo técnico pendiente.

## Para el análisis posterior

Lo aprendido está en [`lecciones.md`](lecciones.md): 14 lecciones candidatas (`AG-01` … `AG-14`), con las tres de mayor impacto señaladas.

El dato más interesante de esta PR: **los 16 hallazgos convivieron con los cuatro checks en verde**. En 11 casos el check era literalmente cierto pero sobre un subconjunto que no incluía el defecto. Ese es el hilo del que conviene tirar para `AGENTS.md`.

> ⚠️ T-000 es una tarea atípica (scaffolding puro, casi todo configuración de controles), así que conviene contrastar sus patrones con 2 o 3 PRs de feature antes de dar reglas por buenas. Criterio en el [README del directorio](../README.md#cuándo-tocar-agentsmd).
