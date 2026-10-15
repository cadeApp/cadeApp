# Evidencia reproducible — PR #337, ronda 1

**SHA funcional:** `a3c88ee3591b5ca6d5461dce5e96d21912941e5d`.

## Consultas de solo lectura ejecutadas por conector GitHub
- PR #337: metadata/changed files/patch.
- Green: https://github.com/cadeApp/cadeApp/actions/runs/38664397611; job db-tests 116192853626 (22 archivos / 2205 pruebas, PASS), unit 116192853547 (129 archivos / 2159 pruebas PASS).
- RED filtro: PR #338 https://github.com/cadeApp/cadeApp/actions/runs/38664433423; job 116192969060, fallan casos 6–8.
- RED guarda: PR #339 https://github.com/cadeApp/cadeApp/actions/runs/38664437244; job 116192980350, fallan casos 19–22.
- Blob inalterado de pgTAP `a2ce1c86c080d0794f7af3669db22b9faadc3645` en las tres ramas.
- `approval-policy`: FAIL (revisión independiente pendiente), checks de código SUCCESS.

## Reproducción de datos GitHub en un clon del proyecto (no altera el repositorio)

```bash
set -euo pipefail
git fetch origin
git diff --stat origin/develop...origin/fix/admin-merchants-count
git diff origin/develop...origin/fix/admin-merchants-count -- docs/tasks/log/T-340.md
git show a3c88ee3591b5ca6d5461dce5e96d21912941e5d:supabase/migrations/20261014180000_admin_merchant_delivered_counts.sql
git rev-parse a3c88ee3591b5ca6d5461dce5e96d21912941e5d:supabase/tests/admin_merchant_delivered_counts.sql
git rev-parse f137e9d5381efe2cad4279f40e720835423d7fb4:supabase/tests/admin_merchant_delivered_counts.sql
git rev-parse 9d5ad265af1a188b004cdfb8834b6cd2a6735ebe:supabase/tests/admin_merchant_delivered_counts.sql
```

## Batería independiente propuesta (NO EJECUTADA)
La batería real SQL requiere Postgres efímero del workflow; no se realizó en este entorno ni se considera RED verificado por el revisor. Los mutantes siguientes deben correr sobre la **misma suite pgTAP inalterada** en un CI temporal autorizado, nunca contra Supabase remoto ni modificando migraciones ya mergeadas:
1. Cambiar `status = 'delivered'` por `status = 'published'`: los conteos A/B/C deben fallar por valor de negocio.
2. Eliminar `revoke all ... from public, anon, authenticated`: el test de EXECUTE por anónimo o PUBLIC debe fallar por privilegio, sin abortar por sintaxis.
3. Sustituir el límite `cardinality(p_merchant_ids) > 50` por `> 51`: el caso de 51 IDs debe fallar por ausencia del rechazo.
4. Eliminar la validación `array_position(..., null)`: el caso de null interno debe fallar por ausencia del rechazo.

No inventar resultados RED ni pasarlos por equivalentes a pruebas ejecutadas.

## Herramientas locales que NO se ejecutaron aquí
`pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:db`, `pnpm db:types` y `node docs/revision-pr/analizar.mjs verificacion`. La evidencia se limita a inspección GitHub y logs de CI. No se usó Docker/Supabase remoto.
