# Informe revisar-pr — CC-031 / T-355 · PR #414 · ronda 1 · 2026-10-18

**Resultado: CON BLOQUEANTES (2)** · **1 mejora documental**.  
**SHA de implementación inspeccionado:** `44285a89618c2b8490e0def6ad239e1b7b5c9910`  
**Base develop:** `1958c9aba18543c233a8809385adb65adfd023f1`  
**Rama:** `cc/CC-031-courier-display-name-impl` (autor P1 Lautaro073).

## Aspectos correctos, por inspección

- Migración incremental nueva `supabase/migrations/20261018043250_cc031_courier_display_name_guard.sql` crea trigger `BEFORE UPDATE` en `public.profiles` y función `app_private.guard_courier_display_name_update()` con `SECURITY DEFINER`, `search_path = public, pg_temp`, chequeo de `TG_RELID/TG_OP/TG_WHEN/TG_LEVEL/TG_NARGS`, `OLD.role='courier'`, `auth.uid()=OLD.id`, comparación `NEW.display_name IS DISTINCT FROM OLD.display_name` y error constante `42501/COURIER_DISPLAY_NAME_IMMUTABLE`. El diseño no depende de `NEW.role` que el atacante intentara cambiar ni de un `WITH CHECK` que solo observe `NEW`.
- Revoca `EXECUTE` del helper a PUBLIC, anon y authenticated y no introduce grants, tablas, nuevas RPC públicas ni dependencias. El trigger afecta UPDATE de perfiles de courier propio, no el comercio ni admin ajeno al actor; no se detectó bypass obvio por inspección.
- Test de acceso directo comprueba rechazo de nombre solo y combinado con phone, no persistencia parcial, autorización/ownership/role/consent/created_at, ediciones merchant por UPDATE y RPC CC-028, admin y service_role. La suite `rls_coordinates.sql` pasó de `plan(24)` a `plan(26)` y cambió su aserción antigua para no pedir edición de nombre ahora prohibida.
- No se cambió una migración histórica. `e2e-preview` bloqueado por DB Develop sin migración se reconoce, no se presenta como E2E verde.

## BLOQUEANTES

### PR414-H01 · ALTO · Mutación no demostrada como RED real

**Lugar:** `supabase/tests/cc031_courier_display_name_guard.sql:143-157` (en especial `select isnt(` línea 147).  
Se deshabilita el trigger y la prueba evalúa `isnt(..., rechazo)`, que **pasa** cuando el guard está roto. El oráculo original `select is(..., rechazo)` de las líneas 46–48 no se vuelve a ejecutar sin alteraciones en un proceso de test que exija exit distinto de cero. La etiqueta «RED mutation» describe una prueba positiva del bypass, pero **no un RED observado de la aserción original**.  
**Impacto:** falta el control negativo independiente exigido por la ficha y la regla de pruebas; el job `db-tests` verde no suple esa evidencia.  
**Corrección:** ejecutar en un Postgres **efímero de CI** el mismo archivo pgTAP antes (GREEN), durante la mutación `ALTER TABLE ... DISABLE TRIGGER` (el archivo ORIGINAL debe producir FAIL específico, no usar `isnt` como sustituto) y después (GREEN). Capturar exit y resumen `Files/Tests/Result` de las tres ejecuciones; restaurar trigger con `trap` incluso ante error y nunca contra Develop/staging/prod. No adulterar expectativas ni modificar suites solo para que sean verdes.

### PR414-H02 · MEDIO · No hay concurrencia real

**Lugar:** `supabase/tests/cc031_courier_display_name_guard.sql:159-191`.  
Las pruebas etiquetadas «transiciones competidoras» ejecutan la actualización de teléfono, luego el rechazo del nombre; más tarde admin, luego courier; y finalmente revocación, luego courier. Todo ocurre **secuencialmente y en una conexión**, sin una segunda transacción simultánea, locks observados, waiters ni prueba de interleaving.  
**Impacto:** la ficha CC-031 exige probar dos escrituras concurrentes (ver `docs/contracts/CC-031.md`, «Concurrencia e idempotencia» y «Pruebas exigidas»). No concluyo que el trigger sea vulnerable; concluyo que el **control no certifica carreras reales**.  
**Corrección:** generar prueba multisesión en CI local, según harness existente `supabase/tests/integration/cc025_b0_concurrency.mjs` o `cc030_orphan_concurrency.mjs`. En sesión 1, `BEGIN; UPDATE public.profiles SET phone=...` bajo JWT de courier y **sin commit**; en sesión 2, emitir UPDATE del mismo perfil intentando `display_name`; comprobar espera de lock real usando `pg_stat_activity`, confirmar S1, y exigir que S2 falle con `42501`, persista phone y no altere el nombre. Cubrir admin/name contra courier/phone, y revocación/phone con sesiones solapadas y test de estado persistido. Añadir script a la suite de CI **solo después de ampliar formalmente la ficha CC** para incluir el nuevo archivo de integración y `.github/workflows/ci.yml`. El autor no tiene que inventar permisos ni alterar jobs en su propio beneficio. Un caso que resulte inseguro debe conservarse en RED y reportarse, no silenciarse.

## MEJORA

### PR414-H03 · BAJO · Contrato con estado histórico ambiguo

**Lugar:** `docs/contracts/CC-031.md:118-126` y apéndice posterior.  
La ficha termina declarando **«NO IMPLEMENTADO»**, `«este PR documental»` y rollout futuro, mientras que este PR #414 ya incluye la migración propuesta; el apéndice técnico no indica que la anterior nota se refería a la PR documental #413.  
**Corrección:** conservar la historia (no reescribir aprobación pasada), pero añadir encabezado de **estado actual**: «PR #413 ficha mergeada; PR #414 implementa la migración y está PENDIENTE de merge/validación». Al mergear #414, actualizar referencia de T-355 mediante paso documental coordinado; **no** marcar E2E realizado. No exigimos repetir CI solo por ese ajuste de bitácora/documentación.

## Evidencia, estados y límites

- **CI:** workflow `39099373503` en SHA `44285a89618c2b8490e0def6ad239e1b7b5c9910`, `typecheck`, `lint`, `unit`, `audit`, `build`, `bundle-budget`, `db-tests` SUCCESS. Vitest 145/145 archivos; `db-tests` 30 archivos / 2815 pgTAP, `Result: PASS`; generación `pnpm db:types --local` con `git diff --exit-code -- src/types/database.types.ts` exitoso. Otros FAIL intermedios en log son mutaciones esperadas de **otras** suites y están restauradas; no son evidencia RED independiente de CC-031.
- **GitHub/Vercel:** Vercel Preview success; `approval-policy` success; `e2e-preview` error/BLOCKED por falta de migración en Develop. No se exige E2E antes de aplicar la migración; sí revalidación posterior de PR #410 cuando esta se aplique.
- **No ejecutado por revisor:** clon/fetch local, `git merge-tree`, test propio pgTAP, Docker/Supabase local, concurrencia real y mutaciones; estos hallazgos son **por inspección + CI verde** y no se atribuyen como demostraciones runtime.
- **No hallazgos de producto/decisiones pendientes:** opción B del usuario ya documentada. Los bloqueos piden calidad/evidencia acordada, no otra decisión de producto. La ampliación de rutas de una suite nueva se coordina de acuerdo con el proceso, antes de implementarla.

## Veredicto

**CON BLOQUEANTES; no aprobar ni mergear.** Corregir H01 y H02 con evidencia nueva; H03 no bloquea por sí sola. Pedir ronda 2 independiente. La migración de CC-031 no debe marcarse aplicada en Supabase Develop mientras no sea mergeada por la vía de CI. PR #410/T-355 sigue necesitando segunda ronda y E2E propios.
