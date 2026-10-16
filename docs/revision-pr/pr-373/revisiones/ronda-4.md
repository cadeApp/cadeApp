# Revisión independiente — CC-026 / PR #373 — ronda 4

**Fecha:** 2026-10-15. **HEAD de implementación revisado:** `23e394f828df3872a5681c4cdadf2da9eb3db399`. **Base de PR:** `develop` @ `687e2043817340b2951714cb6e7b179be2e3973a`. **Branch:** `cc/CC-026-reconciliacion-expiraciones`. **Estado:** sigue Draft; solicitud explícita de R4 por comentario del autor.

**Resultado:** **SIN NUEVOS BLOQUEANTES TÉCNICOS PROBADOS; CON 2 DECISIONES DE ALCANCE PENDIENTES (A01/A02). NO MERGEAR AÚN.** Este estado no equivale a una certificación runtime independiente o despliegue. Tampoco equivale a E2E Preview verde.

## Alcance y método verificable

- Leídos `AGENTS.md`, `docs/contracts/CC-026.md` **de develop** (fuente del alcance), `docs/tasks/T-366.md` **de develop**, revisiones R1–R3 y comentarios de PR/issue.
- Comparación GitHub `07a7a381...23e394f8`: 4 commits del autor; 7 archivos efectivamente cambiados: `.github/workflows/ci.yml`, `docs/master-plan.md`, `src/domain/domain.test.ts`, `src/domain/testing/rpc-fake.ts`, `src/types/database.types.ts`, `supabase/tests/cc026_reconcile_expired_requests.sql`, `supabase/tests/integration/cc026_reconcile_expired_requests.mjs`. Ninguna modificación por el autor en `docs/revision-pr/pr-373/**` desde R3.
- Inspeccionados diff global de 23 rutas, migración SQL, suite pgTAP y harness, fake/contracts, cron y tests; GitHub PR mergeable=true en metadata (no equivale a ejecución local de `git merge-tree`).
- Verificados **logs públicos de GitHub Actions**, no solo colores. **No ejecuté tests/mutantes locales ni PostgreSQL/Docker/Supabase remoto** por el entorno y las reglas. Por eso ningún hallazgo se firma `arreglado-verificado` ni se establece `verificado_en_sha`.

## Correcciones que avanzaron en HEAD R4

| ID | Inspección y evidencia |
|---|---|
| H01/H02 | Contrato RPC y validaciones estrictas presentes; suite unit incluyendo sus casos GREEN; sin ejecución independiente propia |
| H03 | Matrices de permisos, batch, límite temporal, idempotencia y concurrencia cubiertas por fake/pgTAP/harness; `db-tests` confirma pgTAP y harness GREEN |
| H04 | `docs/master-plan.md:98` ahora usa `now() >= expires_at`, alineado con SQL `expires_at <= now()`, pero edición fuera de alcance pendiente D2 |
| H05 | La migración conserva `REVOKE UPDATE` directo y grants por columna no operativa, con negativas pgTAP de `status`, `accepted_offer_id`, `expires_at`, `offers.status` y `decided_at` GREEN |
| H06 | `.github/workflows/ci.yml:201` ejecuta `cc026_reconcile_expired_requests.mjs` dentro del job DB; log `[CC-026] GREEN: dos lectores, aceptación y republicación...`; edición de workflow pendiente D1 |
| H07/H08/H10 | FK de fixture corregida; ruta cron GET/POST mock RPC y reporta 200/401/500; batches de hasta 5×200 y corte por `hasMore`/locks, con tests unit GREEN |
| H09 | `src/types/database.types.ts` generado ahora contiene ambas RPC; `pnpm db:types --local` corrió en CI y `git diff --exit-code` salió verde |
| H11 | SQL `LIKE` operador en `ok(coalesce(...))`, rollback forzado de offers/audit; 54 pgTAP PASS. Mutante CI al retirar `create trigger cc026_fail_offer` produjo 8 fallas en casos 42–49 (RED), restablecimiento GREEN 54/54 |
| H12 | Vitest reporta 133/133 archivos y 2.348/2.348 tests PASS, cobertura de ramas global de `rpc-fake.ts` por encima de 90% (unit SUCCESS). Casos `withdrawn` e invalid output agregados |

**No se atribuyen mutaciones independientes propias:** el RED H11 fue ejecutado por la CI configurada en la PR (observado en logs), no por el revisor que firma R4. No se afirma prueba E2E que no ocurrió.

## Estado exacto de CI #38783733680 (HEAD original)

| Check | Resultado |
|---|---|
| `lint`, `audit`, `typecheck`, `build`, `unit`, `db-tests`, `bundle-budget` | SUCCESS |
| `db-tests` — suite completa | `Files=23, Tests=2259, Result: PASS` |
| `db-tests` — CC-026 aislado | `Files=1, Tests=54, Result: PASS` |
| `db-tests` — mutante H11 | `RED: 8/54 FAIL` específicos, luego `GREEN: 54/54 PASS` |
| `db-tests` — harness CC-026 | Mensaje GREEN lectores/aceptación/republicación, no `E2E` navegador |
| `unit` | `133/133` files; `2348/2348` tests PASS, cobertura threshold PASS |
| `db:types` | Artefacto `generated-database-types` ID `11995924838`, `git diff --exit-code` sin drift |
| Vercel | SUCCESS |
| `e2e-preview` | **ERROR / BLOCKED — REQUIRES DEVELOP MIGRATION** (run #38783881834), condición deliberada del gate ante PR con migración; no hay E2E verde para este SHA |
| `approval-policy` | **FAILURE**, run #38784748063, `Falta el informe completo de revisar-pr sin bloqueantes.` No afirmar que se debe a lógica funcional |

El gate `e2e-preview` está diseñado para impedir ejecutar E2E Preview contra un contrato SQL aún no desplegado en Supabase Develop. Es una restricción de rollout, **no una prueba E2E fallida**. E2E con dos sesiones del historial corresponde a T-366 tras merge + migración del CC. **No cambiar el gate, no desplegar SQL prematuramente y no afirmar E2E PASS.**

## Hallazgos de proceso/alcance — 🔵 decisiones humanas sin evidencia de autorización

### PR373-A01 — DECISIÓN D1 · `.github/workflows/ci.yml:185–201`

El cambio técnico es razonable: incorpora test de dos conexiones en `db-tests` y control mutante de rollback, y **funcionó en CI**. Sin embargo, `.github/**` no figuraba en `docs/contracts/CC-026.md §Impacto exacto`. La R3 pidió expresamente autorización previa D1. En los comentarios disponibles del issue #371 y de la PR #373 no se encontró la opción elegida por Lautaro073, aunque el body afirma “la autorización posterior amplió”. **No asumir autorización solo por esa afirmación del autor.**

- **A (recomendada):** Lautaro073 ratifica expresamente incorporar `.github/workflows/ci.yml` en CC-026. Se conserva la prueba automática de concurrency + mutación, ya verde y sin rebajar gates. Es el mejor control sostenible.
- **B:** PR de CI separada, con dependencia antes del merge del CC. Mantiene proceso estricto de alcance, pero introduce coordinación adicional; una ventaja si branch governance exige separar workflows.
- **C:** retirar cambio de workflow del CC y mantener harness manual. Menor superficie modificada, pero se pierde control automático y la obligación de ejecución de carreras queda frágil. No recomendable.
- **Por qué A:** el cambio ya fue probado con dos sesiones en CI y sirve como regresión permanente. B es válida si hay governance; C sacrifica control sustantivo. **Falta:** aprobación explícita documentada.

### PR373-A02 — DECISIÓN D2 · `docs/master-plan.md:98`

Se corrigió `now() > expires_at` → `now() >= expires_at`, consistente con el comportamiento exigido. La R3 pidió autorización porque `docs/master-plan.md` no estaba en la lista de implementación de CC-026. La declaración de autorización en body no es prueba independiente de elección del usuario.

- **A (recomendada):** ratificar la inclusión de **solo esta línea** del master-plan en CC-026, conservando el criterio de límite exacto. Bajo riesgo, sin alteración de producto; elimina contradicción.
- **B:** separar PR documental y enlazarla como dependencia previa al cierre del CC. Valida revisión individual pero crea fricción.
- **C:** revertir doc y dejar el texto viejo, creando dos fuentes divergentes. No recomendable.
- **Por qué A:** alinea docs, tests y SQL sin introducir nuevo comportamiento. B útil si document governance lo exige; C deja deuda evitable. **Falta:** elección explícita documentada.

## Coordinación / gate de T-366

Se encontró #355 **erróneamente en `en-curso`** aunque CC-026 #373 no está mergeada ni desplegada. Esta revisión restableció su etiqueta a **`bloqueada`** sin cambiar asignación @KiraK72. No mover hasta merge, migrate-develop SUCCESS y reconciliación de `docs/tasks/T-366.md` con el contrato real. La ficha de T-366 **no** se modifica desde este PR por el revisor.

## Dictamen

**No detecté nuevos defectos de código demostrados en la R4 al SHA inspeccionado.** El DoD técnico relativo a SQL/RPC/cron tiene evidencias fuertes en CI. Aún **no hay autorización trazable D1/D2**, la PR sigue Draft, `approval-policy` FAIL y `e2e-preview` BLOCKED por dependencia real de migración. No equiparar “CI principal verde” con “todos los gates verdes/merge inmediato”. **Aguardar ratificación explícita A/B/C de D1 y D2 y entregar después el cierre de revisión final sin decisiones abiertas. NO APROBAR, NO MERGEAR.**
