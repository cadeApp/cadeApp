# PR #295 — Evidencia de Ronda 5 (2026-10-09)

**HEAD funcional probado:** `64c0dfb012eeabd7b98686b37bd571433cd04817`. **Último R4:** `3152af793d9bd42498e6b6a8600842979fd3aaaa` (un commit, cinco archivos). Sin archivos nuevos o cambios del agente en carpeta `docs/revision-pr/**` para este HEAD.

## Checks ejecutados remotamente y verificados

- CI: https://github.com/cadeApp/cadeApp/actions/runs/37884330207
  - lint 113670818424: success.
  - typecheck 113670818230: success.
  - unit 113670818404: success; 127 Test Files passed (vitest).
  - db-tests 113670818373: success.
  - build 113670818402: success, next build produjo tabla de tamaños:
    - `/ 136 B 138 kB`;
    - `/legal 136 B 138 kB`;
    - `/login 149 B 169 kB`;
    - `/register 149 B 169 kB`.
  - audit 113670818513: success.
  - bundle-budget 113671135937: success.
- Vercel commit status success con despliegue https://vercel.com/lautaroj073/cadeapp-develop/6fJJvssmv1JbVPbRWmDJFQxx9Gw4.
- E2E Preview: https://github.com/cadeApp/cadeApp/actions/runs/37884413239 `in_progress`, status `pending` para `64c0dfb` al corte del informe. `repository_dispatch` head de workflow es develop; el target bajo prueba se resuelve a SHA de PR y se publica como commit status, no confundir ambos SHAs.

## Diff / inspección

- `e2e/specs/pwa-standalone.spec.ts:69-85` inserta style con `display:none !important` dirigido a la misma clase de producción que pretende observar. Comprobación del carácter potencialmente tautológico por inspección; no se ejecutó mutación independiente del CSS.
- `src/features/notifications/push.test.ts:728-775` instala `navigator.userActivation` simulado JSDOM; no es API nativa de Chromium.
- `src/features/notifications/index.ts` cambia retry por `window.location.reload()` y conserva reexports directos del módulo push, sin introducir await import antes del requestPermission.
- `standalone-navigation.test.tsx` vuelve a imports dinámicos; lint/build CI GREEN en SHA actual.

## Instrucciones reproducibles para R6

```bash
git fetch origin
git switch feat/T-338-pwa-standalone
git pull --ff-only origin feat/T-338-pwa-standalone
pnpm typecheck
pnpm lint
pnpm test
set -o pipefail
pnpm build 2>&1 | tee /tmp/t338-next-build.log
# Reutilizar validador fail-closed de cuatro rutas definido en evidencia de R2:
node /tmp/t338-budget-check.mjs /tmp/t338-next-build.log
pnpm exec playwright test e2e/specs/pwa-standalone.spec.ts e2e/specs/push-user-activation.spec.ts --project=chromium
```

No se ejecutaron estos comandos localmente por el revisor, ni test físico Android. Deben documentarse los resultados reales de Kira y validarse por separado contra CI del SHA nuevo.
