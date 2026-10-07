# PR #293 — T-347 · ficha de mutaciones RED E2E en runner trusted

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/293 |
| **Tarea** | T-347 · ficha nueva |
| **Autor** | @Lautaro073 |
| **Rama** | `docs/T-347-ficha` → `develop` |
| **Base** | `64dfdf653219c6cf08a223c0df829353d9d9d8f1` |
| **HEAD revisado** | `dfb5fb1cf9db5013a322c11129b97b063a6ded8b` |
| **Estado** | **CON BLOQUEANTE — ronda 1** |

## Ronda 1

La ficha propone un mecanismo correcto en intención, pero su frontera de confianza parte de una premisa incorrecta: `workflow_dispatch` no garantiza que la ejecución use el workflow de la rama por defecto.

Hallazgo abierto: `PR293-H01`.

## Decisiones de Lautaro073

El 2026-10-07 quedaron resueltas las cuatro decisiones de diseño:

- **PR293-A01 / 0-B:** usar `repository_dispatch` con un `event_type` específico y `client_payload { target, mutation }`.
- **PR293-A02 / 1-A:** catálogo de mutaciones versionado y revisado en `develop`; no patches ad hoc.
- **PR293-A03 / 2-A:** build de control y mutante con `next start` solo en `127.0.0.1` dentro del runner; no Vercel Preview.
- **PR293-A04 / 3-A:** validación de punta a punta después del merge; si falla y `board-sync` cerró #289, se reabre.

Las cuatro decisiones quedan en estado `aceptado`.

## CI

Sobre el HEAD funcional revisado:

- CI principal: ✅ completo;
- Vercel: ✅;
- `approval-policy`: ❌ esperado mientras el informe independiente tenga bloqueantes;
- `e2e-preview`: no es evidencia necesaria para cerrar esta ronda documental mientras H01 siga abierto.

## Siguiente paso

Corregir la ficha y la bitácora con las decisiones anteriores. No implementar todavía T-347 en esta PR.

La revisión independiente no aprueba ni mergea la PR.
