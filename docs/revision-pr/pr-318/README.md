# PR #318 — T-340 · Paso 2/4 — Lectores multi-drop

**PR:** https://github.com/cadeApp/cadeApp/pull/318 · **PR dueño:** Lautaro073; ejecución agy asako669.  
**Rama:** `feat/T-340-lectores` → `develop`. **Estado: DRAFT, 1 bloqueo de evidencia/documentación (H02). NO MERGEAR.**

## Rondas independientes

| Ronda | SHA de implementación verificado | Resultado | Informe |
|---|---|---|---|
| 1 | `4e70e934` | H01: Gate 0 sin E2E funcional | [Ronda 1](revisiones/ronda-1.md) |
| **2** | **`9c5e797`** | ✅ H01 cierre técnico de Gate 0; 🔴 H02 falta RED y bitácora de cierre | **[Ronda 2](revisiones/ronda-2.md)** |

## Verificación en Ronda 2

**H01 ARREGLADO-VERIFICADO:** opción A implementada en `e2e/specs/t340-legacy-checkpoint.spec.ts` (217 líneas). El test usa **UI legacy real contra Preview + Supabase Develop**, reintenta `publish_request`, realiza match por actor autorizado, valida `get_trip_details` y columnas legacy intactas **sobre el mismo requestId**. GitHub Actions run `38178339003`, job `114585413997`, en SHA `9c5e797`: prueba exacta ejecutada **PASS en 21.9 s**; suite completa **71 chromium + 3 global-settings PASS**. Status `e2e-preview` publicado GREEN para SHA exacto.

**CI general SHA exacto:** run `38178270092`, `db-tests` 21 archivos/1.980 tests PASS, H08 8/8, H14 3/3 y mutaciones H15 del paso 1; demás técnicos PASS. `approval-policy` FAIL en PR Draft.

**H02 — ABIERTO (bloqueo documental y de cobertura negativa):** última sesión `docs/tasks/log/T-340.md` 19:10 todavía dice que falta el push/corrida E2E, cuando ya se ejecutó, y no registra **RED→GREEN adversarial específico del nuevo spec** exigido por `docs/tasks/T-340.md` DoD. El RED SQL de la PR #317 no sustituye el del Gate 0. Autor: actualizar bitácora con links, SHA, 4 invariantes y resultado, obtener/documentar RED adversarial seguro o declarar el límite real sin inventar ejecución.

**No hay defectos de los lectores del paso 2 demostrados:** todavía NO se implementaron. Mantener PR Draft hasta registrar el checkpoint y empezar el paso 2 autorizado. No tocar cleanup legacy del paso 3 ni UI escritora del paso 4. La opción A ya está autorizada; **sin nuevas decisiones de negocio**.

[Hallazgos](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).

**Limitaciones del revisor:** comprobación directa de CI + inspección de fuente + mutaciones adversariales **en memoria** (no Playwright RED ejecutado por el revisor). Sin Docker/Supabase local. No aprobación ni merge.
