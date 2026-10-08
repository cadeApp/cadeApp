# Evidencia reproducible — PR #309 / T-351

## Comprobación remota ejecutada por el revisor
```bash
gh api repos/cadeApp/cadeApp/commits/bf8069303a6428c4b84d10af5604cec18b09e5e9/status --jq '.statuses[] | {context,state,description,target_url}'
gh api repos/cadeApp/cadeApp/actions/runs/37740771482 --jq '{id,status,conclusion,run_attempt}'
gh api repos/cadeApp/cadeApp/actions/runs/37740771482/jobs --jq '.jobs[] | {id,name,conclusion}'
gh api repos/cadeApp/cadeApp/actions/jobs/113221577705/logs
gh api repos/cadeApp/cadeApp/commits/0a249a803a42db4e74b8ff6e7a435895f6f02fca/status --jq '.statuses[] | {context,state,description,target_url}'
```

RED real: `Error: Violaciones WCAG en idle`, `color-contrast`, 4 elementos `<span class="text-sm font-semibold text-primary">Subir</span>`, 2.29/2.39 < 4.5. GREEN: Vercel `Deployment rate limited`; no E2E. En CI del GREEN: unit `123 files / 1942 tests`, DB `19 files / 1854 tests` PASS.

## Mutaciones independientes sugeridas, **NO EJECUTADAS NI PRESENTADAS COMO RED**

M1 — solo `document-upload-card.tsx`: cambiar temporalmente `<label htmlFor={inputId}>` por `<label htmlFor={`file-input-inexistente-${kind}`}>`, conservar input `id={inputId}`, conservar expectations y count. El E2E debe fallar en `getByLabel(/DNI frente/i)` aun con 4 «Subir». Commit temporal a rama review, Preview, salida de RED, `git revert`, GREEN.

M2 — solo `identity-form.tsx`: hacer que `REQUIRED_DOCS.map` no renderice `DocumentUploadCard` de `dni_front`, sin cambiar los otros 3 ni expectations. El E2E debe fallar en `getByLabel(/DNI frente/i)` o count 4 (solo quedan 3). Commit, Preview RED, `git revert`, Preview GREEN.

Cada corrida debe registrar SHA y job real; el RED por falta de Preview o timeout no cuenta. Ningún cambio de expectations ni `.skip`, `.only`, fixtures, tags, `package.json`, lockfile, tokens, test T-309 o T-351 productivo. **Nunca crear tests falsos, mocks/adulteraciones para que den verde, ni reescribir el historial.**

```bash
git pull
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm test
git diff --check
git status --short
git ls-remote origin refs/heads/review/T-351-onboarding-axe
```

No se ejecutó Playwright local de esta rama; GitHub CI y los logs E2E remotos son la evidencia observada. No disparar workflows manuales. Tras dos mutaciones y restauración, solicitar ronda 2 y cerrar esta PR **sin mergear**.
