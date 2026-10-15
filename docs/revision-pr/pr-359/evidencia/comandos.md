# Evidencia y comandos — PR #359 · ronda 1

**SHA leído en GitHub:** `65997dd27f652cf4d00aa616b1d26c46d16fd3e0`. **Base:** `14c28ed3c41cb2bde92705fc018c7dd0df73245b`. Fecha: 2026-10-15.

## Evidencia disponible [INSPECCIÓN REMOTA]

- Metadatos PR #359: Draft, 1 commit, 1 archivo cambiado, +13/-0 líneas.
- Diff: único archivo `docs/tasks/log/T-360.md`; sesión de inicio, todos los checks pendientes.
- Ficha de origen: `docs/tasks/T-360.md` desde `develop`.
- Lectura estática: feed, página SSR, query de viajes, offers, RLS, CC-023, T-340.

## Comandos para reproducir en un clon (NO ejecutados en esta sesión)

```bash
git fetch origin
git diff --name-only 14c28ed3c41cb2bde92705fc018c7dd0df73245b 65997dd27f652cf4d00aa616b1d26c46d16fd3e0
git diff --stat 14c28ed3c41cb2bde92705fc018c7dd0df73245b 65997dd27f652cf4d00aa616b1d26c46d16fd3e0
git show 65997dd27f652cf4d00aa616b1d26c46d16fd3e0:docs/tasks/log/T-360.md
git show 65997dd27f652cf4d00aa616b1d26c46d16fd3e0:src/features/offers/components/courier-feed.tsx
git show 14c28ed3c41cb2bde92705fc018c7dd0df73245b:docs/tasks/T-360.md
```

Resultado observado **mediante GitHub, no salida del shell**: un único archivo modificado (bitácora). No existen cambios de función/trips en la PR. No se inventan salidas de consola.

## Mutaciones

**No se ejecutaron ni se atribuyen mutaciones RED/GREEN**: todavía no existe código T-360 cuya propiedad se pueda romper. En ronda 2, sobre el SHA implementado, se deberá proporcionar batería completa independiente y reproducible, con salida real y restauración segura en memoria.

## CI

No evaluado como criterio de aprobación porque hay bloqueantes. `test:db` no aplica sin CC. No levantar Docker ni Supabase local.

## Comandos requeridos al autor

```bash
pnpm exec vitest run src/features/trips/queries.test.ts 'src/app/(courier)/courier/feed/page.test.tsx' src/features/offers/courier-panel.test.tsx src/features/offers/hooks/use-active-trips.test.tsx
pnpm typecheck && pnpm lint && pnpm test
git diff --check
git status --short
```

El autor debe guardar resultados verdaderos en la bitácora y entregar SHA nuevo para ronda 2.
