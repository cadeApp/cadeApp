# Informe de revisión — PR #551 / T-415 — Ronda 2

**Fecha:** 2026-10-26 (Argentina). **Revisor:** ChatGPT, revisión externa de las correcciones del agente.
**HEAD solicitado e inspeccionado:** `b72e2bfad3fdae55843326fce61a72b17d66b4e8` (código de pruebas en `f77d86c67baec208bae3f350faeee0ea2293502a`; el último commit modifica únicamente la bitácora).
**Base actual de origin/develop:** `24b2e374f90f7fd1257e53ed5a750b2a0e4724bb` (dos commits documentales posteriores a la base original).
**Resultado:** SIN NUEVOS BLOQUEANTES TÉCNICOS detectados en los arreglos H01–H04. **NO CERTIFICADO para merge:** `audit` global en rojo; no hubo ejecución de mutaciones locales por este revisor. PR permanece Draft. No se aprueba ni mergea.

## Chequeos al comenzar la ronda

- La rama remota y la PR coinciden exactamente en `b72e2bfad3fdae55843326fce61a72b17d66b4e8`; dos commits después de la publicación de ronda 1 (`f77d86c6` código/pruebas y `b72e2bfa` solo bitácora). Los cambios nuevos afectan solo siete rutas: seis archivos de pruebas y la bitácora. No hay alteraciones del código de producción posteriores a la primera corrección `2a5c1593`.
- Revisados los comentarios existentes, bitácora T-415 sesión 3, ficha **desde develop**, contrato CC-041 y carpeta histórica de revisión. Ninguna escritura ajena a `docs/revision-pr/pr-551/` desde la publicación de la ronda 1.
- La ampliación de ficha con `src/features/admin/schemas.ts` es exactamente la A01 autorizada por Lautaro073 en ronda 1. El resto de archivos está dentro del alcance. No hay paquetes nuevos, reglas/test adulterados ni `.skip/.only` en las seis suites examinadas.
- `origin/develop` avanzó en `docs/implementation-plan.md` y `docs/tasks/T-416.md`, sin solapamiento de rutas con #551. GitHub reporta PR mergeable; **no se pudo ejecutar `git merge-tree`** sin clon local, así que no se certifica esa comprobación como ejecutada.

## H01 — Consentimiento, status, renovación y límite en el fake

**Resultado por inspección: corregido; ejecución independiente pendiente.**
`rpc-fake.ts` almacena último consentimiento por perfil y `get_online_couriers_count` exige aprobado, disponible, consentimiento activo y hora > límite. La suite `cc041-online-couriers.test.ts` prueba pending y reconsent_required tras heartbeat exitoso, retorno a active, suspensión con presencia reciente, renovación después de avanzar el reloj y frontera exacta.
- Evidencia declarada por autor: mutantes sin consentimiento (1/9 RED), sin approved (1/9 RED), sin renovación (1/9 RED); no ejecutados por este revisor.
- **Observación no bloqueante:** la representación es un mapa de consentimientos conocidos de actores (default active), no un campo `consentStatus` de `FakeSeedCourier`. Para las transiciones reales probadas funciona y no se observó incumplimiento observable que obligue a reescribirla; si se agregan fixtures de consentimientos inactivos sin pasar por `setActor`, ampliar la API de semillas con el consentimiento explícito.

## H02 — Observer real, reintentos y error con snapshot anterior

**Resultado por inspección: corregido; ejecución independiente pendiente.**
`use-online-couriers.test.tsx` monta `useOnlineCouriers` real con QueryClientProvider, reloj controlado, `fetch` en la frontera HTTP, defaults de foco/reconexión desactivados y `focusManager/onlineManager`. Exige el nuevo count tras 60 s, ausencia de polling en segundo plano y actualización al volver/reconectar. `online-couriers-indicator.test.tsx` fuerza HTTP 500 **tras dato previo**, espera estado error real y comprueba que el indicador desaparezca aun reteniendo cache.
- No se mockean `useQuery` ni `useOnlineCouriers` para estos casos. El código usa `staleTime=60000`, `refetchOnWindowFocus='always'` y `refetchOnReconnect='always'`.
- Mutantes RED del autor (intervalo, background, foco, reconnect, queryFn y guarda `isError`) son plausibles frente a las aserciones inspeccionadas, pero no reproducidos localmente por esta revisión.

## H03 — pgTAP discrimina condiciones del SQL

**Resultado: estructura verificada por inspección + ejecución RED/GREEN de CI inspeccionada; mutaciones no creadas por este revisor.**
`plan(36)` coincide con la evidencia CI. Fixture envejece la señal antes de renovarla y exige `now()` persistido. Añade suspendido y pendiente con presencia reciente y available=true, aprobado activo sin presencia, borde exacto, autorización de merchant sin fila, extremos 2/60 y catálogo de RLS/SECURITY DEFINER/search_path/STABLE.
- **GREEN fuente `f77d86c67baec208bae3f350faeee0ea2293502a`:** job [121417119690](https://github.com/cadeApp/cadeApp/actions/runs/40275448717/job/121417119690) `cc041_online_couriers.sql ... ok`, `Files=40, Tests=3252, Result: PASS`, diff de tipos sin diferencias.
- **RED #556:** [job 121417303165](https://github.com/cadeApp/cadeApp/actions/runs/40275511570/job/121417303165), eliminación **solo** de `c.status='approved'`: fallan aserciones 25, 28, 29, 30.
- **RED #557:** [job 121417326420](https://github.com/cadeApp/cadeApp/actions/runs/40275519307/job/121417326420), ON CONFLICT conserva timestamp viejo: fallan 21, 22, 24, 25, 28, 29.
- **RED #558:** [job 121417351478](https://github.com/cadeApp/cadeApp/actions/runs/40275527842/job/121417351478), policy permisiva/true: falla 2.
- **RED #559:** [job 121417377634](https://github.com/cadeApp/cadeApp/actions/runs/40275536735/job/121417377634), se elimina solo requisito `merchants`: falla 17.
- Se inspeccionaron los **diffs efectivos de los cuatro commits mutantes**, no solo sus títulos o las afirmaciones en la bitácora. Las cuatro PR están cerradas y no mergeadas. No se inició Supabase/Docker local.

## H04 + A01 — Configuración guardada y paridad de límites

**Resultado por inspección: corregido; ejecución independiente pendiente.**
`queries.test.ts` separa lectura de valor guardado 27 de ausencia de fila => fallback 10, recorriendo `getPlatformSettings` real. El formulario monta UI real con acción simulada, prueba 2 y 60 válidos, 1/61/2.5/vacío/texto inválidos, `role=alert`, `aria-invalid` y ninguna llamada a la acción inválida. Contrasta el schema real con `adminUpdateSettingInputSchema` en 13 números y casos no numéricos.
- El autor declara RED de lectura fija y de min/max; no se reejecutaron en esta sesión.
- A01 permanece **ACEPTADA** por Lautaro073; no requiere otra decisión.

## CI, limitaciones y pendientes

- En el HEAD `b72e2bfad3fdae55843326fce61a72b17d66b4e8`, `unit` ✅ [job 121420134155](https://github.com/cadeApp/cadeApp/actions/runs/40276459983/job/121420134155): **184 archivos y 3411 Vitest**, más 81 tests de workflows y 6 de ADR. `typecheck`, `lint`, `build` y `bundle-budget` también ✅.
- El `db-tests` del HEAD documental seguía en ejecución cuando se consultó; **el código no cambió respecto de `f77d86c67baec208bae3f350faeee0ea2293502a`, cuyo db-tests y tipos están en verde**. No se exige otro CI verde por modificar solo la bitácora ni por esta entrega documental.
- `audit` ❌ [job 121420133822](https://github.com/cadeApp/cadeApp/actions/runs/40276459983/job/121420133822): Zod 3.25.76, `GHSA-mrhx-c7xc-m3w5` (alta). Es un bloqueo de CI real **externo al alcance de T-415**, encaminado por T-416, PR #555, todavía abierta/Draft. No silenciar el control ni modificar tests para pasar en verde.
- En este entorno **no hay checkout/dependencias de cadeApp ni red Git desde el contenedor**. No se ejecutaron `pnpm`, mutaciones TS nuevas, `merge-tree`, `analizar.mjs` ni E2E. Por esto los cuatro hallazgos figuran `arreglado-sin-verificar` en el registro (no `arreglado-verificado`), aunque la inspección y el CI sustentan las correcciones. El arnés propuesto está en `evidencia/comandos.md` y se declara **NO EJECUTADO**.
- E2E real de `online-couriers.spec.ts` pendiente contra develop **después de `migrate-develop`**, conforme a la ficha; su existencia no acredita ejecución. Promoción a staging/main queda a decisión de Lautaro073.
- **No hay nuevas decisiones 🔵.** El paso siguiente es resolver el audit en T-416 y completar verificación independiente ejecutable antes de afirmar `arreglado-verificado` o recomendar merge. No se aprobó ni mergeó #551.

## Instrucción de continuidad (sin correcciones de T-415)

No tocar `docs/revision-pr/**`, no abrir pruebas ficticias ni adulterar aserciones. Mantener T-415 sin cambios por el audit ajeno; ese fix vive en T-416. Cuando #555 esté mergeada, sincronizar el repositorio con commits normales y **merge** de `origin/develop` (sin rebase, --force ni amend), comprobar CI y solicitar verificación independiente de los casos H01/H02/H04. Solo exigir nuevo CI de código si cambia código: un commit puramente de bitácora/revisión no requiere nueva corrida verde. No ejecutar el E2E contra un esquema que todavía no tenga la migración.
