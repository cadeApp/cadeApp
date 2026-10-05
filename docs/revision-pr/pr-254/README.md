# PR #254 — T-302 · E2E de onboarding del repartidor, aprobación con MFA y DNI duplicado

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/254 |
| **Tarea** | T-302 (Fase 3) |
| **Autor** | @asako669 |
| **Rama** | `feat/T-302-courier-onboarding-e2e` → `develop` |
| **Base revisada** | `ba3ade599b4dd5aed39f9720ad5a256cf26efb82` |
| **Head revisado** | `32477a05841ca669ac9ac7a36f929f2261e4c926` |
| **Tamaño original de la ronda** | 2 archivos, +524 / -0 |
| **Estado** | bloqueada |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `32477a05841ca669ac9ac7a36f929f2261e4c926` | 4 bloqueantes | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR254-H01 | La prueba DoD de DNI no ejecuta la deduplicación de producción | alta | abierto |
| PR254-H02 | Los flujos UI tienen escapes que permiten verde sin interacción obligatoria | alta | abierto |
| PR254-H03 | El courier del fixture ya llega aprobado y con onboarding completo | alta | abierto |
| PR254-H04 | El MFA se eleva en otra sesión y la RPC directa oculta el fallo del navegador | alta | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Corregir los cuatro bloqueantes únicamente en el spec y actualizar la bitácora.
2. Demostrar RED/verde con mutaciones reales sobre las propiedades corregidas; no sustituir el flujo por consultas/RPC directas.
3. Ejecutar `pnpm typecheck && pnpm lint && pnpm test` y el E2E de T-302 contra el Preview.
4. Pedir una nueva ronda independiente. Los estados `verificado_en_sha` quedan exclusivamente para la revisión.

## Para el análisis posterior

Esta ronda no propone AG nueva: repite P04/P08 y la lección de enumerar la clase completa. Ver [`lecciones.md`](lecciones.md).