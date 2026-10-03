# Ronda 1 — PR #215 / T-329

**Fecha:** 2026-10-02  
**SHA revisado:** `9e57678f7a5b2b0e9bfc62a39ea3ab932afd54fe`  
**Base:** `721f6e0b0fcbab466ce97812c2a31694a2fbff88`  
**Merge-tree:** `4c1d184fd54b94f5c9a357c96f6357cfe03796e2`  
**Resultado:** SIN HALLAZGOS

## Alcance

Cinco archivos funcionales/documentales, todos dentro de T-329:

- `.github/workflows/e2e-preview.yml`
- `.github/workflows/verify-workflows.test.mjs`
- `docs/implementation-plan.md`
- `docs/tasks/T-329.md`
- `docs/tasks/log/T-329.md`

La rama estaba 2 commits ahead / 0 behind al revisar.

## Seguridad y comportamiento

El cambio agrega tres líneas al mismo step privilegiado `Run preview E2E gate`:

```sh
if [ -f e2e/specs/subscription.global-settings.spec.ts ]; then
  pnpm exec playwright test e2e/specs/subscription.global-settings.spec.ts --project=global-settings --workers=1
fi
```

No se movieron secrets al nivel job ni a pasos de instalación. El step ya estaba protegido por:

- resolución del SHA exacto desde código confiable de `develop`;
- PR interna del mismo repositorio;
- `environment: develop`;
- Supabase Develop positivamente identificado;
- `concurrency: cadeapp-develop-e2e`;
- `--workers=1`.

El gate core sigue ejecutando `smoke + main-flow (+ request-states si existe)` con `project=chromium`.

## RED real

Commit `00135b2`, CI #918 / run `37049987855`.

La prueba se agregó antes de implementar el workflow. El job unit falló exactamente en:

```text
preview E2E runs core specs plus optional request-states and global-settings against the resolved SHA and URL
ERR_ASSERTION:
T-306 global-settings must run serially when the exact Preview SHA contains the spec
```

Coverage, typecheck, lint, build y audit de ese commit eran independientes de la aserción y no invalidan el RED.

## GREEN

Commit `9e57678`.

CI run `37050313665`, attempt 2:

- unit/workflow tests: GREEN;
- typecheck: GREEN;
- lint: GREEN;
- audit: GREEN;
- db-tests: GREEN;
- build: GREEN;
- bundle-budget: GREEN.

El primer attempt de build falló en `next/font` por `TypeError: Cannot read properties of null (reading '1')`. El rerun del mismo SHA pasó sin cambios de código, por lo que se registra como transitorio y no como hallazgo de T-329.

Vercel: GREEN.

`e2e-preview` run `37050531814`: GREEN. T-329 no contiene el spec de T-306, por lo que el condicional correctamente no ejecutó `global-settings`; el gate core pasó.

## Conclusión

0 hallazgos. La infraestructura está lista para merge.

Después del merge, T-306 debe traer el nuevo `develop`, eliminar su implementación duplicada del workflow y generar un nuevo Preview. Ese nuevo run confiable será la primera evidencia real pre-merge de `subscription.global-settings.spec.ts`.
