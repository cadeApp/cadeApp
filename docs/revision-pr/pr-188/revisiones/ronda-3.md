# Informe de revisión — PR #188 / T-324 — Ronda 3

**PR:** https://github.com/cadeApp/cadeApp/pull/188  
**SHA funcional revisado:** `a3d32c484898a83392d546ad55f95ba9ed3bba6f`  
**Fecha:** 2026-10-02

## Resultado

**SIN BLOQUEANTES FUNCIONALES.**

PR188-H05 quedó arreglado y verificado. Los cinco hallazgos acumulados quedan en estado `arreglado-verificado`.

La PR todavía **no se declara lista para merge inmediato** únicamente porque, al cerrar esta ronda, `develop` avanzó 9 commits respecto de la base que la rama había mergeado. Esos commits no solapan archivos de T-324, pero corresponde ejecutar CI sobre el árbol combinado final.

## PR188-H05 — arreglado-verificado

La lógica de DNI ahora tiene la precedencia correcta:

1. cualquier lado existente con `rejected` → `Observado`;
2. ambos lados presentes y cada uno `submitted|verified` → `Listo`;
3. resto → `Pendiente`.

Implementación observada:

```ts
let dniStatus: ItemStatus = 'pending';

if (dniFront?.status === 'rejected' || dniBack?.status === 'rejected') {
  dniStatus = 'rejected';
} else if (
  dniFront &&
  dniBack &&
  (dniFront.status === 'submitted' || dniFront.status === 'verified') &&
  (dniBack.status === 'submitted' || dniBack.status === 'verified')
) {
  dniStatus = 'uploaded';
}
```

Los RED nuevos cubren:
- frente rechazado + dorso ausente → Observado;
- dorso rechazado + frente ausente → Observado;
- en ambos casos no aparece Pendiente ni Listo.

La bitácora declara RED real, GREEN y mutación/restauración. El diff desde la Ronda 2 contiene exclusivamente:
- `src/features/courier-onboarding/components/status-view.tsx`;
- `src/features/courier-onboarding/components.test.tsx`;
- `docs/tasks/log/T-324.md`.

## Estado final H01–H05

| Hallazgo | Estado |
|---|---|
| H01 wiring de página real | arreglado-verificado |
| H02 rejected = Observado | arreglado-verificado |
| H03 latest por uploaded_at | arreglado-verificado |
| H04 obligatorios completos | arreglado-verificado |
| H05 DNI parcial rejected | arreglado-verificado |

## CI exacto del SHA R3

Run #859:

- typecheck ✅
- lint ✅
- unit ✅ **111 files / 1645 tests**
- DB ✅ **13 files / 1621 tests**
- audit ✅
- build ✅
- bundle-budget ✅

Bundle relevante:
- `/courier/onboarding/status` = **175 kB** / límite 180 kB → OK.

Los excesos reportados en rutas admin y `/design-system` son warnings preexistentes; el job concluyó success.

## Sincronización con develop

Al cerrar R3:

```text
HEAD T-324: a3d32c484898a83392d546ad55f95ba9ed3bba6f
develop:     163d4ade24c192e79e713b46ca9de4ec0aa02b7d
estado:      8 commits ahead / 9 behind
```

Los 9 commits nuevos de develop cambian únicamente:
- `.github/workflows/e2e-staging.yml`
- `.github/workflows/verify-workflows.test.mjs`
- `docs/tasks/T-303.md`
- `docs/tasks/log/T-303.md`
- `e2e/pages/login.page.ts`
- `e2e/specs/main-flow.spec.ts`
- `src/features/offers/queries.test.ts`
- `src/features/offers/queries.ts`

**No hay solapamiento con archivos funcionales de T-324.**

Por eso la sincronización pendiente es mecánica, pero debe ocurrir antes de mergear para que CI valide el árbol final.

## NO TOCAR

| Tema | Motivo |
|---|---|
| queries/page/server | Ya verificados en R2; H05 no requería tocarlos |
| Storage/RLS/migraciones | Fuera de alcance |
| Vehicle y consentimientos | Fuera de origen courier_documents |
| warnings de bundle admin/design-system | Preexistentes; no corresponden a T-324 |

## Próxima comprobación

Después de mergear `origin/develop` en la rama:
- confirmar que el merge es limpio y no cambia archivos T-324;
- esperar CI completo verde;
- si ambas cosas se cumplen, la PR queda **APTA PARA MERGE A DEVELOP** sin nueva modificación funcional.

## Metodología

Inspección independiente del SHA exacto, comparación del delta R2→R3, CI #859 y comparación explícita de develop actual contra la base ya integrada. No se levantó Supabase/Docker local.
