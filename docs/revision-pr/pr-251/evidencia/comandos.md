# Evidencia y comandos — PR #251 · ronda 1

SHA revisado: afdb326128cef1972b42bb3822a43cbd468fbd61
Base develop: e2ff65cd29aee3292f280afc268b1c406fddc18c

## Sincronización y alcance

GitHub compare observado:
- ahead_by = 3
- behind_by = 0
- archivos del trabajo: docs/tasks/log/T-313.md y e2e/specs/merchant-registration.spec.ts

Reproducción:
git fetch origin
git diff --name-only origin/develop...origin/feat/T-313-merchant-registration-e2e
git rev-list --left-right --count origin/develop...origin/feat/T-313-merchant-registration-e2e

## H01 — enumeración de (merchant)

Comando:
find 'src/app/(merchant)' -name page.tsx -print | sort

Árbol observado:
- merchant/dashboard/page.tsx
- merchant/history/page.tsx
- merchant/onboarding/page.tsx
- merchant/plan/page.tsx
- merchant/requests/page.tsx
- merchant/requests/new/page.tsx
- merchant/requests/[id]/page.tsx
- onboarding/page.tsx
- requests/page.tsx
- requests/new/page.tsx
- requests/[id]/page.tsx

Lista actual:
sed -n '204,216p' e2e/specs/merchant-registration.spec.ts

Huecos:
- /merchant/history
- /merchant/requests
- /merchant/requests/<id>
- /onboarding
- /requests
- /requests/<id>

RED a demostrar cuando haya entorno: romper la guarda de una ruta hoy omitida, por ejemplo /merchant/history,
sin tocar el spec. El test actual puede seguir verde; tras ampliar la tabla debe quedar rojo.

## H02 — lifecycle/cleanup

sed -n '35,53p' e2e/specs/merchant-registration.spec.ts
sed -n '20,70p' e2e/fixtures/roles.ts

Caso perdido hoy:
testError != null + cleanupStagingData lanza cleanupError => cleanupError queda silenciado.

La corrección debe conservar ambos errores con E2E Lifecycle Error, siguiendo roles.ts.

## H03 — comandos obligatorios

sed -n '23,28p' docs/tasks/T-313.md
sed -n '25,33p' docs/tasks/log/T-313.md

Cierre requerido:
pnpm typecheck && pnpm lint && pnpm test

## H04 — RED/GREEN E2E

La bitácora declara 3 failed por entorno y dice expresamente “RED de ambiente, no de comportamiento”.

Vercel en PR #251:
Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")

Cuando haya Preview:
pnpm exec playwright test e2e/specs/merchant-registration.spec.ts --project=chromium --workers=1

Reglas del RED:
- no modificar expectativas para fabricar rojo;
- no crear tests falsos o alternativos para reemplazar el DoD;
- no usar emails reales;
- no cambiar Staging;
- romper la propiedad de producción;
- si no puede hacerse de forma segura, reportar el bloqueo y no inventar evidencia.

## D01

Develop/Preview: el E2E no depende de SMTP real.
Staging: conserva SMTP/sender configurado.

Si Auth de Develop falla por correo, se corrige el entorno Develop; no se debilita el spec.

## Validación

hallazgos.jsonl contiene 4 objetos JSON con estado abierto y verificado_en_sha = null.

Con clon local:
node docs/revision-pr/analizar.mjs verificacion
