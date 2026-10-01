# Revisión PR #159 — T-321

- **PR:** #159 — `[T-321] Saneamiento del panel admin en staging: relaciones PostgREST y defaults operativos`
- **Rama:** `feat/T-321-admin-staging-bootstrap`
- **Base revisada:** `develop@9e232d0e4ef003ca0535b11e5a962b4cf603189a`
- **SHA revisado:** `680511dc625ce3fec4a65e0b7268a3a7a955512e`
- **Ronda:** 1
- **Fecha:** 2026-10-01
- **Resultado:** **CON BLOQUEANTES (1)**

## Estado

| ID | Tipo | Estado | Resumen |
|---|---|---|---|
| PR159-H01 | BLOQUEANTE | abierto | El pgTAP de bootstrap no prueba que la migración sea la que garantiza los defaults ni su `DO NOTHING`. |
| PR159-H02 | DECISIÓN | aceptado | La evidencia AAL2 en staging se hará post-merge/post-promoción, porque el flujo remoto aplica migraciones al pushear a `staging`. |

## Decisiones de Lautaro073

- **D01 = A.** Se acepta ampliar de forma mínima el alcance de T-321 para tocar `.github/workflows/ci.yml` y construir un control real sin seed sobre la migración, más un control de fuente que muta la migración en memoria.
- **D02 = A.** La evidencia real de `/admin/applicants`, `/admin/merchants` y `/admin/settings` queda como validación operativa post-merge/post-promoción a staging. No bloquea el merge de #159 una vez cerrado H01.

## Verificación positiva de esta ronda

- La rama estaba 3 commits por delante y 0 por detrás de `develop`; el merge base era el HEAD actual de `develop`.
- La migración `20260930224700_t321_admin_staging_bootstrap.sql` no existe en `develop`: no hay colisión de nombre/timestamp.
- Se enumeraron todos los embeds de `profiles` en `src/features/admin/queries.ts`: dos de couriers, uno de merchants y el compartido de auditoría. Los cuatro usan ahora la FK explícita correcta.
- Los nombres `couriers_profile_id_fkey`, `merchants_profile_id_fkey` y `audit_log_actor_id_fkey` existen en `src/types/database.types.ts`.
- Se reprodujo el RED previo de los embeds en el commit `118042c3`: **5 failed / 1520 passed**.
- En el SHA revisado, CI quedó verde; el job `db-tests` informó **Files=13, Tests=1612, Result: PASS**.

La evidencia reproducible está en [evidencia/comandos.md](evidencia/comandos.md).
