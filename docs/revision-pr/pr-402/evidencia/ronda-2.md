# Evidencia real, pruebas propuestas — ronda 2 PR #402

HEAD revisado `5e14b05c843fd8021881db5ef50a886e4d240a35`; fecha 2026-10-17. No se ejecutó Supabase local ni Docker en la sesión del revisor.

## Inspección de funciones y rutas

- `src/features/admin/components/publication-credits-dialogs.tsx:64-121`: fingerprint SHA-512 de Web Crypto, `sessionStorage` con `{key,createdAt}`, intento pendiente previo a RPC y limpieza al obtener resolución definitiva. La clave deja de ser sólo `useRef`.
- `src/features/admin/components/publication-credits-dialogs.tsx:345-374`: selector acumula páginas activas mediante `listPublicationPlansAction` y cursor.
- `src/features/admin/queries.ts:633-649`: cliente de sesión, sin service role, llama `adminListPublicationPlansRpc`.
- `src/server/rpc/admin.ts:515-528`: wrapper Zod para `admin_list_publication_plans` y mapping de retorno.
- `supabase/migrations/20261017200000_t369_admin_list_publication_plans.sql:9-80`: guarda AAL2, permisos, keyset SQL y cursor.
- `supabase/tests/t369_publication_credits.sql:1343-1586`: pgTAP de autorización/SELECT bypass/cursor 151 planes/activeOnly.

## Evidencia GREEN de terceros y límites

- [Run 39066490083](https://github.com/cadeApp/cadeApp/actions/runs/39066490083) y [run 39082622452](https://github.com/cadeApp/cadeApp/actions/runs/39082622452): autor documenta 29 nuevas aserciones pgTAP y PASS general. No se revisó aquí el log completo de mutaciones SQL porque el autor confirma que **no existen tales ejecuciones**.
- [Run del HEAD 39083269785](https://github.com/cadeApp/cadeApp/actions/runs/39083269785): typecheck, lint, unit, build, audit, bundle-budget PASS; db-tests in_progress al consultar. Se debe volver a comprobar antes de merge.
- La mutación del autor «R12, SQL sin assert_admin_aal2» solo chequeó el texto estáticamente, **no** ejecutó SQL mutado en PostgreSQL ni produjo fallo pgTAP; no hay acreditación RED runtime.

## Nuevos tests RED→GREEN requeridos

**H02 / fallo de transporte en no-show:** añadir test Vitest `merchantReportNoShowAction.mockRejectedValueOnce(new Error('network'))` en `trip-replace-courier-dialog.test.tsx` y verificar (sin depender de toast) un `role=alert` seguro dentro del diálogo abierto, reintento posible, nada de `republishTripAction`. Código actual sin catch => RED o excepción no contenida; corrección catch => GREEN. Mutante quitando catch => RED de la misma prueba, luego restaurar.

**H04 / SQL:** sobre base efímera con migración aplicada (nunca DB remota) mutar por separado la guarda de `assert_admin_aal2`, la concesión de SELECT de tabla y la cláusula de cursor; correr la misma `supabase/tests/t369_publication_credits.sql` o pgTAP focalizada idéntica y exigir fallos de aserciones de permiso/orden, no fallos de sintaxis. Restaurar y exigir PASS. Traer job logs de CI o comandos ejecutados en entorno efímero con SHA. La existencia de ramas mutantes preparadas no prueba ejecución.

## Verificación local no realizada (comandos para el autor)

```bash
git fetch origin && git switch feat/T-369-ui && git pull --ff-only origin feat/T-369-ui
git diff --check origin/develop...HEAD
pnpm typecheck && pnpm lint && pnpm test && pnpm build
pnpm supabase test db supabase/tests/t369_publication_credits.sql
node docs/revision-pr/analizar.mjs verificacion
```

**No** modificar el oráculo, las expectations, las pruebas para hacerlas pasar, CI, `.agents`, `AGENTS.md` ni la carpeta de revisión. No se requiere CI nuevo exclusivamente por la bitácora/revisión; sí después de cambiar código y cuando hay migración nueva.