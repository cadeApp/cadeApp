# Revisión PR #159 — T-321

- **PR:** #159 — `[T-321] Saneamiento del panel admin en staging: relaciones PostgREST y defaults operativos`
- **Rama:** `feat/T-321-admin-staging-bootstrap`
- **Base revisada:** `develop@9e232d0e4ef003ca0535b11e5a962b4cf603189a`
- **SHA revisado:** `66a83c1e39273d4c2e9448de60ef894432e50f9d`
- **Ronda:** 4
- **Fecha:** 2026-10-01
- **Resultado:** **SIN BLOQUEANTES**

## Estado

| ID | Tipo | Estado | Resumen |
|---|---|---|---|
| PR159-H01 | BLOQUEANTE R1 | arreglado-verificado | T-321 corre sin seed y el pgTAP quedó en 10 aserciones reales. |
| PR159-H02 | DECISIÓN | aceptado | Evidencia AAL2 post-merge/post-promoción. |
| PR159-H03 | BLOQUEANTE R2 | arreglado-verificado | El bypass textual quedó cerrado antes de reemplazar ese enfoque. |
| PR159-H04 | MEJORA R2 | arreglado-verificado | El cuerpo de la PR quedó alineado con la evidencia actual. |
| PR159-H05 | BLOQUEANTE R3 | arreglado-verificado | CI aplica T-321 sobre cinco valores preexistentes y demuestra que sobreviven intactos. |

## Verificación de ronda 4

- Desde `47a51994` hubo un único commit del autor: `66a83c1e`.
- Solo modificó `.github/workflows/ci.yml` y `docs/tasks/log/T-321.md`, ambos autorizados.
- La rama está **11 commits por delante y 0 por detrás** de `develop`; la PR está mergeable.
- CI run `36816282209`: **success** en typecheck, lint, unit, build, bundle-budget, audit y db-tests.
- En `db-tests`, `db reset --version 20260927120000 --no-seed` aplicó hasta la migración inmediatamente anterior a T-321.
- Se insertaron 5 valores personalizados; luego `supabase migration up` aplicó **exactamente** `20260930224700_t321_admin_staging_bootstrap.sql`.
- La comprobación posterior terminó en **`T321_PRESERVE_EXISTING GREEN`**.
- Después, base fresca sin seed: **Files=1, Tests=10, Result: PASS**.
- Suite DB normal: **Files=13, Tests=1611, Result: PASS**.
- Las mutaciones SQL M05/M06 se verifican como **inspección + CI verde** según la regla del proyecto: ambas cambiarían un valor personalizado y el bloque PL/pgSQL ejecutado por CI levantaría excepción.
- La revisión corrigió en el cuerpo de la PR la frase obsoleta “mutaciones en memoria” por la descripción del control runtime actual.

## Residual aceptado

D02=A sigue vigente: la evidencia manual AAL2 de `/admin/applicants`, `/admin/merchants` y `/admin/settings` se registra **después del merge a develop y de la promoción develop → staging**. No bloquea el merge de #159.

La evidencia está en [evidencia/comandos.md](evidencia/comandos.md).
