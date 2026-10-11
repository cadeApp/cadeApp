# Revisión independiente — PR #318 / T-340 — Ronda 3

**Fecha:** 2026-10-11 · **SHA de implementación y bitácora revisado antes de corrección documental:** `e61fab677bb581272ee6ab541e3ce1f0c14d1ab2` · `feat/T-340-lectores` → `develop` (`behind=0`).  
**Dictamen del Gate 0: ✅ SIN BLOQUEANTES. H01 y H02 cerrados y verificados.**  
**Dictamen de la PR completa (paso 2/4): TODAVÍA NO ESTÁ LISTA PARA MERGEAR:** no hay lectores del paso 2 implementados. Mantenerla Draft y continuar implementación.

## Alcance realmente inspeccionado

Desde la ronda 2 el autor agregó **tres commits**: un cambio adversarial transitorio de la aserción de monto, su restauración, y sesiones en `docs/tasks/log/T-340.md`. El diff actual contra `develop` tiene **un solo spec nuevo** `e2e/specs/t340-legacy-checkpoint.spec.ts` más ficha autorizada, bitácora y la carpeta de revisión; **no incluye cambios de lectores, contratos funcionales, migraciones SQL, secretos o workflows**. La ficha con autorización opción A permanece acotada al Gate 0.

La PR fue encontrada con `draft=false` aunque en su body y en la ficha se declara que **no puede ponerse Ready for review hasta implementar los lectores**. Se convirtió nuevamente a **Draft** mediante la herramienta de GitHub (solo metadata, sin cambios de código). Además, se corrigieron directamente dos SHA completos inexactos en la bitácora (corrección literal de documentación, sin modificar resultados de prueba) y se actualizaron dos checks del body que continuaban mostrando el gate como pendiente. Estas son **correcciones administrativas mínimas hechas por el revisor**, no una aprobación del trabajo de lectores.

## PR318-H02 — ARREGLADO-VERIFICADO: RED→GREEN real del E2E y cierre de la bitácora

**RED adversarial EN PLAYWRIGHT real, sin modificar SQL ni funciones productivas en Supabase Develop:**
- **Commit real:** `4c4f26d6c2f1817f1cb51da280b163276ef2a8eb`.
- **Acción:** en `e2e/specs/t340-legacy-checkpoint.spec.ts:192`, reemplazo temporal **único** `expect(trip?.cashChangeAmount).toBe(CHANGE_AMOUNT)` → `toBe(CHANGE_AMOUNT + 1000)`.
- **CI:** `e2e-preview` run **`38181178771`**, job **`114593911361`**. El checkout del job muestra `HEAD is now at 4c4f26d`. Playwright ejecutó **ese mismo spec**, que falló a las ~23:01 UTC tras pasar los pasos previos. Se observaron **tres fallos consistentes** (intento inicial y dos retries) exclusivamente en el mismo oráculo:
```text
Error: expect(received).toBe(expected)
Expected: 6000
Received: 5000
> 192 | expect(trip?.cashChangeAmount).toBe(CHANGE_AMOUNT + 1000)
1 failed; 70 passed (15.4m)
```
Esto es **una mutación de EXPECTATIVA del test**, no evidencia de que una mutación productiva de la RPC sea detectada. No se etiqueta falsamente como RED de SQL productivo.

**Restauración y GREEN real:**
- **Commit real:** `c83c5e887611159526c8ee2c3df9517428e5b5d7`.
- La comparación independiente entre los bytes de ambos archivos detectó **exactamente una línea** distinta, la aserción en línea 192; el spec restaurado es **idéntico** al spec del SHA de implementación inspeccionado `e61fab677bb581272ee6ab541e3ce1f0c14d1ab2`.
- **CI:** `e2e-preview` run **`38183724823`**, job **`114601542342`**. El checkout muestra `HEAD is now at c83c5e8`. Línea literal:
```text
✓  63 [chromium] › e2e/specs/t340-legacy-checkpoint.spec.ts:29:7 › T-340 Gate 0 ... (23.7s)
71 passed (14.7m)
3 passed (58.5s)
```
- El test del SHA restaurado pasó contra el Preview conectado a Supabase Develop y la ejecución reportó los cuatro oráculos previamente documentados (UI legacy, reintento, post-match, columnas legacy). No se pidió credenciales ni se intervino la base directamente por el revisor.
- **Bitácora:** sesiones `2026-10-11 19:40`, `20:15` y `20:35`: registran el GREEN del Gate 0 inicial, el RED específico con enlace y el GREEN tras restaurar. Se corrigieron solo los dos **SHA completos** escritos erróneamente por el agente: los originales no eran resolubles, aunque los prefijos cortos y los enlaces a jobs sí eran correctos. La evidencia ya contiene los hashes auténticos.

**Conclusión H02:** no queda deuda de aceptación de Gate 0. Su RED es **adversarial de aserción** tal como pidió expresamente la ronda 2; no se demuestra mutación de SQL productivo, ni se afirma haberla ejecutado.

## H01 sigue cerrado

`e2e/specs/t340-legacy-checkpoint.spec.ts` continúa probando los cuatro invariantes de **CC-022 §10** sobre **la misma solicitud**:
1. Publicación de 1 drop desde UI anterior, materialización correcta de drop+contactos.
2. Reintento `publish_request` con `INVALID_STATE_TRANSITION`, ningún drop duplicado, mismo UUID.
3. Oferta aceptada por comercio y `get_trip_details` llamado como courier legitimado, con notas y monto 5000 exactos.
4. No pérdida de `notes` y `cash_change_amount` legacy después del match.

El autor no tocó ese test fuera de la mutación/restauración de una línea, y las corridas RED/GREEN lo hicieron pasar por los pasos 1–3 antes de la aserción alterada.

## Checks, comprobación independiente y limitaciones

- **GREEN restaurado:** `CI` run `38183659433` (aprobado según bitácora y runs), `e2e-preview` run `38183724823` job `114601542342` PASS (71 Chromium + 3 global-settings). `db-tests` en el ciclo original `9c5e797`: Files=21, Tests=1980, Result PASS, H08 8/8 y H14 3/3. Nuevas corridas CI por commits documentales no son prueba de nuevos cambios de implementación.
- **HEAD original inspeccionado R3:** `e61fab677bb581272ee6ab541e3ce1f0c14d1ab2`, CI run `38184897947` con jobs técnicos verdes al consultarlo; `e2e-preview` del mismo HEAD estaba **PENDING** (run `38184957758`). El **GREEN demostrado de Gate 0** corresponde específicamente a `c83c5e887611159526c8ee2c3df9517428e5b5d7`, y el spec es byte-idéntico en HEAD R3. Los commits posteriores son solo bitácora/revisión.
- **Inspección independiente:** se recuperaron de GitHub las versiones de spec RED, GREEN y HEAD exactos; se compararon texto y línea mutada; se leyeron **ambos logs de GitHub Actions** con error `Expected: 6000 / Received: 5000` y corrida restaurada PASS. Además, control adversarial estructural independiente reproducible en `evidencia/comandos.md`. No se ejecutaron tests locales, no se levantó Docker ni se contactó Supabase remoto.
- **`approval-policy` rojo** mientras Lautaro073 no emita aprobación vigente (no alterar ni saltar). **No aplica todavía:** la PR no tiene implementación de lectores.

## Entregas de etapa siguientes — TODAVÍA PENDIENTES

**Gate 0 habilita comenzar la implementación** en esta PR **#318**: feed, ofertas/live, `get_trip_details`, viaje, historial, administración y «Avisar a mi cliente» según CC-022 §10 y el body de la PR. Debe preservar privacidad progresiva, compatibilidad de 1 drop y fixtures de N drops, sin limpiar legacy (paso 3) ni habilitar escritor multi-drop (paso 4).

**NO DECLARAR PR #318 LISTA PARA MERGE NI READY FOR REVIEW** por haber cerrado el gate. Después del desarrollo se exigirán sus pruebas RED→GREEN, CI/E2E exact SHA y **nueva ronda independiente**.

## Informe revisar-pr

Informe revisar-pr — T-340 / PR #318 — 2026-10-11 — revisión independiente, ronda 3

**Resultado: ✅ Gate 0 SIN BLOQUEANTES (H01 y H02 verificados); ❌ PR #318 NO LISTA PARA MERGE (faltan lectores completos de paso 2).**

Checks propios locales: typecheck n.e. · lint n.e. · test n.e. · E2E local n.e.  
**RED real:** `4c4f26d6`, E2E `38181178771`, aserción específica Expected 6000/Received 5000.  
**GREEN real:** `c83c5e88`, E2E `38183724823`, spec Gate 0 PASS + 71/3 PASS.  
**Hallazgos H01/H02 cerrados.** Sin hallazgos de código adicionales en el Gate 0. La PR permanece Draft.

**Acciones mínimas del revisor:** corregidos SHA completos de bitácora; PR convertida de nuevo a Draft; body actualizado para no anunciar checkpoint pendiente cuando pasó.  
**No revisado:** futuros cambios de lectores, pruebas específicas de paso 2, checkpoint de salida, merge y pasos 3–4.  
**Sin nuevas decisiones de producto. No aprobar ni mergear.**
