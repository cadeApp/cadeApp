# PR #333 — CC-024 / T-340 Gate 2 — Revisión independiente Ronda 1

- **Fecha:** 2026-10-14. **SHA de implementación inspeccionado:** `f12b9d5a2b0ee68d4ab8225b6db32229cf77fcdf`. **Base develop:** `3a453762445ce866a373eeab4a86365aacaca7e5`.
- **Autora de implementación:** Lautaro073 / agy. **Decisión explícita registrada por Lautaro073:** opción **A** para concurrencia: runner dedicado `supabase/tests/integration/cc024_atomic_concurrency.mjs` y mínima invocación dentro del job `db-tests`; NO redistribuir a #330 ni modificar runner histórico.
- **Dictamen:** **CON BLOQUEANTES**, 5 altos y 1 medio. PR permanece Draft, NO aprobar/mergear.
- **Alcance original del diff:** 9 archivos; migración nueva, contrato/fake/tests, wrapper, tipos y bitácora; sin tocar migraciones previas ni `.github/**` antes de esta autorización.

## Hallazgos
### PR333-H01 — La rama de reintento siempre rechaza el UUID ya publicado (alto)

- **Ubicación:** `supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql:290` (SHA indicado).
- **Evidencia:** SQL líneas 253–307: al encontrar request existente compara payload, luego `if not v_inserted then raise INVALID_STATE_TRANSITION`; todo retry auténtico tiene `v_inserted=false`. CI db-tests: subtest 148 `CC-024 repite el mismo payload sin republicar`: have NULL, want true; Files=21 Tests=2057 Result=FAIL.
- **Corrección:** Mover rechazo únicamente al conflicto de draft ajeno/incompleto; para published/matched/in_transit/terminal propio y payload canónico igual retornar estado actual, publishedAt/expiresAt originales e idempotent:true sin nueva publicación, hijos, eventos ni push. Mantener NOT_FOUND antes de comparar payload de actor ajeno y VALIDATION_ERROR en mismo UUID con contenido diferente.
- **Estado:** ABIERTO. No se atribuye una mutación RED ni una comprobación GREEN independiente que no haya ocurrido.

### PR333-H02 — La guarda autoAssign usa v_fixed_price antes de inicializarlo (alto)

- **Ubicación:** `supabase/migrations/20261014110000_cc024_atomic_multi_drop.sql:104` (SHA indicado).
- **Evidencia:** SQL líneas 96–108: v_fixed_price_value está parseado, pero `if (... or (v_auto_assign and v_fixed_price is null))` precede a `v_fixed_price := v_fixed_price_value::integer`; `v_fixed_price` es NULL y rechaza autoAssign=true aun con fixedPriceArs positivo.
- **Corrección:** Validar con v_fixed_price_value o inicializar v_fixed_price después de verificar rango y antes de la guarda, evitando cast prematuro fuera de integer. Verificar autoAssign=true con precio fijo válido publica, autoAssign=true precio NULL rechaza, autoAssign=false sin fijo publica; validar lado Zod y SQL.
- **Estado:** ABIERTO. No se atribuye una mutación RED ni una comprobación GREEN independiente que no haya ocurrido.

### PR333-H03 — La nueva RPC hace fallar el umbral obligatorio de cobertura de ramas (alto)

- **Ubicación:** `src/domain/rpc-contracts.ts:53` (SHA indicado).
- **Evidencia:** CI run 38575667108 job unit 115892298749: 2141/2141 tests PASS, pero coverage branches de rpc-contracts.ts 76.66% (<90%) y rpc-fake.ts 89.13% (<90%), job FAILURE.
- **Corrección:** Agregar pruebas adversariales reales para cada rama Zod de createAndPublishMultiDropInputSchema, contacto, precio/cambio, consent, coordenadas, y fake de role/idempotencia/payload distinto/estados terminales/setting, sin tocar thresholds, config ni excluir archivos. Mutaciones de condiciones hacen fallar las aserciones de negocio; unit 90%+ por archivo.
- **Estado:** ABIERTO. No se atribuye una mutación RED ni una comprobación GREEN independiente que no haya ocurrido.

### PR333-H04 — pgTAP cubre solo parte del DoD de backend CC-024 (alto)

- **Ubicación:** `supabase/tests/t340_multi_drop.sql:1980` (SHA indicado).
- **Evidencia:** Plan pasó de 136 a 154 (+18), tests efectivos prueban creación 2 drops, retry, conflicto de dirección, actor courier, zona inválida y llave extra. No cubre caso 1 drop, límite 0/max+1, anon/otro comercio, ausencia de suscripción, fallos a mitad de contactos/drops y publish, postmatch/terminal, direct bypass, 0 huérfanos en cada fase ni legacy/public-feed; DoD CC-024 y T-340:272-279 sí los exigen.
- **Corrección:** Extender pgTAP sobre base efímera con fixtures reales, asserts por tablas y rollback 0 filas en cada fase, actor y PII, exact counts, reintento tras cada estado y legacy. Inyectar fallos en triggers temporales de test y en publicación, revisar error de negocio P0001 por código y estado final, no solo mensaje. Verificar plan y filas reales.
- **Estado:** ABIERTO. No se atribuye una mutación RED ni una comprobación GREEN independiente que no haya ocurrido.

### PR333-H05 — database.types.ts fue editado manualmente en vez de regenerarse (medio)

- **Ubicación:** `src/types/database.types.ts:897` (SHA indicado).
- **Evidencia:** El body y bitácora de PR confiesan edición manual, porque `pnpm db:types` sin `--local` habría intentado --linked; T-340:132 exige generado mediante pnpm db:types. El job db-tests falla antes del paso posterior de comparar tipos, así que no existe evidencia de diff cero.
- **Corrección:** Después de levantar PostgreSQL efímero de CI, ejecutar `pnpm db:types --local` con el esquema migrado, verificar `git diff --exit-code -- src/types/database.types.ts`, commitear output genuino sin tocar tools/db-types.mjs ni conectar Supabase remoto.
- **Estado:** ABIERTO. No se atribuye una mutación RED ni una comprobación GREEN independiente que no haya ocurrido.

### PR333-H06 — Falta prueba real de concurrencia CC-024 con dos sesiones (alto)

- **Ubicación:** `supabase/tests/integration/cc024_atomic_concurrency.mjs:1` (SHA indicado).
- **Evidencia:** PR #333 no incluye runner CC-024; checklist concurrencia incompleto. CC-024:276-278 y T-340:125–129 piden prueba de dos sesiones. Lautaro073 eligió expresamente opción A: archivo dedicado e integración mínima al job db-tests, ahora autorizado.
- **Corrección:** Crear runner Node stdlib en supabase/tests/integration/cc024_atomic_concurrency.mjs y habilitar solo su invocación en db-tests de .github/workflows/ci.yml, reutilizando DB_CONTAINER efímero; observación real con pg_blocking_pids/pg_stat_activity, carrera mismo UUID igual/diferente payload y dueño ajeno, dos órdenes, estado final/eventos únicos. Sin sleeps de sincronización ni tocar runner histórico; registrar autorización en T-340.
- **Estado:** ABIERTO. No se atribuye una mutación RED ni una comprobación GREEN independiente que no haya ocurrido.

## Qué sí está implementado
- La firma RPC y nueva migración mantienen `SECURITY DEFINER`, `search_path` fijo y `revoke/grant` solo authenticated.
- `auth.uid()` + perfil `merchant`/consentimiento activo, contactos privados en `delivery_request_drop_contacts` y columnas de destino legacy NULL, consumo de `app_private.request_cycle('publish_request', id)` dentro de la misma llamada PostgreSQL.
- El wrapper server-only mapea `p_payload`, intenta push best-effort solo en primer éxito; la fake tiene casos de retry propios y validación Zod estricta. **Pero ni pruebas fake verdes ni CI verde de otro job garantizan que SQL real cumpla el contrato.**

## Evidencia de CI del SHA revisado
- CI [run 38575667108](https://github.com/cadeApp/cadeApp/actions/runs/38575667108) / `db-tests` job **115892299551**: `Files=21, Tests=2057, Result=FAIL`. Falló pgTAP #148, retry idempotente (`have NULL`, `want true`). No es un problema Docker; PostgreSQL arrancó y ejecutó la suite.
- `unit` job **115892298749**: Vitest `2141 passed`, pero **coverage gate FAILURE**: 76.66% branches en `src/domain/rpc-contracts.ts` y 89.13% en `src/domain/testing/rpc-fake.ts` vs 90% requerido. No alterar umbral.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget`, Vercel Preview SUCCESS. `approval-policy` FAILURE por informe pendiente. `Supabase Preview` skipped, apropiado para PR con migración todavía no desplegada.
- CI no tiene ejecución de runner dedicado porque aún no existe. La cobertura de SQL es parcial; migración aplicada solo en DB efímera de CI, no en Develop.

## Sin pruebas inventadas
- Revisor ejecutó inspección de código SQL/TS y leyó logs auténticos de CI. **No** ejecutó Docker, Supabase local/remoto, Node tests localmente ni mutaciones propias RED→GREEN. Los tests RED propuestos son instrucciones a realizar por autor con infraestructura CI, no hechos verificados.
- **No declarar aprobación, merge ni gate 3 completados.** Gate 2 necesita pgTAP/runner real GREEN, cobertura completa, type generation genuina, revisión independiente nueva y autorización expresa de merge por Lautaro073. Gate 3 exige migrate-develop GREEN + prueba RPC 1/N y legacy real; Gate 4 entonces retoma #330.

## Control de la ampliación de alcance
- El dueño eligió A durante esta ronda y **autoriza únicamente** `supabase/tests/integration/cc024_atomic_concurrency.mjs` y modificación mínima acotada a `db-tests` en `.github/workflows/ci.yml`, más línea documental de autorización en `docs/tasks/T-340.md`. Mantener íntegro el runner histórico `t340_concurrency.mjs`, no modificar otras jobs ni secretos, ni depender de infra remota.
- La lista original de nueve archivos sigue como alcance restante; cualquier cambio nuevo fuera de esa lista más los tres anteriores requiere consulta posterior. No se autoriza cambiar `tools/db-types.mjs` ni modificar migraciones aplicadas.

## Dictamen final
**CON BLOQUEANTES.** Los dos fallos de CI son reales y se suman a faltantes de cobertura contractual. Publicar corrección y evidencia RED→GREEN auténtica sobre un HEAD nuevo para solicitar Ronda 2; no mergear.
