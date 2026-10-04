# Evidencia y comandos reproducibles — PR #242

## Ronda 1

SHA: `ddf7f5991257f98b2371f8f51659ea9d6e6d1c87`.

El contenedor no pudo resolver GitHub y no se inventó ejecución independiente. Ver `revisiones/ronda-1.md`.

## Ronda 2

SHA funcional: `3c469698bd551cd42022b3388562b935431e2999`.

### CI #1076

Unit/coverage:

    src/app/(courier)/courier/feed/page.test.tsx (3 tests) PASS
    Test Files 117 passed (117)
    Tests      1781 passed (1781)

Build:

    ✓ Compiled successfully
    /courier/feed  3.95 kB  159 kB

Bundle report:

    /courier/feed | 159 kB | OK

Workflow validators:

    verify-workflows: tests 49 · pass 49 · fail 0
    verify-adr:       tests 6  · pass 6  · fail 0

### E2E Preview

Run: `37160321196`

Status publicado:

    RESULT: success
    TARGET_SHA: 3c469698bd551cd42022b3388562b935431e2999

Chromium:

    1 flaky
    main-flow.spec.ts:431 T-303 Flujo 5
    primer intento: page.waitForURL timeout 30000 ms al salir de /login
    retry #1: PASS
    19 passed

Global settings:

    3 passed

El flaky quedó registrado en issue #245 y no se atribuye a T-325.

### Residual H04

No hay captura nueva ni sesión final:

    docs/tasks/log/T-325.md
    # última entrada: Hotfix inicial, antes de arreglar H01/H02/H03

    src/features/courier-onboarding/evidence/T-325/
    # no existe 360-06-feed-pending-real-docs.jpg

El cuerpo del PR sigue mostrando:

    pnpm test -> 1 failed | 1776 passed
    pnpm build -> /courier/feed 160 kB
    Pendiente -> Verificar en navegador

mientras el SHA actual ya tiene CI 1781/1781, bundle 159 kB y Vercel Ready.

### Cierre esperado

Sin cambios de código:

    git diff --check

Browser:
- Preview de `fix/T-325-feed-real-documents`;
- courier pending real;
- confirmar licencia/seguro según persistencia;
- confirmar ausencia de CTA hacia el mismo feed;
- confirmar que /courier/onboarding/status sí conserva el CTA;
- captura 360 px en evidence/T-325.

Después actualizar bitácora, README evidencia, DoD de hotfix y cuerpo de PR.
