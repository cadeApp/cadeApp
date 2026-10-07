# PR #295 — T-338 · La PWA instalada arranca en /login y no muestra la landing

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/295 |
| **Tarea** | T-338 (Fase 3 · Calidad, operación y salida) |
| **Autor** | @KiraK72 |
| **Rama** | `feat/T-338-pwa-standalone` → `develop` |
| **Base** | `a773c05cc488a1fc60bfb36512cdca35d12d1271` |
| **HEAD funcional revisado** | `6a35d87fb1c02bcdbe7956ca4c37dc47581a6c3a` |
| **Tamaño funcional** | 9 archivos, +353 / -23 |
| **Estado** | **CON BLOQUEANTES (6) — ronda 1** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `6a35d87fb1c02bcdbe7956ca4c37dc47581a6c3a` | **CON BLOQUEANTES (6)** | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR295-H01 | La PR sigue en fase RED y no contiene la implementación productiva del DoD | alto | abierto |
| PR295-H02 | Los tests de navegación prueban helpers aislados, no las cuatro páginas que deben integrarlos | alto | abierto |
| PR295-H03 | La bitácora atribuye el RED a páginas que el test no importa ni renderiza | alto | abierto |
| PR295-H04 | Ningún control obliga a `is-ios.ts` a reutilizar `isStandalone()` | medio | abierto |
| PR295-H05 | El test offline acepta texto plano aunque la ficha exige HTML mínimo inline | medio | abierto |
| PR295-H06 | El E2E verifica solo el estado final y no detecta un flash visible de la landing | medio | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Evidencia: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Corregir primero los controles H02–H06 para que midan el DoD real y demostrar cada mutación RED.
2. Implementar T-338 en los archivos productivos de la ficha, sin dependencias nuevas ni cambios de auth/middleware.
3. Actualizar la bitácora con salidas reales; no atribuir fallos a símbolos que la suite no ejercita.
4. Ejecutar `pnpm typecheck && pnpm lint && pnpm test` y `e2e-preview`.
5. Realizar la verificación manual exigida en un Android real con la PWA instalada antes/después y anotarla en la bitácora.
6. Pedir Ronda 2 sobre el nuevo SHA.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md). Esta ronda refuerza principalmente `P08-control-no-cubre-lo-que-dice` y las lecciones AG-37, AG-63, AG-68 y AG-70; no propone un número AG nuevo.
