# Evidencia y comandos — PR #402 ronda 1

SHA auditado: `81f277970928dc50ddb1fcea709bf0319f9e6f64`. La ejecución de CI citada corresponde a ese HEAD; el commit de revisión posterior no cambia código.

## Evidencia directa

- H01: `src/features/admin/components/publication-credits-dialogs.tsx:39-51` usa `useRef` para `operationKey`, `GrantCreditsDialog` desmonta formulario en :83-92 y `RegisterPeriodDialog` hace lo mismo en :247-255; pruebas presentes sobre retry dentro del mismo montaje (merchant-credits-view.test.tsx:103-157). No se probó recarga.
- H02: `src/features/trips/components/trip-merchant-container.tsx:39-54`, solo `notify.error` genérico en rama de falla de `merchantReportNoShowAction`; `replaceError` solo se actualiza en `handleConfirmReplace`. Los tests del diálogo no ejercitan no-show fallido.
- H03: `src/features/admin/queries.ts:666-676` hace `.limit(100)` y retorna array sin cursor; dos consumidores tienen arrays estáticos (`publication-plans-manager.tsx:60-105`, `publication-credits-dialogs.tsx:262-275`).
- H04: `src/features/admin/queries.ts:633-675` verifica admin y AAL2 en la aplicación, luego lee con `createAdminClient`, sin RPC SQL; no se atribuye bypass confirmado. `docs/tasks/T-369.md` en el PR declara esta decisión supuestamente humana; CC-029 mergeado no tenía RPC de listado. D01-B elegida por el usuario.

## CI real — no repetir conjeturas

- https://github.com/cadeApp/cadeApp/actions/runs/39062365789
- `unit` job 117482862760: `Test Files 145 passed (145)`, `Tests 2718 passed (2718)`.
- `db-tests` job 117482862558: `Files=29, Tests=2735, Result: PASS`. Runner T369 `TODOS LOS ESCENARIOS MULTISESIÓN OK (8/8)`.
- `typecheck`, `lint`, `build`, `audit`, `bundle-budget` success en ese mismo SHA. E2E Preview pending al consultar. `approval-policy` fallo por ausencia del bloque de revisión.
- La bitácora del autor cita 16 mutaciones locales de UI, pero **no fueron reproducidas independientemente**, así que esta ronda no las atribuye al revisor.

## Casos RED→GREEN a construir y reproducir por agy

### H01

1. Emular una RPC que confirma el lote y pierde la respuesta; desmontar y volver a montar el diálogo, o recargar la página con `sessionStorage` real/mocado adecuadamente. La prueba debe exigir **el mismo operationKey** en el reintento del mismo merchant/tipo/payload. El código actual genera otro UUID (RED).
2. Resolver la operación: al recibir resultado definitivo, borrar clave pendiente. Una nueva compra **idéntica pero intencional** debe obtener un UUID nuevo. Si cambia merchant, tipo, cantidad, origen o nota debe tener distinta key, sin guardar texto libre de nota en storage.
3. Mutación NEGATIVA en memoria sobre el nuevo hook: eliminar restauración de sesión manteniendo misma prueba => falla; revertir => GREEN. No reescribir expectations.

### H02

1. Rechazo de `merchantReportNoShowAction` con `INVALID_STATE_TRANSITION`: debe quedar `role=alert` en el diálogo, con mensaje de dominio; no debe llamarse `republishTripAction` ni cerrar el diálogo. Versión actual tiene toast pero ningún alert (RED).
2. Mutación de nueva rama `setReplaceError(...)` temporalmente omitida, misma prueba => RED; restaurar => GREEN. También test de nuevo intento y cierre.

### H03

1. Fixture de 151 planes con sort duplicado e inactivos dispersos: comprobar páginas 50/50/50/1 con nextCursor y sin duplicación; selección activa en página 4 también accesible desde registro; `.limit(100)` actual omite filas (RED).
2. Mutación que reinstala corte 100 o hace ordenar por sort sin id -> misma prueba debe detectar pérdida/duplicación. Si en tests de UI se mockea la RPC, eso no sustituye pgTAP de consulta paginada.

### H04 / D01-B

1. pgTAP de permisos: `anon` y comercio no acceden; admin AAL1 no accede, admin AAL2 sí. Intentos directos SELECT para `anon` y `authenticated` se rechazan y RLS sigue activo. La función debe ejecutar `app_private.assert_admin_aal2()` al inicio y no aceptar de cliente `role/admin` ni claims editables como prueba.
2. Mutación que quita la llamada a `assert_admin_aal2` de migración efímera: exactamente mismas pruebas de autorización deben fallar por acceso indebido, luego volver verde. Mutación que concede SELECT directo a `authenticated`: pgTAP de bypass debe caer.
3. Test de frontera Zod con payload inválido, cursor parcial, limit 0/51; no permitir listar planes desde service role en query o RPC wrapper.

## Comandos para agy (NO ejecutados por revisor)

```bash
git fetch origin && git switch feat/T-369-ui && git pull --ff-only origin feat/T-369-ui
git merge origin/develop  # no rebase; resolver conflictos de forma explícita
git diff --check origin/develop...HEAD
pnpm db:types
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm supabase test db supabase/tests/t369_publication_credits.sql
node docs/revision-pr/analizar.mjs verificacion
git status --short && git rev-parse HEAD && git ls-remote origin feat/T-369-ui
```

Las pruebas SQL van en CI `db-tests` contra base efímera. No conectar ni alterar Supabase Develop/staging/producción manualmente. Registrar comandos, entorno, run URLs, SHA y resultados reales en `docs/tasks/log/T-369.md`.

**Regla obligatoria:** prohibido tests falsos, asserts adulteradas, `.skip`/`.only`, fake que evita el camino real, desactivar gates, fingir RED o escribir la carpeta `docs/revision-pr/pr-402/**` desde agy. Al añadir solo documentación de la revisión, no pedir nuevo CI green exclusivamente por ello.