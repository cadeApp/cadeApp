# Evidencia independiente — PR #295 Ronda 7

**HEAD funcional:** `a157fe48599600ccd65a5e52aa8a06ca1d692f8e`, previo `8c27939578d4e57eb8678382ba9828d389393cde`.
**Changed files en diff:** docs/tasks/log/T-338.md (+62 solo), e2e/specs/push-user-activation.spec.ts (+6/-46), src/features/notifications/install/standalone-navigation.test.tsx (timeout +30s).

**CI real:** https://github.com/cadeApp/cadeApp/actions/runs/37998095254
- audit success job 114049154393
- typecheck success 114049154487
- lint success 114049154661
- db-tests success 114049154666
- unit success 114049154689: 127 Vitest files passed
- build success 114049154767: First Load JS **/ 138, /legal 138, /login 169, /register 169 kB**
- bundle-budget success 114049580007
- Vercel success commit status.

**E2E Preview:** https://github.com/cadeApp/cadeApp/actions/runs/37998198367 — job 114049571940 failed. Summary **45 passed, 1 failed**. Only `pwa-standalone.spec.ts:100`: expected true, received false, 2 retries. Falla antes de `page.goto('/')`.
**Push** success explícito: `✓ 31 [chromium] e2e/specs/push-user-activation.spec.ts ... (10.2s)`; interfaz productiva y respuesta denegada stubbeada, userActivation nativo no falso. Copy esperado corregido; test data:/sleep eliminado. No se ejecutó mutación independiente RED del flujo productivo.

**Investigación de revisión:** Playwright `https://playwright.dev/docs/browsers#chromium-new-headless-mode` afirma que channel `chromium` usa modo headless nuevo con navegador real, separado de chrome-headless-shell. El workflow revisado usa `pnpm exec playwright install --with-deps chromium` y corre Chromium headless shell por defecto. Se propone probar `channel:'chromium',headless:true` en el spec antes de necesitar cambios CI/Xvfb; su compatibilidad PWA Linux NO ha sido ejecutada aquí.

No clon local, no Docker/Supabase, no comandos remotos destructivos, no pruebas en Android.
