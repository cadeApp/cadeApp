# Comandos reproducibles — PR #237

**SHA revisado:** 7d65e8649302a788a8f9c2cdbf28d72295f6666d

Ronda 1 tuvo acceso de lectura por conectores y no un checkout ejecutable. Por eso no se registra RED ejecutado por el revisor y no se apropia la evidencia MU1–MU7 del autor.

## Arranque reproducido

GitHub compare: status ahead; ahead_by 2; behind_by 0; base/merge-base e39569b59fa8203df9893dbb824cbc4a317d4181.
Vercel: deployment de 7d65e8649302a788a8f9c2cdbf28d72295f6666d READY en feat/T-325-unified-document-upload.

## H01 — matriz requerida para Ronda 2

Ejecutar:

    pnpm vitest run src/features/courier-onboarding/components.test.tsx -t "T-325"

Casos nuevos:
- license + compression rejects after previous success -> old path retained
- license + upload rejects after previous success -> old path retained
- insurance + compression rejects after previous success -> old path retained
- insurance + upload rejects after previous success -> old path retained

Mutación independiente: reinsertar temporalmente el setOptionalDocs(...undefined) previo al try. Los cuatro deben quedar RED; restaurado, GREEN.

## H02 — foco

Ejecutar la misma suite T-325 y comprobar navegador con Tab. Mutación independiente: quitar focus-within:ring-2 de DocumentUploadCard; el control debe quedar RED y el proxy visible perder foco.

## H03 — navegador

No modificar .github/** ni e2e/**. Usar Preview + flujo Develop autorizado. Evidencia mínima:
- 390 px: idle + loading
- 360 px: error/Reintentar + success/Cargado
- foco visible
- nota de targets >=48, overflow, contraste y reduced motion
- revisión Diseño + Frontend + Persona

## Revalidación final

    pnpm typecheck
    pnpm lint
    pnpm vitest run src/features/courier-onboarding/components.test.tsx
    pnpm test
    git diff --check
    node tools/verify-fichas.test.ts
    node .github/workflows/verify-workflows.test.mjs
    node docs/adr/verify-adr.test.mjs
    node docs/revision-pr/analizar.mjs verificacion

CI detallado recién sin bloqueantes.
