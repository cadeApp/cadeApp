# PR #76 — T-113 · Mis solicitudes, ofertas en tiempo real y aceptar oferta

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/76 |
| **Tarea** | T-113 (Fase 1: Núcleo transaccional y flujos) |
| **Autor** | @asako669 (P2) |
| **Rama** | `feat/T-113-requests-offers` → `develop` |
| **Base** | `develop` @ `b6b5f39` |
| **Tamaño** | 3 archivos, +455 líneas |
| **Estado** | abierta (Draft) |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `d0470aa` | 6 (5 bloqueantes, 1 mejora) | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | Trabajo principal declarado en la descripción del PR no está commiteado ni presente en la rama | crítico | abierto |
| H02 | `pnpm typecheck` falla con 24 errores de compilación TypeScript | crítico | abierto |
| H03 | Tests de `acceptOfferAction` asumen contrato inventado e inexistente en vez de `src/domain/rpc-contracts.ts` | alto | abierto |
| H04 | `request-offers.test.tsx` asume matchers de `@testing-library/jest-dom` no soportados y omite entorno jsdom | alto | abierto |
| H05 | La suite de pruebas de la tarea está en rojo (`pnpm test` falla) | crítico | abierto |
| H06 | Plantilla del PR incompleta: sección de informe agy sin reporte y checklist del DoD sin tildar | medio | abierto |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md)

## Qué queda por hacer

1. Implementar la Server Action `acceptOfferAction` en `src/features/offers/actions.ts` alineada al contrato real `RPC_CONTRACTS.accept_offer` de `src/domain/rpc-contracts.ts`.
2. Corregir `src/features/offers/actions.test.ts` para que afirme los tipos y códigos de error reales (`INVALID_STATE_TRANSITION`, `status: 'matched'`, `idempotent: boolean`, etc.).
3. Agregar directiva `// @vitest-environment jsdom` en `src/features/requests/components/request-offers.test.tsx` y reemplazar los 16 matchers de jest-dom por aserciones estándar de Vitest (`toBeDefined()`, `not.toBeNull()`, `toContain()`).
4. Implementar los componentes y páginas requeridas (`RequestOffersList`, `/merchant/requests`, `/merchant/requests/[id]`, modal C05, Realtime).
5. Dejar `pnpm typecheck && pnpm lint && pnpm test` en verde.
6. Correr auto-revisión de agy con `revisar-pr`, actualizar bitácora y pegar informe en el PR.

## Para el análisis posterior

Ver [`lecciones.md`](lecciones.md) (lecciones AG-64, AG-65, AG-66). Criterio para llevar algo a `AGENTS.md` en el [README del directorio](../README.md#cuándo-tocar-agentsmd): hace falta que el patrón aparezca en 2+ PRs, salvo severidad crítica.
