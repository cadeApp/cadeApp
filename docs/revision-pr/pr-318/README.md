# PR #318 — T-340 · Paso 2/4 — Lectores multi-drop

**PR:** https://github.com/cadeApp/cadeApp/pull/318 · **Rama:** `feat/T-340-lectores` → `develop`  
**Estado:** 🟢 **Gate 0 verificado (H01+H02 cerrados en ronda 3)**. 🟡 **La PR completa sigue Draft: lectores del paso 2 todavía no implementados; NO MERGEAR.**

## Rondas independientes

| Ronda | SHA de autor revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `4e70e934` | Gate 0 no ejecutado, H01 | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `9c5e797` | E2E funcional GREEN real; falta RED y documentación, H02 | [Ronda 2](revisiones/ronda-2.md) |
| **3** | **`e61fab67`** | **✅ H01+H02 ARREGLADOS-VERIFICADOS. Gate 0 cerrado.** | **[Ronda 3](revisiones/ronda-3.md)** |

## Gate 0 — Evidencia final

1. **Publicación UI legacy de 1 drop, reintento y conservación de campos**: E2E específico `e2e/specs/t340-legacy-checkpoint.spec.ts` pasó realmente en Supabase Develop.
2. **RED adversarial real, no SQL:** SHA auténtico `4c4f26d6c2f1817f1cb51da280b163276ef2a8eb`, run `38181178771`, job `114593911361`: Playwright falló en línea 192 con `Expected 6000, Received 5000` (1 failed, 70 passed).
3. **Restauración GREEN:** SHA auténtico `c83c5e887611159526c8ee2c3df9517428e5b5d7`, run `38183724823`, job `114601542342`: spec PASS 23.7 s, **71 Chromium + 3 global-settings PASS**.
4. **R3 auditado:** SHA `e61fab67` tiene exactamente los mismos bytes del spec restaurado; la diferencia desde el SHA GREEN son solo sesiones de bitácora. Los dos SHA completos incorrectos del registro fueron corregidos directamente por el revisor en `4caad04a` (sin alterar los E2E).
5. **Proceso:** se encontró PR Ready sin lectores; el revisor **la devolvió a Draft**. Se actualizó el estado inicial del body de la PR para reflejar Gate 0 ya demostrado.

### Estado acumulado

| Hallazgo | Estado |
|---|---|
| PR318-H01 — E2E de cliente legacy en Develop | ✅ Arreglado-verificado R2 |
| PR318-H02 — RED real propio + cierre documental | ✅ Arreglado-verificado R3 |

**No hay nuevos defectos de Gate 0. No hay aún lectores implementados.** Próxima acción técnica: asako669 debe **seguir el body original de esta misma PR** e implementar exclusivamente los lectores de paso 2 (feed/ofertas/live, trip, historial, admin, WhatsApp), tests de privacidad progresiva para 1 y N drops, E2E y RED→GREEN. No modificar pasos 3–4, esquema/migración ya aplicada ni carpeta de revisión.

[Hallazgos](hallazgos.jsonl) · [Evidencia y probes](evidencia/comandos.md) · [Lecciones](lecciones.md).

**CI / límite del revisor:** RED/GREEN respaldados por **dos runs reales** y comparación exacta de código; sin SQL productivo mutado ni DB/Docker local. Check status del HEAD documental cambia después de cada commit; revalidar cuando la etapa 2 esté lista. Sin aprobar ni mergear.
