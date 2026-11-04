# Evidencia y comandos reproducibles — Ronda 1 PR #588

## Alcance comprobado por lectura

- SHA de revisión de código/documentación: `3abbc5c459f6692483c08494789f1771dabfd050`.
- Código: `d9012249f4d89d986f147dce5e2c4ab5b74c672a`. Diferencia hasta el SHA inspeccionado: **solo `docs/tasks/log/T-421.md`** (comparación de commits).
- Base de `develop`: `fb9a774a9dd6c3e8152ff045627c384d3ba139cc`.
- CI en `d9012249`: https://github.com/cadeApp/cadeApp/actions/runs/41858093436 — `typecheck`, `lint`, `unit`, `build`, `audit`, `bundle-budget`, `db-tests` con conclusión `success`. En el log final del job `db-tests`: `cc016... ok`, `cc043... ok`, `cc044... ok`, `Files=42, Tests=3394, Result: PASS`; `pnpm db:types` + `git diff --exit-code -- src/types/database.types.ts` ejecutados en CI.
- E2E: https://github.com/cadeApp/cadeApp/actions/runs/41858252151 — `resolve-preview` informó `BLOCKED / REQUIRES DEVELOP MIGRATION` y el job E2E fue `skipped`.
- `approval-policy`: figuraba `failure` antes de publicar el informe independiente; la revisión no afirma que se haya reparado.
- Fuente `H01`: `src/app/auth/confirm/route.ts:105-116`, consulta sin lectura de `error`.
- Fuente `H02`: `20261104200000_cc043_courier_application.sql:71-76`; la suite `cc043` no tiene llamada concurrente ni afirmación `pg_get_functiondef` del lock.
- Fuente `H03`: `cc016_request_offer_couriers.sql:81-92`; escritura directa con marca y `PLACA16`.

## Pruebas RED/GREEN prescritas — **NO ejecutadas por la revisión**

**H01, local:**
```bash
pnpm vitest run src/app/auth/confirm/route.test.ts
```
Test nuevo: mock `couriers` devuelve `{data:null,error:{message:'falló lectura'}}` para courier activo. Verificar que no redirige a `/courier/onboarding/identity`; `false` explícito sí. Mutación temporal: eliminar la rama de error y usar `courier?.application_submitted === true`; RED del test nuevo; restaurar GREEN.

**H02, CI pgTAP:**
```bash
# Control sin mutar en la rama real: `supabase/tests/cc043_courier_application.sql`
# En rama aislada review/T-421-lock, marcada REVIEW ONLY / NEVER MERGE:
# quitar SOLO "for update" del SELECT sobre public.couriers en la migración CC-043
# CI db-tests debe dar RED específicamente en la nueva aserción estructural
# cerrar PR aislada sin merge y borrar su rama; la rama T-421 mantiene código correcto
```
La aserción debería basarse en el cuerpo exacto de `pg_get_functiondef`, anclarse a la **misma sentencia** sobre `couriers` (no buscar el texto en toda la migración) y comparar posiciones de lecturas para exigir el orden. No aceptar una prueba que solo localice la cadena `FOR UPDATE` en cualquier lugar.

**H03, CI pgTAP:**
```bash
# Control: fixtures CC-016 con docs + RPC y nuevo ok(application_submitted AND submitted_at IS NOT NULL).
# Mutación aislada: sustituir la llamada RPC por el antiguo update directo con set_config.
# RED de la nueva aserción de envío; GREEN restaurando RPC y patente válida.
```
Se puede usar mutación local temporal para un RED si el fixture corre local; en este proyecto `db-tests` está en CI y por eso corresponde PR de mutación aislada. Nunca adulterar expectations, saltar mocks del camino productivo ni introducir `if (test)`.

## Chequeos después de corregir (autor)

```bash
pnpm vitest run src/app/auth/confirm/route.test.ts
pnpm typecheck
pnpm lint
pnpm test
git diff --check
# Confirmar CI db-tests sobre el SHA de código corregido, y adjuntar el run para cada RED.
# NO ejecutar comandos administrativos contra Supabase remoto ni disparar workflows manualmente.
# No exigir otro CI GREEN solo porque cambie la bitácora.
```

Después del merge y `migrate-develop`: verificar el E2E real por el proceso vigente CC-023. Esa verificación está pendiente y no se infiere de CI verde o Preview READY.

---

## Ronda 2 — Evidencia independiente consultada (2026-11-04)

**SHA solicitado:** `22d7d9c1018b7ce050fcbc05a51559ceaf0ccbbc`; **código:** `f3c43113a817523571796849135e9969a0889c7b`. El compare `f3c43113a817523571796849135e9969a0889c7b...22d7d9c1018b7ce050fcbc05a51559ceaf0ccbbc` devolvió solo `docs/tasks/log/T-421.md`; el compare `3393d51...22d7d9c1018b7ce050fcbc05a51559ceaf0ccbbc` devolvió seis archivos autorizados.

**CI GREEN en código:** https://github.com/cadeApp/cadeApp/actions/runs/41867741655
- `unit` job `126706282835`: `✓ src/app/auth/confirm/route.test.ts (30 tests)`; `Test Files 191 passed (191)`; `Tests 3508 passed (3508)`.
- `db-tests` job `126706282994`: `cc016_request_offer_couriers.sql ... ok`; `cc043_courier_application.sql ... ok`; `Files=42, Tests=3396, Result: PASS`.
- `build`, `typecheck`, `lint`, `audit`, `bundle-budget`: `success`; `db:types` regeneró y el paso `git diff --exit-code -- src/types/database.types.ts` terminó correctamente.

**H02 RED SQL (evidencia verificable):** PR https://github.com/cadeApp/cadeApp/pull/602, cerrada sin merge, commit https://github.com/cadeApp/cadeApp/commit/444e94c9755b0a43585b165571038c74c98a4792 (único cambio: `for update;` → `;` después de `where profile_id = p_courier_id`); CI https://github.com/cadeApp/cadeApp/actions/runs/41867747186, job `126706305657`: `# Failed test 5: "finalize bloquea couriers antes de profiles/documentos"`, `Tests: 85 Failed: 1`, `Result: FAIL`.

**H03 RED SQL (evidencia verificable):** PR https://github.com/cadeApp/cadeApp/pull/603, cerrada sin merge, commit https://github.com/cadeApp/cadeApp/commit/696bc2ee2062c9247eda8005cd31b8b21f17f3cb (único archivo `cc016`, RPC → `update` con marca); CI https://github.com/cadeApp/cadeApp/actions/runs/41867763829, job `126706366592`: `# Failed test 1: "fixture: doc2 envió su postulación por finalize_courier_application"`, `Tests: 25 Failed: 1`, `Result: FAIL`.

**H01 RED local:** bitácora reporta mutación `parseOnboardingComplete('courier', courier ?? null)` sin rama `courierError`, RED 1/30, GREEN 30/30. Se verificó la semántica por lectura del helper y de la ruta, pero **no se volvió a correr esa mutación en este entorno**. El CI sí ejecutó los 30 tests. No inventar un segundo RED ni un harness que no se ejecutó.

**CI HEAD (solo bitácora):** https://github.com/cadeApp/cadeApp/actions/runs/41869418827, build job `126712087520` FAILURE en `src/app/layout.tsx`/Google `next/font`, `TypeError: Cannot read properties of null (reading '1')` en `next/dist/compiled/@next/font/dist/google/loader.js:122`. Mismo árbol de código y dependencies que `f3c43113`; por eso no hay evidencia para imputarlo a los arreglos de T-421. Revisar gates efectivos antes del merge; no exigir nuevo GREEN solo por bitácora.

**Cosas NO ejecutadas por la revisión:** `pnpm` local, `git merge-tree`, `node docs/revision-pr/analizar.mjs verificacion`, Docker/Supabase local y batería de mutaciones independiente. No hay clon local disponible (DNS de github.com inaccesible desde la shell). JSONL validado como 3 objetos parseables y estados coherentes antes del commit. Las mutaciones originales de #602/#603 se inspeccionaron contra el diff real y se confirmó que las PR de mutación no fueron mergeadas.

**Comandos que sí puede reproducir quien tenga un worktree limpio:**
```bash
git fetch origin
git diff --stat 3393d51cd0563f5aadfea3d46fb161b4e18a8179..22d7d9c1018b7ce050fcbc05a51559ceaf0ccbbc
git diff --name-only f3c43113a817523571796849135e9969a0889c7b..22d7d9c1018b7ce050fcbc05a51559ceaf0ccbbc
git merge-tree --write-tree origin/develop 22d7d9c1018b7ce050fcbc05a51559ceaf0ccbbc
pnpm vitest run src/app/auth/confirm/route.test.ts
node docs/revision-pr/analizar.mjs verificacion
```
