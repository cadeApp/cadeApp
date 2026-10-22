# Evidencia independiente — PR #364 Ronda 5

**SHA auditado:** `d0924270b8da6aaefd087c336b7e330339053be0`, fecha 2026-10-16. Solo inspección código GitHub, compare y logs CI del autor. Revisor no ejecutó Supabase, Docker, SQL ni E2E.

- `develop...rama` ahead=26 behind=0; desde revisión R4 `4e153391166ac34e5de81aff665d9ce50bc97545` sin cambios en `docs/revision-pr/pr-364/**`.
- CI [38986094196](https://github.com/cadeApp/cadeApp/actions/runs/38986094196) sobre mismo SHA: unit **137 suites/2484 PASS**, db-tests **27 archivos/2406 pgTAP PASS**; CI runner B0 mutación RED 8/GREEN 4, C lock deadlock `40P01` RED/restaurado GREEN, C backfill mutación `uploaded_at+30` RED/restaurado GREEN. Son pruebas del autor en GitHub Actions.
- R06: migración C SQL 158–162 usa LIKE con `_` no escapado, RLS Storage v1 491–499 controla solo la carpeta; PgTAP C 425–460 no incluye objeto malnombrado existente. Resultado inferido, no reproducido. Prueba propuesta con `licenseX...` y `dniXfront_`.
- R07: C SQL 84–104 permite INSERT directo para tipo sin vigente; test C pgTAP 201–215 espera éxito. Índice UNIQUE no controla primer insert falso. Decisión humana A obliga revocar INSERT; prueba 42501/0 filas y control positivo B0/replace.
- GitHub status commit: **e2e-preview error BLOCKED / REQUIRES DEVELOP MIGRATION**, NO PASS. Staging/main no listos C según gates contractuales.
- Mutaciones R06/R07 y node analizar.mjs **NO ejecutados por el revisor**. Deben ejecutarse en CI efímero por agy con tests inalterados y salidas de RED/GREEN específicas.
