# Evidencia R4 — PR #295 / T-338

- PR exact HEAD: `3152af793d9bd42498e6b6a8600842979fd3aaaa`.
- Diff desde `0ffb370`: 1 commit, 7 archivos. No hay modificaciones de autor a carpeta de revisión.
- CI run: https://github.com/cadeApp/cadeApp/actions/runs/37873949380
  - `lint` job `113638078094`, `pnpm lint`: 4 `boundaries/element-types` feature→app en líneas 7-10 de standalone-navigation.test.tsx → exit 1.
  - `build` job `113638078182`: `Failed to compile` por los mismos 4 errores, exit 1. No salida final de route sizes.
  - unit `113638078087` success; `db-tests` `113638077921` success; typecheck `113638078139` success; audit `113638078108` success.
  - bundle-budget `113638348943`: skipped; no afirmar <=180 para este SHA.
- Status Vercel=failure; e2e-preview NO existe para SHA `3152af793d9bd42498e6b6a8600842979fd3aaaa`.
- E2E último run del SHA previo: https://github.com/cadeApp/cadeApp/actions/runs/37858651080 (44 pass/1 fail, tras 2 retries, `landing_was_visible=true`).
- Archivo R3 anterior entregado al usuario como MD, no publicado por falta de permiso; el comentario de decisión B sí existe en https://github.com/cadeApp/cadeApp/pull/295#issuecomment-6071177991.
- React.lazy referencia de caché: https://react.dev/reference/react/lazy (Promise cacheado y rechazo al Error Boundary).
- No ejecuté clon local, no Docker/Supabase, no inventé RED mutación propia ni Android humano.

## Comandos exigidos próximos

```bash
git fetch origin
git switch feat/T-338-pwa-standalone
git pull --ff-only origin feat/T-338-pwa-standalone
pnpm lint
pnpm typecheck
pnpm test
set -o pipefail
pnpm build 2>&1 | tee /tmp/t338-r4-build.log
# Usar control /tmp/t338-budget-check.mjs descrito en evidencia de R2:
node /tmp/t338-budget-check.mjs /tmp/t338-r4-build.log
```

Verificar que `pnpm lint` dé GREEN con las **cuatro aserciones de consumidores reales todavía activas**. Conservar prueba de error de chunk: mutar loader a rechazo controlado -> fallback visible -> recuperación real (demostrar caso rojo antes de corregir, verde después), revertir mutación temporal. E2E chromium native CDP + test E2E real en Preview, no sólo local. No cambiar gates ni suprimir expectativas para pasarlas.
