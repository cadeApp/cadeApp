# PR #323 — Ronda 4 de revisión independiente — 2026-10-13

**Código y bitácora revisados:** `ce2bf85cacd862ff92863e4cdb943a6f9dacf89b`; **checkpoint temporal:** PR #324 HEAD `13658242a4074ec491d417a3c90f152189f6e463`, combinación exacta de #320 + #323 sobre develop `875f8621`.

## Resultado: CON BLOQUEANTES (1, H01). El E2E conjunto está RED.

- Run [38354080733](https://github.com/cadeApp/cadeApp/actions/runs/38354080733), job `115152873446`: Chromium **63 passed, 8 failed, 1 flaky**, 22,8 minutos, sin timeout del job. `global-settings` NO comenzó porque Chromium terminó con exit 1. Artifact de Playwright **11792439365** fue descargado y analizado independientemente.
- Los 8 fallos: `courier-feed-privacy:27`, `courier-feed-vocabulary:19`, `fixed-price:72/:177/:277`, `main-flow:300`, `map-privacy:438`, `multi-drop:37`. Los ocho terminan esperando una tarjeta `data-testid=request-card` ausente (10 s, retries agotados).
- `courier-private-columns:32` quedó **flaky**: poll Realtime falla y luego pasa con retry. No es estabilidad demostrada.
- Un contexto del artifact muestra el error boundary real `src/app/(courier)/courier/feed/error.tsx`: «No pudimos actualizar las solicitudes abiertas». En `src/features/offers/queries.ts::getAvailableRequests`, cualquier solicitud `published` de la página del feed sin drops o con `drops_count` incoherente puede disparar una excepción SSR que rompe la vista. **Hipótesis:** filas históricas inconsistentes en Develop. **No está confirmada**; también puede fallar la consulta, la autorización o el mapeo. El fix de #320 crea nuevos fixtures coherentes, pero no sanea por sí mismo datos históricos.
- **Verificado GREEN parcial:** `t340-legacy-checkpoint.spec.ts:29` (incluye `waitForURL` de 10s en :71), `main-flow.spec.ts:187` y `:249` pasaron al primer intento.
- La entrada nueva del autor `docs/tasks/log/T-352.md:193–264` declara correctamente el E2E RED. Comprobé contra el artifact sus tres traces `1-trace.network`: POST `/merchant/requests/new` tarda 1740, 1823 y 1943 ms; **0** GET `/merchant/requests` (alias) después; GET `/merchant/dashboard` dura 717, 919 y 486 ms. Es evidencia concreta de eliminar el salto, **no** prueba de ahorro causal global: el baseline es otro spec y Develop tiene carga variable.
- CI técnica del checkpoint: unit, db-tests, typecheck, lint, build, audit, bundle-budget PASS, pero no sustituye el E2E. `approval-policy` rojo de la temporal es irrelevante para merge porque **#324 NUNCA SE MERGEA**.

## Hallazgos

**PR323-H01 (BLOQUEANTE, ABIERTO):** falta el gate Chromium + global-settings completamente verde y falta ejecución del DoD2 del piloto en la combinación. La medición específica de redirección ya existe; el bloqueo principal es el feed. Debe investigarse en #320, sin ocultar errores ni cambiar timeout/test/guards.

**PR323-H02 (MEJORA, CORREGIDA):** el autor separó ahorro inferido de medida real; la comparación de la traza confirmó 0 navegaciones por el alias en los casos observados. No extrapolar ahorro exacto de tiempo total.

## Próximos pasos

1. En #320 investigar primero error real del feed: logs de SSR de Develop *solo lectura y autorizados*, correlación con la solicitud fallida y conteos de `published` sin drops / discrepancia de `drops_count` en la página. No ejecutar mutaciones sobre datos remotos sin autorización, y no debilitar `getAvailableRequests` para ocultar inconsistencia.
2. Si es fallo de fixtures o lógica, demostrar RED auténtico, corregir en la PR responsable y demostrar GREEN incluyendo prueba adversarial que vuelva a introducir la causa. Si son datos históricos, elaborar plan explícito de remediación separado antes de escribir sobre Develop.
3. Rehacer un checkpoint comparable con Chromium **y** global-settings, y obtener evidencia del DoD2 sin subir `waitForURL`. Volver a revisar los HEAD exactos antes de mergear.
4. La temporal #324 se puede cerrar **sin merge** tras registrar su RED. #320 y #323 siguen Draft hasta su revisión final.

**No aprobé ni mergeé.** No se ejecutaron SQL remoto, Docker, ni alteraciones de código/test desde esta revisión.
