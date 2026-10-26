# Prompt de cierre para agy — PR #392 — Ronda 2

**Rama:** `release/CC-025-b-only-promote-staging-20261017`. **HEAD ACTUAL real:** `a53164916189e4b5d93f51cee285db24523747db`. **Código release sin cambios desde R1**. H01 documental subsanado; **NO SE REQUIEREN CAMBIOS DE CÓDIGO, SQL, TESTS O WORKFLOWS.** No aprobar/mergear/desplegar.

1. Actualizar estado de trabajo con `git fetch origin && git switch release/CC-025-b-only-promote-staging-20261017 && git pull --ff-only origin release/CC-025-b-only-promote-staging-20261017`. Leer `docs/revision-pr/pr-392/revisiones/ronda-2.md`. **No editar `docs/revision-pr/**`**, no nuevos commits de código, no rebase/amend/force.
2. **Modificar solamente el cuerpo de la PR #392**. Corregir el SHA completo ficticio `a5316491d9d9f52f3e07080fae9910d93ea6b6b7` por el HEAD real `a53164916189e4b5d93f51cee285db24523747db`. Aclarar `service_role` como rol técnico con `BYPASSRLS`, **no superusuario**. No simplificar ni omitir matriz de consumidores/rollback de CC026.
3. Al FINAL del body, agregar esta sección EXACTA, sin atribuir a agy la revisión independiente y conservando las cabeceras literales para `approval-policy`. La fuente de la opinión es la Ronda 2 publicada por revisor, no una autoevaluación:

### Informe de revisión de agy

Informe revisar-pr — T-356 — 2026-10-17 — generado por revisor independiente
Resultado: SIN BLOQUEANTES
Checks locales: no ejecutados por revisor; CI GitHub HEAD `a53164916189e4b5d93f51cee285db24523747db`: typecheck ✅ · lint ✅ · unit 135/2492 ✅ · db-tests 26/2341 ✅ · build ✅ · audit ✅
BLOQUEANTES:
- Ninguno en código ni migraciones de la promoción B-only, tras subsanar documentalmente PR392-H01.
MEJORAS:
- Corregir la referencia al HEAD completo de revisión en el body: `a53164916189e4b5d93f51cee285db24523747db` (no el SHA erróneo que figura actualmente).
- El rollback de Git/Vercel no revierte los grants de CC026. Mantener los controles STOP de staging.
No revisado / dudas para Lautaro073:
- Migraciones reales sobre Supabase staging, deploy/health/E2E del mismo SHA y verificación de ausencia de consumidores legacy: pendientes de autorización y ejecución post-merge.
- Este informe no es una aprobación ni autoriza promoción, merge o migración remota.


4. Al editar el body se disparará automáticamente `pull_request_target.edited` para `approval-policy`. Esperar resultado **SUCCESS**, reportar run y commit evaluado. Si falla, LEER el log y resolver únicamente el formato del body; no modificar scripts de policy ni checks. CI técnico del HEAD actual [39004412632](https://github.com/cadeApp/cadeApp/actions/runs/39004412632) ya pasó y no necesita inventar nuevas ejecuciones.
5. Entregar SHA real de rama `git ls-remote origin release/CC-025-b-only-promote-staging-20261017`, estado de approval-policy, URL de cuerpo PR y confirmar que base `staging` no cambió. No mergear #392/#364, no tocar staging/main/develop, no migraciones remotas, no deploy ni E2E falsos. Pedir revalidación final corta al revisor antes de que Lautaro073 decida autorizar la promoción.

**Prohibido:** editar `docs/revision-pr/**`, falsear tests, mocks, fixtures, SQL, expectativas, snapshots, gate/CI o afirmar una ejecución de E2E staging aún pendiente.
