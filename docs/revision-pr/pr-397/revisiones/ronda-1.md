# PR #397 — T-369 (DB/RPC, paso 1/3) · revisión independiente, ronda 1

**SHA efectivamente inspeccionado:** `c1264541e03b741e33729d3126c0db33701872a6` (rama `feat/T-369-db-rpc`, base `develop` original `c4dd91883b4b1e0990bd0e02f468133995402a1a`). **Fecha:** 2026-10-17.
**Resultado:** CON BLOQUEANTES (5) y 1 mejora. **No apta para merge.** No se aprobaron ni se mergearon cambios.

## Decisiones expresas de Lautaro073 (resueltas antes de escribir esta ronda)

- **D397-1-A:** la concurrencia T-369 se valida con **sesiones PostgreSQL reales** dentro de `db-tests` automatizado. Autoriza ampliar la ficha solo con las dos rutas estrictamente necesarias: `.github/workflows/ci.yml` y `supabase/tests/integration/t369_publication_credits_concurrency.mjs`; mantener checks y umbrales, no editar `.agents/**`.
- **D397-2-A:** la **primera compra siempre consume** el beneficio de lanzamiento, incluso con porcentaje inicial **0 %**. Ajustes y cortesías no consumen ese beneficio; compras siguientes jamás lo reciben otra vez. Registrar primera compra al 0 % de forma auditable, evitar saldo ficticio.

## Bloqueantes verificados por inspección

### PR397-H01 — Falta carrera real multisesión del libro y reserva
**ALTO** · `supabase/tests/t369_publication_credits.sql:1150` · test-coverage / P08-control-no-cubre-lo-que-dice.

**Causa:** El DoD exige N publicaciones simultáneas y orden de locks, pero pgTAP ejecuta una sesión y el job db-tests solo ejecuta concurrencia heredada (T-340/CC-025/CC-026), ninguna T-369.

**Evidencia:** supabase/tests/t369_publication_credits.sql:1150 valida ledger_consistent secuencial; .github/workflows/ci.yml:198-222 lista runners sin t369; el body reconoce pendiente.

**Corrección exigida:** Decisión humana 1-A: habilitar en ficha la excepción concreta para supabase/tests/integration/t369_publication_credits_concurrency.mjs y .github/workflows/ci.yml; añadir test N sesiones PostgreSQL en db-tests con barreras reales y mutación RED de guarda de merchant, sin sleeps ni mocks del SQL.

**Estado:** `abierto` (código sin corregir en SHA inspeccionado); no se ejecutó reproduccion runtime de este defecto. La condición se debe confirmar en RED y GREEN durante el arreglo.

### PR397-H02 — Idempotencia compara solo parte del payload; ignora la nota
**ALTO** · `supabase/migrations/20261017090000_t369_publication_credits.sql:1767` · correctness / P06-enumeracion-incompleta.

**Causa:** La equivalencia del reintento omite p_note en admin_grant_publication_credits y admin_register_plan_period; al usar una clave idéntica con nueva nota confirma la operación vieja como idempotente en lugar de IDEMPOTENCY_CONFLICT.

**Evidencia:** SQL:1765-1769 y :1858-1862; fake: src/domain/testing/rpc-fake.ts (ramas de ambas RPC); src/domain/rpc-contracts.ts:811,827 valida y transporta note; CC-029 §RPC exige mismo payload.

**Corrección exigida:** Normalizar nota con nullif(btrim(coalesce(p_note,'')),''); confrontar contra note persistida en lot/período en ambas RPC y fake. Añadir pgTAP y vitest de misma clave con nota distinta, clave igual+misma nota sí idempotente; mutar eliminación de esa comparación y probar RED.

**Estado:** `abierto` (código sin corregir en SHA inspeccionado); no se ejecutó reproduccion runtime de este defecto. La condición se debe confirmar en RED y GREEN durante el arreglo.

### PR397-H03 — Cambiar gracia global puede solapar el legacy con un plan ya programado
**ALTO** · `supabase/migrations/20261017090000_t369_publication_credits.sql:1506` · correctness / P06-enumeracion-incompleta.

**Causa:** El plan se agenda con la gracia vigente al alta; admin_update_setting cambia subscription_grace_days sin comprobar períodos agendados y el derecho legacy se evalúa dinámicamente. Una ampliación posterior crea solapamiento (o reducción crea hueco).

**Evidencia:** SQL:285-301 calcula fin legacy por setting actual, :1603-1615 protege solo admin_set_subscription, :1483-1543 actualiza subscription_grace_days sin comprobar solapes, :1895-1901 agenda plan al fin legacy.

**Corrección exigida:** Definir y aplicar invariantes al actualizar gracia y registrar períodos, transaccionalmente y con locks consistentes. O congelar vigencia legacy usada para agendar o rechazar ajustes que cambien derechos existentes; mantener compatibilidad de piloto. Añadir prueba de ampliación/reducción, y carrera de admin_update_setting con alta del plan; mutar comprobación de conflicto para RED.

**Estado:** `abierto` (código sin corregir en SHA inspeccionado); no se ejecutó reproduccion runtime de este defecto. La condición se debe confirmar en RED y GREEN durante el arreglo.

### PR397-H04 — El reintegro usa timestamp de inicio de transacción, no instante de liberación
**ALTO** · `supabase/migrations/20261017090000_t369_publication_credits.sql:590` · correctness / P01-contrato-de-framework-no-verificado.

**Causa:** now() en PostgreSQL devuelve transaction_timestamp; una transacción iniciada antes del vencimiento que libere luego trata el lote vencido como no vencido, reintegrando a un saldo ya caducado sin conversión D-C7.

**Evidencia:** SQL:590 v_now := now(), :612 compara l.expires_at <= v_now. Funciones de publicación usan p_now/clock_timestamp en otros caminos; no hay test de cruce de fecha dentro de una transacción.

**Corrección exigida:** Capturar clock_timestamp una vez al hacer release (sin desalinear el cutoff temporal de otras transiciones) y usarlo tanto para expiración D-C7 como updated_at. Añadir pgTAP/integ que inicia transacción antes, crea expires_at entre transaction_timestamp y clock_timestamp, libera después, verifica 1 suelto convertido y reintento no duplica. Mutar a now() y exigir RED.

**Estado:** `abierto` (código sin corregir en SHA inspeccionado); no se ejecutó reproduccion runtime de este defecto. La condición se debe confirmar en RED y GREEN durante el arreglo.

### PR397-H05 — Primera compra con descuento 0 % no consume el beneficio
**ALTO** · `supabase/migrations/20261017090000_t369_publication_credits.sql:1789` · correctness / P05-semantica-invertida-vs-dod.

**Causa:** La tabla merchant_launch_discounts exige pct between 1 and 100 y las RPC solo insertan fila si pct > 0. Si luego se configura 20%, la siguiente compra recibe el descuento aunque no sea la primera. El fake replica la omisión.

**Evidencia:** SQL:176? tabla constraint 176, :1783-1798 y :1931-1945; fake applyLaunchDiscount src/domain/testing/rpc-fake.ts:986-990; decisión expresa 2-A del 2026-10-17.

**Corrección exigida:** Registrar toda primera compra en merchant_launch_discounts con pct 0..100, aun con valor 0; devolver 0 en primera compra si procede, null después. No registrar ajustes, cortesía ni reintentos. Actualizar D6 en ficha y contratos/fake/tests, controlar carrera de primera compra; mutación RED omitiendo el registro al 0%.

**Estado:** `abierto` (código sin corregir en SHA inspeccionado); no se ejecutó reproduccion runtime de este defecto. La condición se debe confirmar en RED y GREEN durante el arreglo.

## Mejora

### PR397-H06 — Plan de rollback del cuerpo propone borrado destructivo de tablas

**MEDIO:** PR #397 cuerpo sección Rollback, frente docs/contracts/CC-029.md §Rollout/rollback; no se modificó migración mergeada. **Propuesto:** Corregir solo sección Rollback del cuerpo de PR y bitácora: revert funcional forward-only sin borrar planes, lotes ni libro; no crear migración de drop.

## Verificación independiente y límites

- Se leyó el contrato CC-029 mergeado, la ficha T-369 **desde develop**, la bitácora del autor, el diff de la PR y las funciones SQL específicas; se inspeccionó fake y contratos TS.
- **CI real existente en el HEAD revisado:** run [39024846670](https://github.com/cadeApp/cadeApp/actions/runs/39024846670) terminó exitoso en typecheck, lint, unit, build, audit, bundle-budget y db-tests. Log db-tests: **28 archivos, 2645 pruebas, Result PASS**, entre ellas `t369_publication_credits.sql`. Incluye scripts concurrentes de otras tareas, no uno propio para créditos T-369.
- Se inspeccionó la [PR descartable de mutaciones #398](https://github.com/cadeApp/cadeApp/pull/398), run [39022798152](https://github.com/cadeApp/cadeApp/actions/runs/39022798152): 36 de 225 T-369 y 2 de 1241 de solicitudes fallaron bajo mutaciones; ese RED **es del autor** y no prueba nuestros cinco hallazgos nuevos.
- **No** ejecutamos Docker, Supabase local, pgTAP, vitest ni pruebas de concurrencia multisesión en esta revisión. Se aporta la secuencia precisa para probar RED→GREEN sin adulteración ni modificar expectations. No se presupone que H03/H04 ya se hayan reproducido a nivel runtime.
- HEAD original está detrás del develop reciente: comprobar `git merge-tree --write-tree origin/develop HEAD`; después de arreglar, hacer **merge de origin/develop**, nunca rebase ni force. Reejecutar checks necesarios sobre código nuevo; no pedir CI adicional **solo** por añadir bitácora/carpeta de revisión.
- `approval-policy` estaba rojo por informe independiente ausente; se publicará en el cuerpo del PR, sin simular aprobación.

## Fuera de este paso

UI de comercio/admin y diálogo D-C2b van en T-369-UI; E2E Preview/staging en el paso tercero. **No activar cobros, cambiar `pilot_active`, modificar datos productivos ni cerrar #356.**

## Dictamen

**Cinco bloqueantes abiertos.** Para nueva ronda exigir commit de agy, logs RED→GREEN de cada hallazgo nuevo, CI de concurrencia real y comparación con CC-029. La corrección no la certifica su autor. Una vez llegue el SHA nuevo, generar `revisiones/ronda-2.md` y actualizar estados con evidencia independiente.