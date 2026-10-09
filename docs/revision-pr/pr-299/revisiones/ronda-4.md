# Informe independiente — PR #299 / T-339 — Ronda 4

**Fecha:** 2026-10-08 · **SHA de código inspeccionado:** `e3df20f5640af5d09c2ba3d9892214c87332cf28` · **Base de comparación original:** `a773c05cc488a1fc60bfb36512cdca35d12d1271`.

**Resultado de código T-339: sin nuevos bloqueantes de implementación. RESULTADO DE INTEGRACIÓN: NO MERGEAR TODAVÍA.** La rama está 11 commits detrás del `develop` actual y su CI `audit` está rojo en el HEAD inspeccionado; la causa de seguridad ya fue corregida en `develop` mediante PR #312, por lo que corresponde actualizar la rama con **merge normal de develop a la feature**, revalidar y recién entonces emitir veredicto final. La excepción E2E **A** del usuario continúa vigente, no significa que los E2E estén verdes.

## 1. Verificación remota de alcance

- PR #299 abierta, no mergeada; `mergeable: true`, sin hilos inline pendientes.
- Diferencia desde el commit de ronda 3 `18af8990aa4e9ff9fb7b7fef855952e23d18784f` hasta este SHA: **solo 3 archivos**: `supabase/tests/t339_fixed_price.sql`, `e2e/specs/fixed-price.spec.ts`, `docs/tasks/log/T-339.md`. No se tocó `docs/revision-pr/**` desde el agente ni migración ni permisos, políticas o umbrales.
- Ficha `docs/tasks/T-339.md` leída desde `develop`, sin reabrir alcance. Decisión anterior A sobre `src/ui/ui-system.test.tsx` se mantiene.
- Se inspeccionaron blobs y logs **del SHA exacto**; sin clonar o levantar Docker/Supabase, sin ejecutar SQL ni E2E privilegiados desde esta revisión. Mutaciones de estructuras solo EN MEMORIA (ver evidencia).
- La rama `develop` ya está en `f33d688ff2517ae8e37ed53ba1404a3f4968ec45` y `compare develop...HEAD` devuelve **behind_by=11**. `git merge-tree` real no fue ejecutado; GitHub dice mergeable pero hay que ejecutar el merge de origin/develop y resolver eventuales conflictos respetando ficha.

## 2. CI del HEAD exacto inspeccionado

Run: **37848782303**.

| Job / status | Evidencia |
|---|---|
| `db-tests` ✅ | Job `113556229038`: migraciones completas, `rpc_offers.sql ... ok`, `rpc_requests.sql ... ok`, `t339_fixed_price.sql ... ok`; 20 archivos, **1903 tests**, `Result: PASS`, nuevo pgTAP **48/48**. `pnpm db:types --local` y comparación de tipos finalizaron PASS |
| `unit` ✅ | Job `113556229393`: 125 files / **2004 Vitest** PASS y cobertura `rpc-fake.ts` ramas **90.04%** ≥90%; 75 pruebas workflows y 6 ADR PASS |
| `typecheck`, `lint`, `build`, `bundle-budget` ✅ | Todos success en este SHA |
| `audit` ❌ | Job `113556229496`: `pnpm audit --audit-level=high` exit 1. Dos avisos **críticos** nuevos para `handlebars` versión ≤4.7.9, vía `eslint-plugin-boundaries → @boundaries/elements → handlebars`, GHSA-8r5x-fm3f-whwj y GHSA-p8wg-vrv2-v86f. El parche es ≥4.7.10 |
| `Vercel` ✅ | Deployment succeeded |
| `e2e-preview` ⛔ no ejecutado | `BLOCKED / REQUIRES DEVELOP MIGRATION` por gate de seguridad que rechaza PR con migración en diff. **Opción A** del usuario autoriza validación después de aplicar esquema; no es éxito de Playwright |
| `approval-policy` ✅ | Solo verifica cumplimiento del mecanismo de informe, no sustituye esta auditoría independiente |

### Importante: audit es una falla heredada RESUELTA EN develop, no una regresión de T-339

Los archivos `package.json` y `pnpm-lock.yaml` **NO** están en los 3 cambios del autor ni se modificaron en T-339. El [issue #311](https://github.com/cadeApp/cadeApp/issues/311) fue resuelto mediante la [PR de seguridad #312](https://github.com/cadeApp/cadeApp/pull/312), **MERGEADA** a develop en `8fd2b67b9536`. Ahora `package.json` de develop fuerza `handlebars: 4.7.10` por `pnpm.overrides`, y **el check `audit` de ese commit es success** (run 37851911101, job 113566616105). Otros 10 commits adicionales entraron al mismo develop; la rama #299 sigue sobre la base anterior.

**Consecuencia:** no autorizar merge de PR #299 con su `audit` rojo. La solución NO es modificar `package.json`, lockfile ni workflows en el contexto del agente T-339, ni añadir otra excepción a auditoría: es **integrar el develop actual con merge normal, nunca rebase**, y volver a ejecutar CI sobre el HEAD resultante. Si `audit` continúa fallando, diagnosticarlo entonces sin esconder la vulnerabilidad. No duplicar issue #311 ni abrir otra PR de seguridad.

## 3. Revisión de H14, H15, H16

**H14 — CERRADO/verificado:** `supabase/tests/t339_fixed_price.sql:286` inserta `pg_temp.reset_actor()` después de las dos denegaciones CC-007, antes de los oráculos de ofertas, solicitud, accepted_offer y límites. Estos ahora inspeccionan bajo rol PostgreSQL y no como actor oculto por RLS; pgTAP test #23 que fallaba pasa como parte de 48/48. Mutación de inspección: eliminar `reset_actor` de copia en memoria vuelve RED el detector estructural; no afirmar ejecución de SQL mutado.

**H15 — CERRADO/verificado:** `supabase/tests/t339_fixed_price.sql:428–471` crea oferta real de courier2 llamando a `public.take_request` **antes** del `accept_offer` del courier1, sin INSERT manual ni bypass RLS; luego comprueba oferta ganadora `accepted` y perdedora `rejected`, y `ALREADY_MATCHED`. Plan pgTAP 48 aserciones; CI 48/48 PASS. Mutación de inspección: quitar el bloque `lives_ok(public.take_request)` en memoria vuelve RED el detector de preparación válida; no fingir mutación DB.

**H16 — CERRADO/verificado en cuanto a eliminación del test placebo:** el caso `H05.5` que no ejecutaba denegación fue **eliminado**, sin sustituirlo por un test falso; CC-007 sigue cubierto por SQL pgTAP real y unit tests. CI `typecheck` verde. Eliminar un placebo no demuestra E2E real de consentimiento, por eso H05 sigue diferido.

**H03/H04/H13**: pasan en la ejecución real de 48/48; H06 unit 90.04% PASS; H01/H09/H11/H12 permanecen resueltos sin cambios desde los SHAs previos. **H02/H08** siguen con verificación E2E pendiente, aunque la cobertura en SQL y contratos mejora. H10 permanece como mejora visual no bloqueante.

## 4. H05 y decisión A: no atribuir un PASS a un E2E skipped

El usuario aprobó en [comentario #6063240037](https://github.com/cadeApp/cadeApp/pull/299#issuecomment-6063240037) mantener el gate y diferir E2E hasta que `develop` tenga la migración. Eso acepta expresamente un orden de comprobación distinto, **no verifica los deadlocks**.

En `e2e/specs/fixed-price.spec.ts` se conservan 3 pruebas con llamadas concurrentes `Promise.all` mediante dos sesiones Supabase: doble `take_request`, doble `accept_offer` y cruce `submit_offer / take_request`. La prueba `available=false` es secuencial, no una carrera contra actualización simultánea. El DoD original también pide carrera contra suspensión concurrente y disponibilidad concurrente; **esas dos carreras no están demostradas**. Registrar los casos pendientes, y no declarar completada T-339 hasta comprobar realmente el resultado después de aplicar la migración.

**Comprobación de ruta de despliegue:** se verificó en `.github/workflows/migrate.yml` de `develop` que un push a develop activa `migrate-develop` con `pnpm supabase db push --yes` y comprobación de tipos; NO garantiza que luego se ejecute `e2e-preview` automáticamente: este último escucha deployments y asocia **PR abierta** sin migraciones. El workflow `deploy.yml` automático hacia staging/main **no** está conectado a la rama develop.

**Runbook mínimo después de autorización de merge:** observar `migrate-develop` sobre el SHA mergeado y comprobar schema; ejecutar Playwright real contra app + Supabase Develop compatibles, en un circuito autorizado (p.ej. PR de validación SIN SQL migratorio que dispare Vercel Preview/E2E después de aplicar el esquema, o procedimiento de validación controlado equivalente). Documentar SHA, entorno, log, 3 carreras y flujos UI. No poner en producción/staging ni dar T-339 por cerrada si falla. Si la migración o test falla, frenar publicación y aplicar procedimiento de recuperación/compensación; no prometer rollback automático de SQL.

## 5. Próximo paso técnico sin decisión nueva

**Acción para el agente (única):** `git pull origin feat/T-339-precio-fijo` (primero trae este informe) y ejecutar `git fetch origin && git merge --no-ff origin/develop` en `feat/T-339-precio-fijo`. Resolver conflictos si los hay respetando la ficha de develop y la revisión; no rebase ni force-push. Verificar `pnpm-lock.yaml` sincronizado con parche ≥4.7.10 y sin modificaciones intencionales de producto T-339; ejecutar typecheck/lint/test/coverage/build y checks de ficha, `git diff --check`; commit merge, push normal y proporcionar SHA. **Revisión R5** sobre nuevo HEAD, con audit y db-tests realmente verdes, para decidir preparación de merge de la PR bajo excepción A. El revisor no aprobó ni mergeó.

Ninguna decisión de producto nueva queda abierta: el parche de seguridad ya está integrado a develop y la excepción E2E A ya fue aprobada. Esta ronda deja el único bloqueo actual en sincronización/CI de la feature.

