# PR #411 — Ronda 3 de revisión independiente · T-369 paso 3/3

**18 de octubre de 2026 · HEAD auditado eaf3689b6b2a5f4cde4587309615b3b041d776fd · SIN BLOQUEANTES de código/integración.** No se aprobó ni mergeó.

## PR411-H01 — arreglado-verificado
Se mantiene T-372: el E2E de deduplicación DNI pasó en el gate completo post-CC-031. Sin cambios al spec respecto del run real.

## PR411-H02 — arreglado-verificado
La rama mergeó origin/develop en 28430433869337b0109678feb008506e4d9e2f98, incluyendo la migración CC-031 y timeout 45 minutos (develop 7a428bde). GitHub compare develop...HEAD da **0 behind / 12 ahead**. Control histórico: HEAD ronda 2 queda 14 commits detrás del develop actual.

**Run E2E realmente ejecutado:** https://github.com/cadeApp/cadeApp/actions/runs/39159260485 — job https://github.com/cadeApp/cadeApp/actions/runs/39159260485/job/117768945794; checkout exacto a91263615730f36c817811f0ac92f56058838409. Chromium **88/88 PASS** (28.5m), global-settings **6/6 PASS** (3.2m), incluidos T-369 3/3: crédito insuficiente → AAL2 acredita → reserva/consumo; vencimiento → reintegro; plan ilimitado sin consumir. Los otros 3 son T-306. También pasó el spec Chromium con piloto activo y el caso DNI T-372.

**Equivalencia exacta:** compare de a91263615730f36c817811f0ac92f56058838409 a HEAD muestra como único archivo `docs/tasks/log/T-369.md`, por dos commits documentales. El revisor comprobó igualdad textual de dos specs T-369, spec T-306 y fixture src/server/e2e/staging-seed.ts entre ambos SHAs, más 14 verificaciones de diff, fuentes y salida del workflow y seis controles negativos en memoria. Son controles estáticos independientes, no Playwright local.

**CI:** https://github.com/cadeApp/cadeApp/actions/runs/39159712911 sobre SHA documental dda9cef: unit 145/145 archivos, 2765/2765 tests PASS; db-tests pgTAP 30 archivos/2815 tests PASS y concurrencia T-369 8/8; typecheck, lint, build, audit, bundle-budget PASS. El CI de HEAD auditado aún estaba pendiente parcialmente al comprobarlo; no se declara verde anticipadamente.

## Estado de gates, limitaciones y mejora
El run posterior https://github.com/cadeApp/cadeApp/actions/runs/39159774744 para SHA documental dda9cef fue CANCELLED y GitHub publicó e2e-preview `error`. **No se declara PASS ese run**: la evidencia verde corresponde al checkout a912636 de código idéntico. El approval-policy aún estaba FAIL por el texto viejo de ronda 2 CON BLOQUEANTES. Actualizar body, no tocar política. **GitHub debe mostrar los required checks válidos antes del merge**; la revisión no autoriza un bypass.

**Riesgo de operación ya observado, no blocker de la funcionalidad T-369 revalidada:** una cancelación abrupta durante `withPilot(false)` puede impedir ejecutar finally y dejar pilot_active=false, afectando a otras PR. Ocurrió una interrupción en https://github.com/cadeApp/cadeApp/actions/runs/39106145856 y luego fallaron gates por piloto apagado. La atribución del último write no está auditada. Lautaro073 lo restauró, y el run verde verificó restauración normal. Timeout 45m mitiga pero no evita SIGKILL; la recuperación externa preservando estado previo debe estudiarse en tarea separada, sin forzar siempre true.

Mejora anterior no bloqueante: si el SELECT de plan creado por UI falla antes del track para cleanup, podría quedar sin registrar el ID. No ocurrió en el run verde; no ampliamos alcance.

**Pendientes posteriores:** mutación e2e-mutation t369-pilot-plan-copy (solo RED_CONFIRMED) DESPUÉS del merge a develop; acta manual de staging DESPUÉS del release develop→staging. No cerrar #356 ni apagar piloto. No se ejecutaron aún.

**Resultado: SIN BLOQUEANTES de revisión.** La PR continúa abierta hasta decisión del autor y gates exigidos.