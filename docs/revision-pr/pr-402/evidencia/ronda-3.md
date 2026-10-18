# Evidencia ronda 3 — PR #402 (T-369 UI / CC-029)

**SHA de código inspeccionado:** `cd573afbc4c7c6d895145eea26285ca0ee14ffad`. **Fecha:** 2026-10-17. No se ejecutaron Supabase, Docker ni PostgreSQL locales por regla de costos.

## Evidencia SQL auténtica en GitHub Actions, no simulada

- [Run CI 39087097148](https://github.com/cadeApp/cadeApp/actions/runs/39087097148), [job db-tests 117555836464](https://github.com/cadeApp/cadeApp/actions/runs/39087097148/job/117555836464), status SUCCESS en SHA inspeccionado.
- `Files=29, Tests=2764, Result: PASS` antes y después de mutar; controles de T-369 multisesión `8/8` GREEN; `pnpm db:types --local` y `git diff --exit-code -- src/types/database.types.ts` OK.
- Instrumento `supabase/tests/integration/t369_admin_list_plans_mutations.mjs`: lee la misma suite `supabase/tests/t369_publication_credits.sql`, exige `psql` finalizado sin errores de SQL/conexión/timeout, mismo plan TAP, fallas de aserción específicas, restore en `finally`, md5 y ACL restaurados, y una nueva ejecución GREEN después de **cada** mutación.

```text
[T369-D01B] baseline GREEN: 297 pruebas, 0 fallas
[T369-D01B] M1 sin assert_admin_aal2() RED: 6/297 fallas (UNAUTHENTICATED, 3 roles no autorizados, admin AAL1, precedencia)
[T369-D01B] M1 sin assert_admin_aal2() GREEN tras restaurar: 297 pruebas, 0 fallas
[T369-D01B] M2 grant SELECT a authenticated RED: 4/297 fallas (bypass + matriz original de privilegios)
[T369-D01B] M2 GREEN tras restaurar: 297 pruebas, 0 fallas
[T369-D01B] M3 sin predicado cursor RED: 4/297 fallas (cuatro invariantes de paginación)
[T369-D01B] M3 GREEN tras restaurar: 297 pruebas, 0 fallas
[T369-D01B] M3b solo sort RED: 4/297 fallas (cuatro invariantes de paginación)
[T369-D01B] M3b GREEN tras restaurar: 297 pruebas, 0 fallas
[T369-D01B] TODOS LOS CONTROLES DE MUTACIÓN D01-B OK (4/4)
Files=29, Tests=2764, Result: PASS
```

**Aclaración**: el registro T-340 que menciona timeout esperando un lock es una prueba negativa mutada de **otro** módulo; el harness T-340 declara RED esperado y comprueba GREEN tras restaurar (11/11 OK). No forma parte de D01-B.

## Corrección H02

- `src/features/trips/components/trip-merchant-container.tsx:39-65`: `merchantReportNoShowAction` está dentro de try/catch; excepción de red muestra un `getDomainErrorMessage('INTERNAL_ERROR')` persistente en diálogo si está abierto y evita redirección.
- `src/features/trips/components/trip-replace-courier-dialog.test.tsx`: nuevo test con `mockRejectedValueOnce(new Error('network'))`, error accesible, diálogo abierto, sin republicar, reintento explícito.
- [Job unit 117555836621](https://github.com/cadeApp/cadeApp/actions/runs/39087097148/job/117555836621): 145 archivos, 2739 tests PASS; typecheck, lint, build, audit, bundle-budget SUCCESS.

## Auditoría propia independiente del oráculo (sin ejecutar BD)

Se recuperaron los cinco archivos de código directamente del SHA inspeccionado y se ejecutó un instrumento propio de análisis estructural. Resultado: **14/14 propiedades presentes y 7/7 controles negativos textuales detectados**. Los controles negativos cambian **copias en memoria** de la fuente y confirman que el auditor detecta la pérdida de la guarda CI, baseline, mutante M1, condición de RED vacío, restore, catch no-show y test del rechazo.

El script independiente completo, reproducible con Node sin Docker sobre el SHA auditado, se agrega en [evidencia/comandos.md](comandos.md) al final. **No es un reemplazo de los RED SQL reales**: esa evidencia corresponde al job CI arriba enlazado, no a una DB propia de la revisión.

## Alcance, gating, seguridad

- Diff desde `dadc753`: exactamente 6 archivos: `.github/workflows/ci.yml` (+invocación runner), `supabase/tests/integration/t369_admin_list_plans_mutations.mjs` (nuevo), `trip-merchant-container.tsx`, test del diálogo, `docs/tasks/T-369.md` (ampliación limitada autorizada), bitácora T-369. Ninguna migración existente, política RLS, schema, modelo de dominio, fake o archivo de revisión cambió en el arreglo. Al principio de ronda 3 base `develop` SHA `0488f8a`, alineada con PR.
- Runner con `CI=true` y contenedor `supabase_db_*`; ninguna mutación sale de DB efímera. Borradas las ramas review mutantes según bitácora, no se usaron PR Draft.
- `approval-policy` falló sobre SHA auditado porque el bloque de informe independiente en body aún era placeholder. Se completa en esta ronda, sin alterar política.
- `e2e-preview` permanece en estado **error** `BLOCKED / REQUIRES DEVELOP MIGRATION` por la migración nueva no desplegada aún en Develop. **No** afirmar E2E verde ni deshabilitarlo. Las pruebas E2E/staging de T-369 pertenecen al paso 3/3, posterior al merge del paso UI. Cualquier requisito real de protección de rama debe respetarse al intentar merge, sin override técnico encubierto.
- Solo documentación de revisión añadida por ChatGPT. Según regla de PR, no exigir otro CI exitoso **solo por este commit documental**.

## Dictamen

Ronda 3 **SIN BLOQUEANTES de código identificados**, con límites de verificación explícitos. H01 y H03 `arreglado-sin-verificar`; H02 y H04 `arreglado-verificado` por instrumento independiente estático + constatación de logs reales de CI en SHA auditado; método exacto documentado. Decisión D01-B `aceptado`. No aprobar ni mergear sin pedido explícito.