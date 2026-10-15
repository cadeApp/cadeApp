# Informe de revisión independiente — PR #373 / CC-026 — ronda 1

**HEAD inspeccionado:** `eadaf54581b1c1cd3875e4a039ba66ffe70f0548`  
**Base:** `develop` @ `687e2043817340b2951714cb6e7b179be2e3973a`  
**Fecha:** 2026-10-15  
**Resultado:** **CON BLOQUEANTES (2 de los 4 hallazgos/gates)**. PR declarada Draft WIP; implementación SQL y evidencia pendiente. No mergeable funcionalmente.

## Método y límites

Leídos `AGENTS.md`, `.agents/skills/revisar-pr/SKILL.md`, `docs/revision-pr/COMO-ENTREGAR.md`, `docs/revision-pr/README.md`, lecciones de pr-56/62/63/64/68/82, `docs/contracts/CC-026.md` **desde develop**, el diff completo, PR e issue #371, archivos modificados y tests. Se inspeccionó el conjunto completo de siete archivos, sin tocar código funcional.

Por conector GitHub: `HEAD` coincide con la rama remota, 1 commit adelante y 0 detrás de `develop`, metadata mergeable, sin carpeta de revisión previa en la PR. `git merge-tree` local, `pnpm`, Vitest, mutaciones runtime, Supabase Docker y `node docs/revision-pr/analizar.mjs` **no fueron ejecutados** (el contenedor no resuelve github.com y no hay clon); no declarar pruebas locales verdes ni falsos RED/GREEN. Las demostraciones de más abajo son **ANÁLISIS de código**, no ensayos ejecutados. Se registraron comprobaciones propias de relación contrato/wrapper/tests por inspección de los blobs actuales.

## Hallazgos del código nuevo

### PR373-H01 — ALTO — código de error real ausente del contrato

**Archivo:** `src/domain/rpc-contracts.ts:626-632`. **Tipo:** `[ANÁLISIS]`.

**Diagnóstico:** el contrato de `reconcile_expired_requests` enumera solo `UNAUTHENTICATED`, `UNAUTHORIZED_ACTOR` e `INTERNAL_ERROR`. No declara `VALIDATION_ERROR`. El nuevo wrapper llama a `callRequestRpc`, cuyo parser `safeParse` retorna `err('VALIDATION_ERROR')` si un caller JS/runtime le pasa `{ merchantId: ... }` u otro input prohibido; el fake también retorna `VALIDATION_ERROR` desde `executeRpc`. Un `as RpcErrorCode<K>` convierte a TypeScript, no corrige este contrato en runtime.

**Evidencia:** compare `RPC_CONTRACTS.reconcile_expired_requests.errorCodes` con `callRequestRpc` en `src/server/rpc/requests.ts:42-45` y `executeRpc` en `src/domain/testing/rpc-fake.ts:704-729`. La suite agregada prueba `inputSchema.safeParse` negativo, **no** verifica el código de error que efectivamente devuelve la API.

**Arreglo:** añadir `VALIDATION_ERROR` al catálogo de la RPC, o, si se diseña explícitamente otro código consistente, modificar TODAS las fronteras y documentarlo. Recomendación: incluir `VALIDATION_ERROR`, como ya lo emite el wrapper. Test por entrada adversarial desde boundary real/fake, afirmar `{ok:false,code:'VALIDATION_ERROR'}` y `errorCodes.includes(...)`. Contrastar el comportamiento de SQL cuando esté implementado.

### PR373-H02 — MEDIO — respuesta admite valores incompatibles

**Archivo:** `src/domain/rpc-contracts.ts:150-158`. **Tipo:** `[ANÁLISIS]`.

**Diagnóstico:** `reconcileExpiredRequestsOutputSchema` es `z.object({ expiredRequestIds: z.array(uuidSchema), expiredCount: z.number().int().nonnegative(), hasMore: z.boolean() }).strict()`. `.strict()` prohíbe propiedades extra, pero **no afirma** `expiredCount === expiredRequestIds.length`, IDs únicos ni tope de batch. Una respuesta `{expiredRequestIds:[ID],expiredCount:0,hasMore:false}` satisface las validaciones de campo aunque contradice el contrato. `callRequestRpc` acepta un output así como éxito.

**Arreglo:** aplicar refinamiento de igualdad de conteo y unicidad (y límite de 50 para RPC merchant si el CC lo fija), testear ejemplos incompatibles en `src/domain/domain.test.ts` y `src/server/rpc/requests.test.ts` y exigir `INTERNAL_ERROR` al wrapper para output inválido. **No inventar** regla `hasMore` a partir solo del conteo; depende de elegibilidad y locks SQL, se prueba en pgTAP y concurrencia.

### PR373-H03 — MEDIO — la suite nueva no protege actores, estados y lotes (bloqueante antes de cerrar WIP)

**Archivo:** `src/domain/domain.test.ts:64-132`, `src/domain/testing/rpc-fake.ts:757-792`, `src/server/rpc/requests.test.ts:96-116`. **Tipo:** `[ANÁLISIS]`.

**Diagnóstico:** un único caso con merchant válido, dos requests y una oferta valida 1 transición; el resto comprueba presencia/shape. La implementación del fake ya restringe rol y consentimiento, elegibilidad `acceptedOfferId=null` y batch `slice(0,50)`, pero **ninguna prueba agregada** pone rojo quitar esas protecciones. Faltan `anon`, courier, admin, merchant sin consentimiento, vencimiento previo/exacto/posterior, estados `matched/in_transit/delivered/cancelled/expired`, `acceptedOfferId` no nulo, `expiresAt=null`, reintento sin efectos y 50/51/100 filas con `hasMore` y contenido correcto. Los tests del fake no prueban auditoría ni `offers.decided_at` porque el fake no modela esos efectos; esa propiedad exige DB real (pgTAP) o fake extendido de forma explícita, no afirmar que ya está cubierta.

**Arreglo:** tabla de casos por actor y estado, límites de tiempo con reloj fijo, batch 51 y segunda llamada a la RPC, assertion de outputs + estado mutado, negativa de ajenos y conteo idempotente. Las pruebas DB reales, locks, auditoría y rollback vendrán con la migración; **no declarar cobertura SQL sobre mocks**. Ensayos de mutación solicitados: desactivar guard de rol, quitar guard de dueño y cambiar `slice(0,50)` por todo; cada mutación debe hacer caer un test por su invariante.

### PR373-H04 — BAJO — fuente de verdad documental queda divergente

**Archivo:** `src/domain/states/index.ts:47-50` vs `docs/master-plan.md:98` en `develop`. **Tipo:** `[ANÁLISIS]`.

El cambio `now.getTime() >= expiresMs` coincide con las RPC de Postgres (vencimiento al límite). Sin embargo, `docs/master-plan.md` aún dice `now() > expires_at`. El CC-026 ya ordena reconciliar las fuentes de verdad; dejar expresamente ligado el cambio al ajuste de esa frase en una PR autorizada (o pedir ampliación documental del CC), con test de instante exacto. **No revertir** el comparador correcto para hacer coincidir documentación vieja.

## Gate de implementación todavía no satisfecho (no imputable como defecto del código WIP)

Faltan, y el autor lo reconoce, la nueva migración forward-only con `app_private.reconcile_expired_requests` y wrappers merchant/cron, `SECURITY DEFINER`, grants mínimos, RLS/bypass, actualización atómica `delivery_requests/offers/audit_log`, compatibilidad con `accept_offer` y `republish_request`, locks en orden, completitud `hasMore` bajo `SKIP LOCKED`, tipos generados, refactor `src/server/cron/sweep.ts`, pruebas pgTAP de dos conexiones, fallos forzados con rollback, auditoría e idempotencia. Sin ello NO cumple DoD y no se mergea, aunque los tests TS fuesen verdes.

**Nota de coordinación:** PR #373 dice `Closes #371`. Al estar en Draft es inocuo; no mergear hasta que la implementación realmente complete #371. Mantener `T-366/#355` bloqueada y Kira a cargo.

## NO TOCAR — falsos positivos evitados

- Que no exista SQL aún **no** es una acusación de SQL inseguro; es un trabajo pendiente declarado.
- `expires_at <= now()` en el instante exacto es lo correcto según las RPC actuales; no regresar a `>`.
- `hasMore` no se deduce de `expiredCount < limit` bajo `SKIP LOCKED`; debe ser confirmación del scope en SQL.
- `z.object({}).strict()` sí impide al comercio suministrar libremente `merchantId` por la frontera TS; aún falta protección SQL real.
- El fake no demuestra transacción de DB; no confundirlo con pgTAP.

## Evidencia de checks

| Control | Estado |
|---|---|
| Diff completo, alcance vs CC de develop | Por inspección: siete rutas documentadas por la ficha del CC |
| Comparación HEAD develop/remoto | API GitHub: ahead 1, behind 0, metadata mergeable |
| RED/GREEN declarados en body | Autor declara 66/66 y 61/61; **no reproducidos por revisor** |
| pnpm typecheck / lint | Autor declara PASS; no comprobados localmente |
| pnpm test completo | Autor indica fallo de clients.test.ts en corrida general; la aislada 10/10 dos veces; no reproducido |
| CI GitHub del HEAD revisado | Consultado durante ronda: run en progreso, **no se certificó como GREEN** |
| e2e-preview | Status `error`; run asociado `38704263924` en `cancelled`, no inferir fallo funcional |
| SQL / pgTAP | No hay nueva migración en diff; sin pruebas DB de CC-026 que se puedan certificar |
| Mutaciones propias/runtime | No ejecutadas (sin clon) |
| `git merge-tree` local | No ejecutado (sin clon) |

## Próxima ronda

Después de H01–H04 y de completar CC-026, ejecutar comparaciones de scopes por actor, pgTAP y su log CI, concurrencia real, RED/GREEN independientes (incluidos mutantes de autorización, revalidación bajo lock y side effects), pruebas de cron sin afectación a purga/abonos y E2E Preview sobre el SHA exacto. Actualizar esta carpeta SOLO por el revisor, agregando `revisiones/ronda-2.md`; no editar la ronda 1.
