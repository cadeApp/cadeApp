# Evidencia independiente R8 — PR295 / T-338

Revisión de HEAD funcional **`74fd2150c629b396ff9843cd285e70b93cbd42cb`**, R7 `a157fe48599600ccd65a5e52aa8a06ca1d692f8e`. Diff: 2 archivos, sin código productivo modificado.

**CI exacto:** https://github.com/cadeApp/cadeApp/actions/runs/38002801584
- lint job 114064627076: success
- build job 114064627176: success
- db-tests job 114064627255: success
- typecheck job 114064627276: success
- unit job 114064627280: success; Vitest 127 files passed
- audit job 114064627282: success
- bundle-budget job 114064989718: success
- Vercel status: success; `approval-policy` success

**Build First Load JS** (job 114064627176):
```
/          138 kB
/legal     138 kB
/login     169 kB
/register  169 kB
```
Cap: 180 kB, four within limit.

**Trusted Preview E2E:** https://github.com/cadeApp/cadeApp/actions/runs/38002879664
- resolve-preview success
- job `e2e-preview` 114064940200 success
- chromium: 46 passed (9.2m); pwa-standalone common browser passed (~0.6s); standalone true native passed (~1.0s); push user activation passed (~10.9s).
- global-settings: 3 passed (58.6s).
- report-preview-status success: published `e2e-preview=success` to `74fd2150c629b396ff9843cd285e70b93cbd42cb`.

**Código E2E inspeccionado**: `e2e/specs/pwa-standalone.spec.ts` abre Chromium full `channel:'chromium'` y `--app=${targetURL}`, instala addInitScript en appPage, navega a root y exige `matchMedia...standalone=true`, browser=false, redirect `/login`, wrapper display none y `landing_was_visible=false` sin CSS propio. El launch inicial `--app` ocurre antes de addInitScript y no queda observado; esta limitación se reserva al gate manual primer inicio.

**RED autor (NO re-ejecutado por revisor):** bitácora `docs/tasks/log/T-338.md`, mutó clase CSS de producto y registró `landing_was_visible=true`, restauró y pasó 2 E2E locales. El commit no contiene cambios productivos tras revertir; CI remoto confirmó verde.

**No ejecutado por revisor**: mutaciones propias, worktree pnpm, Chrome instalado Android, push OS nativo, proceso de actualización same-origin. No se consultaron secretos ni se tocó entorno develop.
