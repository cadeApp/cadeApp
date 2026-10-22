---
name: nueva-migracion
description: >-
  Usar cuando una tarea de cadeApp de la zona de base (P1) cambia el esquema, las policies RLS o las
  funciones de Supabase.
---
# Nueva migración

1. `pnpm supabase migration new <nombre_en_snake_case>` (CLI fijada en devDependencies).
2. Escribí el SQL siguiendo `supabase/AGENTS.md` y `.agents/rules/30-supabase.md`.
3. Tests en `supabase/tests`: matriz RLS para tablas nuevas, test de cada RPC nueva, y verificá que
   `rls_enabled.sql` sigue pasando.
4. `pnpm supabase db reset` (local) && `pnpm test:db`. Rompé a propósito una policy y mostrá que un test falla.
5. `pnpm db:types` y commiteá `src/types/database.types.ts` en el mismo PR.
6. Si cambia un contrato usado por otra zona, no sigas: skill `contract-change`.
7. Marcá el checklist de seguridad del PR. Commit y push; antes del merge, rebase y `pnpm test:db` otra vez.
