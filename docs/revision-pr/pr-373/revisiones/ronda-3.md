# Revisión independiente de PR #373 — CC-026 — ronda 3

**HEAD inspeccionado:** `f30193d6c633589390b22276cbc09a3bf7d31d2c`  
**Fecha:** 2026-10-15 · **Base:** `develop` @ `687e2043817340b2951714cb6e7b179be2e3973a`  
**Resultado:** **CON BLOQUEANTES**. PR Draft, el autor aún no pidió revisión final. NO MERGEAR.

## Evidencia y método

- Se inspeccionó el commit de la PR posterior a `ddf6524`: actualizó **7 archivos**, incluyendo migración, pgTAP, harness, cron, mocks y ficha contractual; no modificó `docs/revision-pr/pr-373/**`.
- Se leyó `docs/contracts/CC-026.md` de develop, `AGENTS.md`, lecciones/revisión previas, el código SQL y TypeScript de la PR, workflow `db-tests` actual, y logs CI del HEAD exacto.
- No existe clon local utilizable en este contenedor (GitHub DNS inaccesible). Por regla del proyecto, el revisor **no levantó** Docker/Supabase, no consultó bases remotas ni produjo mutaciones SQL independientes. Se indica expresamente dónde la evidencia es **CI observada** y dónde **inspección**. No marcar hallazgos como verificados mediante una ejecución que no ocurrió.

## H01–H10: contraste

| ID | Situación | Fundamentación |
|---|---|---|
| H01/H02 | Corregidos por inspección; pendiente validación final | ErrorCodes + schemas de respuesta corregidos y nuevos tests verdes en run unit |
| H03 | Parcial | Suite TS ampliada; tests de DB/concurrencia aún sin GREEN integral |
| H04 | Abierto | `docs/master-plan.md` dice `now() > expires_at`; fuente autoritativa SQL y TS vence `<=` |
| H05 | Arreglo implementado, verificación parcial | Migración hace `REVOKE UPDATE` de tabla y `GRANT UPDATE` solo a columnas operativamente editables; 41 pgTAP anteriores a fallo de sintaxis pasan, incluidas negativas de UPDATE; falta run completo |
| H06 | Parcial | Harness usa `ON_ERROR_STOP=1`, detecta ERROR y espera salidas JSON, pero `.github/workflows/ci.yml` aún NO invoca `cc026_reconcile_expired_requests.mjs` |
| H07 | Corregido por inspección | Fixture `clear_requests()` desvincula oferta aceptada y borra ofertas antes del request; la ejecución actual supera aquella FK |
| H08 | Corregido por inspección + unidad | `route.test.ts` mockea RPC cron nueva y asserts GET/POST/argumentos; run unit actual 2347/2347 PASS |
| H09 | Abierto | `src/types/database.types.ts` no se regeneró; `typecheck`/build TS2345 en `sweep.ts:79` |
| H10 | Corregido por inspección + unidad | `runSweep` ahora itera máximo 5 lotes, consume `hasMore`, sale sin spin si batch vacío; los tests ampliados participan de unit |
 
**H05 es una corrección técnica acertada frente a una policy `WITH CHECK` que no congela OLD/NEW**; mantener SQL column grants y probar que no se cortaron updates legítimos. Los cambios de permisos requieren revisar todas las clases de UPDATE (merchant/courier/admin) y compatibilidad con RPC `SECURITY DEFINER` en pgTAP.

## Hallazgos nuevos R3

### PR373-H11 — ALTO · pgTAP aborta y no prueba rollback (BLOQUEANTE)

**`supabase/tests/cc026_reconcile_expired_requests.sql:276,282`**.

La suite intenta `select like(text, text, text)` para comprobar el error forzado en offers y audit. El runner Postgres/pgTAP actual **no tiene esa función**: [CI run #38761492563 / db-tests](https://github.com/cadeApp/cadeApp/actions/runs/38761492563) registra `ERROR: function like(text, unknown, unknown) does not exist` en la **línea 276**, después de **41 subtests correctos**. Es un error del test, no evidencia de que el rollback SQL falló. El archivo aborta antes de verificar los casos 262–310 (rollback, lotes y cron).

**Corrección exacta:** cambiar ambas llamadas `select like(v, 'CC026_FORCED_offers%', ...)` y `like(v, 'CC026_FORCED_audit_log%', ...)` por `select ok(coalesce((v LIKE 'CC026_FORCED_offers%'), false), 'mensaje')` / `ok(coalesce((v LIKE 'CC026_FORCED_audit_log%'), false), 'mensaje')`. `LIKE` es operador SQL, no función pgTAP que podamos asumir. Además de texto de error, afirmar rollback persistido y que la prueba **se pone roja** si se elimina la escritura que debería disparar cada trigger de fallo. No reemplazar con `ok(true)` ni borrar expectativas. **Repetir db-tests**, leer `Files/Tests/Result` y todas las subpruebas, no confundir 41 anteriores PASS con CC-026 completo.

### PR373-H12 — MEDIO · cobertura por ramas insuficiente (BLOQUEANTE CI)

**`src/domain/testing/rpc-fake.ts`, cobertura consolidada**.

El job **unit** del mismo SHA informa **133 archivos y 2.347 tests PASS** pero falla el umbral `src/domain/**/*.ts` para `rpc-fake.ts`: **89,94 %** de branches frente a mínimo **90 %**. La regla prohíbe reducir el threshold, eximir archivo, hacer tests vacíos o cambiar mocks para verde.

**Corrección exacta:** consultar reporte V8 y añadir uno o más tests *que recorran una rama real de CC-026* aún no cubierta, preferentemente en `src/domain/domain.test.ts`: invalidación de output del fake, marca de `hasMore` sin elegibles, estado/actor negativo o frontera de validación no recorrida. Verificar con un mutante semántico que retire guard de `merchantId`, `acceptedOfferId`, rol o tamaño de batch y el test recién añadido caiga por la salida/estado (no por un fallo de import o compilación). Mantener el umbral del repo.

## Gates pendientes del CC — no sustituir por GREEN superficial

1. **H09:** generar `src/types/database.types.ts` con el esquema aplicado en una base local aislada, mediante CLI del proyecto; NO modificar el archivo a mano ni `as any`. `pnpm typecheck` y build deben reconocer ambas RPC. En el commit actual la CI vuelve a reportar `TS2345`.
2. **H06:** incorporar el harness `supabase/tests/integration/cc026_reconcile_expired_requests.mjs` al job `db-tests` **solo tras ampliar alcance/autorizar `.github/workflows/ci.yml`**. El workflow actual invoca exclusivamente harness de T-340 y CC-024. La ampliación es pequeña y técnicamente recomendable: no se puede afirmar una carrera real CI sin ejecutarla. La prueba debe FALLAR con el lock retirado (mutante RED), restaurar el lock y pasar GREEN.
3. **H04:** corregir `docs/master-plan.md` §5.1 para reflejar vencimiento en instante exacto, `now() >= expires_at`, **solo tras ampliar alcance autorizado**. No cambiar la lógica SQL `<=` existente.
4. **CI:** `lint` PASS, `audit` PASS. `typecheck`, `build`, `unit` (coverage), `db-tests` (pgTAP) FAIL; Vercel FAIL. `bundle-budget` SKIPPED, `approval-policy` FAIL; no `e2e-preview` GREEN documentado para HEAD.
5. **T-366:** Encontrado #355 marcado `en-curso` pese a no existir merge de CC ni rollout. La revisión volvió a etiquetarlo `bloqueada` para KiraK72.

## Coordinación — dos decisiones de ALCANCE (🔵, reservar para Lautaro073)

**D1 — activar test de concurrencia real en CI.**
- **A (recomendada):** ampliar CC para `.github/workflows/ci.yml` y ejecutar el harness cc026 junto con T-340 y CC-024 con `DB_CONTAINER`, probar fail-fast y assert de carrera en jobs reales. Mejora duradera: sin runner no hay gate. Riesgo: timing de CI; estabilizar con locks de prueba, no sleeps arbitrarios.
- **B:** mantener el harness como ejecución manual y no incorporarlo a CI. Ventaja mínima de scope, pero deja regresiones de concurrencia sin protección automática, incumple evidencia exigida en CC.
- **C:** crear PR de infraestructura separada que habilite el runner y dependa de ese merge antes de cerrar CC. Mismas garantías a costo de más coordinación; útil si branch protection impide modificar workflow desde este CC.
**Recomendación A** salvo bloqueo de gobernanza, entonces C. No recomendar B.

**D2 — alinear fuente documental del límite.**
- **A (recomendada):** ampliar CC para incluir `docs/master-plan.md` §5.1 y corregir solamente el operador temporal en una frase. Impacto documentacional controlado y consistente con código SQL.
- **B:** PR separado docs; conserva aislamiento pero complica innecesariamente el cierre si el mismo CC ya cambia dominio.
- **C:** conservar documentación contradictoria y añadir una nota en el CC. No recomendable porque hay dos fuentes de verdad distintas.
**Recomendación A**. No tocar código para hacerlo coincidir con `>` desactualizado.

No se recibió una elección explícita en este turno; **ningún archivo fuera de los autorizados fue cambiado por esta revisión**, salvo los entregables `docs/revision-pr/pr-373/**`.

## Próxima ronda

Corregir H11/H12/H09, obtener autorización del alcance H06/H04, ejecutar harness real en CI, asegurar rollback forzado completo y reporte pgTAP íntegro, y volver a correr `typecheck`, `lint`, `unit`, `build` y `db-tests` en un solo HEAD. Un test de falso verde invalida el gate. Después solicitar ronda 4 independiente; **no aprobar, no mergear, no quitar Draft ni desbloquear T-366**.
