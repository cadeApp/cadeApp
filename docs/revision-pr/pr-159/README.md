# Revisión PR #159 — T-321

- **PR:** #159 — `[T-321] Saneamiento del panel admin en staging: relaciones PostgREST y defaults operativos`
- **Rama:** `feat/T-321-admin-staging-bootstrap`
- **Base revisada:** `develop@9e232d0e4ef003ca0535b11e5a962b4cf603189a`
- **SHA revisado:** `ce5e3a19f3dfba71da4ccd47610b06beee3a2de2`
- **Ronda:** 2
- **Fecha:** 2026-10-01
- **Resultado:** **CON BLOQUEANTES (1)**

## Estado

| ID | Tipo | Estado | Resumen |
|---|---|---|---|
| PR159-H01 | BLOQUEANTE R1 | arreglado-verificado | El pgTAP ahora corre sin seed, quedó en 10 aserciones reales y CI mata M01/M02. |
| PR159-H02 | DECISIÓN | aceptado | La evidencia AAL2 en staging se hará post-merge/post-promoción. |
| PR159-H03 | BLOQUEANTE R2 | abierto | El checker de fuente acepta un `DO UPDATE` destructivo si la cadena `DO NOTHING` queda como comentario señuelo. |
| PR159-H04 | MEJORA R2 | abierto | El cuerpo de la PR todavía declara 11 aserciones/1612 tests; el estado actual es 10/1611. |

## Verificación de ronda 2

- Desde el commit de revisión `45c54d7`, el autor agregó solo 4 archivos autorizados: `.github/workflows/ci.yml`, `docs/tasks/T-321.md`, `docs/tasks/log/T-321.md` y `supabase/tests/t321_admin_staging_bootstrap.sql`.
- El autor **no tocó** `docs/revision-pr/pr-159/**`.
- `PR159-H01` sí mejoró de forma verificable: el CI del SHA revisado ejecutó primero T-321 con `--no-seed` y obtuvo **Files=1, Tests=10, Result: PASS**; luego el checker reportó `T321_MIGRATION_BASELINE GREEN`, `T321_M01 RED_OK` y `T321_M02 RED_OK`; la suite DB completa terminó **Files=13, Tests=1611, Result: PASS**.
- La batería independiente de la ronda 2 agregó **M03**, que cambia la cláusula real a `DO UPDATE` y deja `-- on conflict (key) do nothing;` como comentario. El checker actual devuelve `T321_MIGRATION_BASELINE GREEN`: el control todavía puede dar un falso verde.
- El pgTAP sin seed no compensa M03 porque parte de una base fresca: si no hay conflicto previo, `DO UPDATE` no se ejecuta y los cinco defaults quedan correctos.

La evidencia reproducible está en [evidencia/comandos.md](evidencia/comandos.md).
