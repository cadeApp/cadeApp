# PR #206 — T-327 — E2E de Preview por PR con Vercel + Supabase Develop

- **PR:** #206
- **Tarea:** T-327 / issue #205
- **Rama:** `ci/e2e-vercel-preview`
- **Base:** `develop`
- **Ronda actual:** 1
- **SHA funcional revisado:** `def425a082e8b769b9a518feb9f705dae67ade72`
- **Resultado:** **CON BLOQUEANTES (6)**
- **Fecha:** 2026-10-02
- **Revisor:** revisión independiente solicitada por Lautaro073

## Estado

La rama está sincronizada con `develop`:
- ahead: 1
- behind: 0
- merge-base: `163d4ade24c192e79e713b46ca9de4ec0aa02b7d`

CI exacto del SHA funcional:
- run **36974328286 / CI #865** — GREEN
- typecheck ✅
- lint ✅
- build ✅
- audit ✅
- bundle-budget ✅
- Vitest **110/110 archivos, 1627/1627 tests** ✅
- workflow tests **45/45** ✅
- ADR tests **6/6** ✅
- db-tests **13 archivos / 1621 tests / PASS** ✅

El diseño base de `repository_dispatch` está alineado con la documentación oficial de Vercel y el Preview del SHA revisado existe y está READY. No obstante, la ronda encuentra bloqueantes de identidad/scope de tarea, reglas del repo, calidad y configuración de seguridad.

## Decisiones P1 resueltas

Registradas también en issue #205:
- 1-A: desactivar Vercel Authentication solo para Preview.
- 2-A: agregar `SUPABASE_DEVELOP_PROJECT_REF`.
- 3-A: #205 queda abierto hasta un Preview E2E real GREEN posterior al merge de infraestructura.
- 4: la configuración existente es el **Environment secret** `VERCEL_PROJECT_ID`.
- 5-A: se acepta la limitación nativa de concurrency (1 running + 1 pending; una tercera puede reemplazar la pending), con re-run.
- 6-A: T-327 puede actualizar `AGENTS.md`, `.agents/rules/00-confianza-y-seguridad.md` y `e2e/AGENTS.md` solo para reflejar Develop separado.

## Revisiones

- `revisiones/ronda-1.md`
