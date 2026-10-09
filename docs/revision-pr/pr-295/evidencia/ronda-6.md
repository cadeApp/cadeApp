# Evidencia PR295 — Ronda 6

HEAD funcional: `8c27939578d4e57eb8678382ba9828d389393cde`; anterior `64c0dfb012eeabd7b98686b37bd571433cd04817`. Diff: un commit / 4 archivos, nueva spec push autorizada A03=A.

**CI general:** https://github.com/cadeApp/cadeApp/actions/runs/37890749606 — éxito en lint 113690894810, typecheck 113690894576, unit 113690894839 (127 files), db-tests 113690894949, audit 113690894797, build 113690895002, bundle-budget 113691251485. Build por ruta: / 138, /legal 138, /login 169, /register 169 kB.

**E2E Preview:** https://github.com/cadeApp/cadeApp/actions/runs/37890833174 — job 113691212849 FAILURE 45 passed, 2 failed, dos retries cada uno.
1. `e2e/specs/pwa-standalone.spec.ts:100` → expected true, received false, consulta CSS mode antes de `page.goto('/')`.
2. `e2e/specs/push-user-activation.spec.ts:56` → Locator getByText(/Notificaciones bloqueadas/i) expected visible, element(s) not found; `PUSH_COPY.prompt.statusDenied` real inicia «Avisos bloqueados en el navegador».
3. Assert nativo userActivation true tras clic pasó antes de la aserción de copy; permiso denied fue interceptado adrede, no se probó concesión.
4. `e2e/specs/push-user-activation.spec.ts:59–104` incluye control artificial `data:`/6.5s; no constituye mutación de producto.

No testeé localmente ni en Android. Fuente de contexto técnico: https://github.com/microsoft/playwright/issues/26853 y https://playwright.dev/docs/api/class-page#page-emulate-media.

## Verificación tras corrección

```bash
git fetch origin && git switch feat/T-338-pwa-standalone && git pull --ff-only origin feat/T-338-pwa-standalone
pnpm lint && pnpm typecheck && pnpm test
set -o pipefail
pnpm build 2>&1 | tee /tmp/t338-r7-build.log
node /tmp/t338-budget-check.mjs /tmp/t338-r7-build.log
pnpm exec playwright test e2e/specs/push-user-activation.spec.ts e2e/specs/pwa-standalone.spec.ts --project=chromium
```

Esperar E2E Preview green **en SHA corregido** y anti-flash real desde CSS de producto, no hacks de test.
