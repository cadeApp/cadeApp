# Informe revisar-pr — T-359 · PR #360 · ronda 11

**Fecha:** 2026-10-17. **SHA del autor revisado:** `c6381ff4ee7de88e183c388d29bf0eac8ddb7d21`. **SHA funcional con CI y E2E efectivamente ejecutados:** `082d6bd6d0b72e566532bcaf143467a4b64bbb29`. **Resultado: SIN NUEVOS BLOQUEANTES DE IMPLEMENTACIÓN DETECTADOS POR INSPECCIÓN; R05 RESUELTO Y E2E FUNCIONAL GREEN. NUEVO HEAD DOCUMENTAL PENDIENTE DE COMPLETAR SUS PROPIOS GATES.** No aprobar ni mergear desde esta revisión.

## 1. Alcance y diferencia desde ronda 10

PR #393 mergeada a develop como `293c3a27`; ficha canónica T-359 (leída desde develop) autoriza exclusivamente la aserción de T-366 §5.1 dentro de PR #360. Agy integró develop en merge normal `acff7544`. El commit de implementación `082d6bd6d0b72e566532bcaf143467a4b64bbb29` cambió solamente `e2e/specs/request-states.spec.ts` (1 línea) y `docs/tasks/log/T-359.md`. Después el autor publicó `c6381ff4ee7de88e183c388d29bf0eac8ddb7d21` que cambió únicamente la bitácora con links de CI/E2E. No modificó `docs/revision-pr/pr-360`.

**Corrección exacta:** en T-366 §5.1 se reemplazó `getByRole('button',{name:/aceptar/i}).toBeVisible()` por `getByRole('button',{name:/^aceptar$/i}).toHaveCount(0)`. El test conserva `Expirada`, `Ofertas recibidas`, RPC `accept_offer` con error `REQUEST_EXPIRED` y TODA la secuencia posterior de aislamiento, concurrencia, idempotencia e historial. El componente `RequestOffersList` mantiene la guarda H03 (`published && !isExpired && !isReconciling`) y sus tests unitarios; ningún cambio en UI, tests de T-359, WhatsApp T-361 ni DB. Reconciliación de T-366 coherente con su DoD.

## 2. Evidencia CI y E2E REAL del SHA funcional `082d6bd6d0b72e566532bcaf143467a4b64bbb29`

- [CI run 39014884270](https://github.com/cadeApp/cadeApp/actions/runs/39014884270): unit 138 archivos/2540 tests PASS; 79 workflow y 6 ADR PASS; db-tests 27 archivos/2420 pgTAP PASS (y db-types local), además de typecheck/lint/build/audit/bundle-budget SUCCESS.
- [E2E run 39014931158](https://github.com/cadeApp/cadeApp/actions/runs/39014931158) intento 2, job `117352218062`: **81 Chromium PASS + 1 flaky recuperado, global-settings 3/3 PASS**. T-359 dos sesiones PASS 39.0 s; T-360 feed PASS 50 s; T-366 reconciliación PASS 37.2 s. El reporte final del workflow confirma `TARGET_SHA: 082d6bd6d0b72e566532bcaf143467a4b64bbb29`, aunque el HEAD del repository_dispatch aparece como develop; status `e2e-preview=success` está publicado sobre SHA funcional exacto.
- **Observación no bloqueante de esta PR:** el test T-314 `e2e/specs/map-privacy.spec.ts:503` tuvo HTTP 500 de `/api/live/available-requests` en dos intentos y pasó en el tercero. No se verificó causalidad. Ni el spec ni el endpoint fueron cambiados en T-359. El texto del autor `100% GREEN` debe leerse como conclusión SUCCESS, no como cero flaky; recomendable registrar y estudiar esta inestabilidad por su tarea dueña. No ocultar esta información ni tocar test/timeouts para falsear estabilidad.

## 3. HEAD documental posterior `c6381ff4ee7de88e183c388d29bf0eac8ddb7d21`

El autor actualizó bitácora (+9/-3), sin tocar aplicación ni tests. GitHub informó `mergeable:true` y `approval-policy=success`, unit, typecheck, lint, build, audit y bundle-budget success. **En el instante revisado `db-tests` seguía in_progress y `e2e-preview` pending**; por lo tanto NO puedo declarar todos los gates completos para `c6381ff4ee7de88e183c388d29bf0eac8ddb7d21`, aunque el código ejecutable sea idéntico a `082d6bd6d0b72e566532bcaf143467a4b64bbb29`. La ronda 11 vuelve a mover HEAD con un commit exclusivamente de docs de revisión; comprobar nuevamente gates de la punta final.

## 4. Hallazgos y revisión independiente

- **R05** pasa de `decision-pendiente` a `arreglado-sin-verificar`: decisión C ya está en la ficha de develop y test E2E pasó en SHA funcional. `verificado_en_sha=null` por ausencia de mutaciones de ejecución propias del revisor.
- **H05** pasa de `parcial` a `arreglado-sin-verificar`: el flujo postmatch T-359 completo pasó, con el mismo límite.
- R03/R04 y los demás hallazgos conservan estado: ninguna regresión nueva detectada al revisar el alcance cambiado.
- Controles estáticos propios (sobre fuente GitHub) **6/6 BASE + 4/4 mutantes textuales detectados**, sin modificar source, con harness completo en `evidencia/comandos.md`. **NO son Vitest/Playwright ni mutation runtime independiente**. No se ejecutó pnpm local ni `git merge-tree` desde checkout porque el contenedor no puede resolver github.com para clonar. No se levantó Supabase/Docker local.

## 5. Cierre y pendientes

**No hay decisiones P1 nuevas**: opción C dentro de #360 está cerrada. **Sin nuevos bloqueantes funcionales descubiertos.** Antes de mergear confirmar sobre el HEAD FINAL que estén completos CI, db-tests, E2E y aprobación; no confundir el GREEN del SHA funcional anterior con el commit de bitácora ni el nuevo commit documental de esta revisión. La prueba flaky de T-314 requiere seguimiento en su ámbito y **no se considera regresión demostrada de #360**. Falta una batería independiente de mutaciones runtime para certificar todos los estados históricos como verificados; no afirmar que se hizo. Sólo Lautaro073 puede aprobar/mergear #360.

**No aprobé ni mergeé.**