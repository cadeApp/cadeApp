# Revisión independiente — PR #318 / T-340 — Ronda 2 (Gate 0)

**Fecha:** 2026-10-11. **SHA de implementación revisado:** `9c5e797cec93a8e621c0faf3f7b3feef869d7c85`. Base `develop` `267e9810f99343f2511473d76dddd4e5da740847` (`behind=0`). **PR sigue Draft.**

## Dictamen

**CON BLOQUEANTES (1: PR318-H02, cierre documental + RED no registrado).** **H01 se verificó y se cierra:** la prueba REAL del cliente legacy ahora está ejecutada en Supabase Develop mediante GitHub Actions y pasa. No hay defectos de código nuevos acreditados en el spec ni se tocaron los lectores. **No habilitar aún el paso 2 hasta completar la evidencia exigida por la ficha y actualizar la bitácora.**

## Qué cambió desde R1

Desde el último commit de la revisión `1948c6cb` el autor cambió **solo**:
- `e2e/specs/t340-legacy-checkpoint.spec.ts` (nuevo, 217 líneas, autorizado expresamente en la ficha con la decisión opción A).
- `docs/tasks/log/T-340.md` (sesión `2026-10-11 19:10`, +28 líneas).

No se cambió `docs/revision-pr/pr-318/**`, SQL, funciones productivas, lectores, frontend, secretos, fixtures globales ni workflows. Se mantiene `develop` al día y se conservó el Draft.

## H01 — ARREGLADO-VERIFICADO: cuatro oráculos del checkpoint posmerge

**Prueba:** `e2e/specs/t340-legacy-checkpoint.spec.ts:29–216`, con `stagingContext` aislado y `assertAllowedE2EEnvironment()`. Lectura independiente del test, comprobación adversarial de 18 propiedades en fuente exacta y **log real del job que lo ejecuta**.

| Requisito CC-022 §10 | Evidencia real observada |
|---|---|
| 1 drop por UI vieja | UI `/requests/new` → botón `submitRequestButton`; request hallado por nota `testRunId`, `status=published`, `drops_count=1`, exactamente un `delivery_request_drops` (position=1, cash, needs_change) y un `drop_contacts` con nota y cambio `5000`. |
| Reintento sin duplicar | `merchantClient.rpc('publish_request')` sobre request ya publicado exige **`INVALID_STATE_TRANSITION`** (contrato productivo), `drops_count=1`, exactamente una fila child y mismo UUID de drop. |
| Lectura post-match autorizada | Oferta efímera creada y rastreada; `merchantClient.rpc('accept_offer')` retorna éxito; parent `matched` con `accepted_offer_id` esperado; `courierClient.rpc('get_trip_details')` (no service-role) devuelve `requestId`, `deliveryNotes=notesMarker`, `cashChangeAmount=5000`, `status=matched`. |
| Legacy intacto | Después de match: `delivery_requests.notes=notesMarker` y `cash_change_amount=5000`; `delivery_request_drop_contacts` conserva las mismas copias; sin tocar writer ni limpieza de paso 3. |

**CI exacto:** GitHub Actions `e2e-preview` run **`38178339003`**, job **`114585413997`**, checkout `HEAD is now at 9c5e797`, línea literal:

```text
✓  63 [chromium] › e2e/specs/t340-legacy-checkpoint.spec.ts:29:7 › T-340 Gate 0 ... (21.9s)
71 passed (14.9m)
3 passed (1.0m)
```

Se verificó que `Run preview E2E gate` y reporte de status son `success`; status `e2e-preview` de SHA `9c5e797` = **success**. La fixture general limpia en `finally`, y la oferta creada en el nuevo test se registra con `trackEntityForCleanup`. El paso de limpieza terminó en un job verde; no se hizo una consulta independiente posterior a DB sobre posibles residuos, por lo que no se afirma «cero registros» más allá del teardown ejecutado.

**CI base exacto:** run `38178270092`, unit/lint/typecheck/build/audit/bundle-budget ✅; `db-tests` ✅ **Files=21, Tests=1980, Result: PASS**, H08 8/8, H14 3/3, H15 RED→GREEN del **paso 1** y tipos sin drift. `approval-policy` ❌ (no corresponde suplantar la aprobación humana en una PR Draft).

**Control independiente EN MEMORIA:** 18 marcadores contractuales/actores con baseline presente; cinco mutaciones sobre llamadas y aserciones del nuevo spec detectadas por script publicado en `evidencia/comandos.md`. **Esto no constituye una corrida RED de Playwright**. No se ejecutó localmente Docker/Supabase, no se hizo mutation SQL real ni se dispararon workflows manuales.

## H02 — ALTO (nuevo) — Gate 0 GREEN en CI, pero la bitácora no documenta cierre ni el RED solicitado

**Archivo:** `docs/tasks/log/T-340.md`, sesión `2026-10-11 19:10 — asako669`; **ficha desde develop:** `docs/tasks/T-340.md:207` («RED de cada prueba nueva demostrado por el comportamiento que falta y anotado en la bitácora»), CC-022 §10. **Origen:** agente (registro quedó desactualizado después de CI).

El texto de la bitácora termina en **«Falta: Push ... ejecución ... GREEN de e2e-preview ... inicio lectores»**, pero el test ya fue pusheado y obtuvo GREEN real en Actions. **No se documentó la ejecución, SHA, job y resultado del nuevo spec ni una prueba adversarial RED→GREEN específica del E2E Gate 0.** El control SQL RED→GREEN H15 de la anterior PR #317 no es RED de este nuevo spec.

**Corrección mínima acotada, sin tocar producción ni la prueba que pasó:**
1. Registrar en `docs/tasks/log/T-340.md` una sesión posterior a las 19:10 con **SHA `9c5e797`**, URL de run **`38178339003`**, job **`114585413997`**, spec/título, duración 21.9 s, `71 passed` chromium + `3 passed` global-settings, los cuatro oráculos y límites de cleanup; anotar explícitamente `Gate 0 funcional GREEN validado` **solo sobre ese SHA**, sin afirmar que ya se implementaron lectores.
2. Resolver requisito RED propio del nuevo test **sin modificar Supabase Develop**. El control estructural de cinco mutantes en memoria de esta revisión ya demuestra que el archivo contiene aserciones sensibles a cambios, pero **no es RED runtime de Playwright**. La salida RED real puede obtenerse ejecutando, con mecanismo seguro/acotado, el MISMO spec del cliente real con un oráculo perturbado (p. ej. expectativa temporal `cashChangeAmount=6000` frente a 5000), verificando que falla por la aserción específica y luego restaurando la expectativa y volviendo a correr GREEN. Si ello requiere modificar el SHA de la PR o dispara automáticamente E2E compartidos, evitar degradaciones prolongadas y restaurar vía commit nuevo normal, no force-push/amend. Identificar ambas corridas y tiempos en bitácora; rotularlo **«RED adversarial de aserción, no mutación productiva»**, tal como adelantó la R1. **No** alterar funciones, RPCs, RLS ni migraciones de Supabase Develop compartido. Si no es viable o no es proporcional, documentar exactamente qué se hizo y qué falta, **sin inventar RED**.
3. Mientras el RED solicitado no esté sustentado y la bitácora no cierre formalmente Gate 0, **no empezar a migrar lectores**. No hay que crear más archivos ni cambiar contratos para registrar el verde que YA existe.

**Mejora no bloqueante:** evitar en futuras sesiones la bitácora «pendiente de push» cuando el push ya se produjo; registrar corrida sobre SHA exacto antes de alegar gate cerrado. Es documentación operativa, no regresión funcional.

## Informe revisar-pr

Informe revisar-pr — T-340 / PR #318 — 2026-10-11 — revisión independiente — ronda 2

**Resultado: CON BLOQUEANTES (1, H02 exclusivamente evidencia y bitácora; H01 corregido y verificado).**

Checks locales del revisor: typecheck n.e. · lint n.e. · test n.e. · test:db n.e. · E2E local n.e.  
**CI real del SHA:** unit/lint/typecheck/build/audit/bundle ✅; db-tests ✅ 1.980; E2E Preview ✅ 71+3 con checkpoint `t340-legacy-checkpoint.spec.ts` específico ejecutado; approval-policy ❌ mientras PR Draft.

**BLOQUEANTES:** PR318-H02 `docs/tasks/log/T-340.md`: falta incorporar resultado real del Gate 0 que ya pasó y evidencia RED del nuevo E2E conforme la ficha. **No hay defecto de código del nuevo spec demostrado.**

**DECISIONES:** no hay decisiones de producto pendientes. Opción A se cumplió según lo autorizado.  
**No revisado:** lectores del paso 2 (aún inexistentes), autorización de merge y checkpoint postmerge del paso 2. No aprobar ni mergear; PR Draft hasta cierre documental y avance de implementación.
