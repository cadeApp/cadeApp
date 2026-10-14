# PR #320 — Ronda 2, revisión independiente de T-340 Paso 2

**Fecha:** 2026-10-13. **SHA de aplicación/bitácora examinado:** `d755e6fb5b9391b81872d9fd7d93359aaf97f5c3`. **Base:** `develop` `875f8621fa727c115326cc2f83036e44859ad52e`.

## Dictamen: CON BLOQUEANTE DOCUMENTAL/DE GATE (PR320-H07). CERO bloqueantes de código encontrados.

### Evidencia nueva independiente

- Run E2E trusted [38361113528](https://github.com/cadeApp/cadeApp/actions/runs/38361113528): `resolve-preview` identifica PR **#320**; el job Playwright `115175339942` efectúa `git checkout --force d755e6fb5b9391b81872d9fd7d93359aaf97f5c3` (el `head_sha` del evento de workflow pertenece a `develop`, no al commit probado).
- **Chromium: 72 passed, sin fallos ni flaky (15,5 min). Global-settings: 3 passed, sin fallos (1,0 min).** `subscription.global-settings.spec.ts:159` DoD2 PASS (21,4 s), `t340-legacy-checkpoint.spec.ts:29` PASS. Las ocho pruebas previamente fallidas del feed vuelven a pasar.
- Commit status sobre el SHA de #320: **`e2e-preview=success`**, descripción «trusted E2E gate GREEN» sobre el despliegue `dpl_4gCaqqbjBF2MuhGUss9h2UV5kUX8`. No se contó ningún E2E skipped/cancelled.
- CI técnica para el SHA: `unit` 129 suites / **2133 Vitest PASS** + 79 tests de workflows y 6 ADR PASS; `db-tests`, `typecheck`, `lint`, `build`, `audit` y `bundle-budget` PASS; Vercel SUCCESS. `approval-policy` todavía FAIL (informe y proceso no cerrados), por eso **no autorizar merge aún**.

### Revisión de implementación frente a H01–H07

- **H01 — superado en código y runtime:** `seedDeliveryRequestInState`, en `src/server/e2e/staging-seed.ts:1791–1876`, inserta parent draft; crea oferta si corresponde, contacto legacy opcional, **drop 1 + contacto privado en todo estado no-draft** y luego finaliza con actualización `.eq('status','draft')`. Mantiene draft sin hijos para tests de puente legacy y rechaza marcas temporales imposibles.
- **H02 — superado en código y runtime:** `seedStagingData`, líneas 574–660, crea parent draft y `trackEntityForCleanup` inmediatamente, opcionales legacy aparte; SIEMPRE materializa drop/contacto privado y recién después `published`. Los fallos de inserción o finalización arrojan error real. No se quitó guard fail-closed de lector.
- **H03 — superado:** spec `courier-feed-vocabulary.spec.ts` actualiza datos reales del drop 1 (y padre compatible) y mantiene verificación de feed inicial + API real tras reconectar + ausencia de vocabulario incorrecto; caso E2E PASS.
- **H04 — superado:** `trip.page.ts` restringe el selector de estado al header del viaje (en lugar de `getByText` global). El flujo de viaje y badge pasan en suite.
- **H05 — mitigado y runtime verde:** según la bitácora del autor, Lautaro073 autorizó y ejecutó personalmente una limpieza con guardas de residuos E2E en **Develop**. Se documentaron conteos before 4 published sin drops y after 0. Esta revisión **no ejecutó SQL ni accedió a tablas remotas**; lo verificable independientemente es que el mismo feed fail-closed ya no falla en los 72 casos sobre el SHA nuevo. La medida duradera de cleanup ante cancelación es una deuda operativa aparte: el `finally` del fixture no corre si el job es cancelado bruscamente.
- **H06 — verde en este run:** `courier-private-columns` aprobó primera vez y Chromium no tuvo flaky. Riesgo de Realtime eventual no queda demostrado inexistente por una sola corrida; no se cambió timeout de 25s ni se ignoró evento.
- **H07 — queda un requisito de proceso:** revisión independiente cumplida mediante esta R2 y gates técnicos+E2E verdes. Falta que el **autor** registre el run 38361113528 en `docs/tasks/log/T-340.md` (última entrada `07:15` todavía dice que falta el checkpoint combinado), concilie el body de #320 para indicar que **#320 por sí sola** pasó el gate y ya NO depende del merge de T-352, y que `approval-policy` final del nuevo HEAD pase correctamente. Una descripción vieja aún pide checkpoint combinado con #323 antes del merge: resolución de dependencia ya cambió y no puede quedar como obligación contradictoria.

### Reglas de revisión conservadas

Comparación del diff `develop...#320`: 13 archivos autorizados de fixtures, E2E, pruebas y documentación; no cambios productivos de auth, middleware, RLS, migrations, RPC, frontend ni workflow. Inspección de patch no muestra `.skip`, `.only`, `test.fixme`, mocks que reemplacen verificaciones de privacidad ni aumento de timeouts/retries. El spec multi-drop mantiene privacidad de JSON crudo, bloqueo al courier ajeno, estados y 3 tarjetas. Los tests unitarios emplean mocks por diseño, pero se corroboraron con el E2E real del SHA exacto. La prueba RED del autor para mutaciones queda descrita en bitácora; **no ejecutada localmente por el revisor**.

### Orden después del cierre documental

1. El autor actualiza **solo su bitácora y body** con el GREEN y la nueva decisión de dependencia. No toca la carpeta de revisión ni cambia código para forzar gate.
2. Volver a verificar nuevo HEAD y `approval-policy`; si sigue todo verde, **Lautaro073** puede sacar Draft y mergear #320 con su autorización, sin esperar a #323.
3. Ya integrado #320 a `develop`, actualizar #323 mediante **merge normal** de `develop` (sin rebase ni force), con el nuevo seed; obtener Preview propio y E2E `chromium` + `global-settings` sobre HEAD exacto de #323. Esa verificación cerrará H01 de #323 si da green; no atribuir ese resultado de DoD2 únicamente al redirect. No pushear #323 antes de integrar #320 por riesgo de nuevas solicitudes orphan de seeds viejos.
4. PR temporal #324 queda cerrada **SIN MERGE**. No habilitar pasos 3/4 de T-340 hasta validaciones posmerge explícitas.

**Conclusión:** el arreglo de fixtures y los E2E son técnicamente correctos en este SHA. Único bloqueante restante: sincronización documental/gate del autor y política de aprobación. No se aprobó ni mergeó.
