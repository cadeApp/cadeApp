# Comandos reproducibles — PR #237

## Ronda 1

**SHA:** `7d65e8649302a788a8f9c2cdbf28d72295f6666d`

La sesión tuvo acceso de lectura pero no checkout ejecutable. Ver `revisiones/ronda-1.md`.

## Ronda 2

**SHA:** `40929053157569b68ec19d06d74e63c168248eb1`

### Sincronización reproducida por GitHub

- `f8707abc..40929053157569b68ec19d06d74e63c168248eb1`: 3 commits adelante, 0 atrás.
- `develop..HEAD`: 6 commits adelante, 0 atrás.
- `docs/revision-pr/pr-237/revisiones/ronda-1.md` conserva SHA de blob `ca9e2fac...`.
- `hallazgos.jsonl` conservaba SHA de blob `a69cb2b5...` antes de este commit de R2.

### Limitación de ejecución

El contenedor de revisión no resuelve `github.com`, por lo que no fue posible crear un worktree ni repetir Vitest/mutaciones. No se registra un RED ficticio.

Intento de conectividad:

    git ls-remote https://github.com/cadeApp/cadeApp.git refs/heads/feat/T-325-unified-document-upload
    fatal: unable to access 'https://github.com/cadeApp/cadeApp.git/': Could not resolve host: github.com

### H01 — mutación a repetir en ronda final

Baseline:

    pnpm vitest run src/features/courier-onboarding/components.test.tsx -t "T-325"

Mutación independiente:

    # En handleOptionalUpload, antes del try, insertar temporalmente:
    setOptionalDocs((prev) => ({ ...prev, [kind]: undefined }));

Esperado: los cuatro casos `license|insurance × compresión|subida` deben quedar RED. Restaurado: GREEN.

### H02 — mutación a repetir en ronda final

Mutación independiente:

    # Quitar temporalmente focus-within:ring-2 de DocumentUploadCard

Esperado: los dos casos PR237-H02 deben quedar RED. Restaurado: GREEN.

### H03 — cierre visual

No tocar SQL/RLS. Crear una cuenta courier nueva desde `/register` en Develop, aceptar TOS/Privacy, iniciar sesión y abrir el onboarding. El registro llama `activate_account_consents`; CC-007 actualiza `consent_status='active'`.

Capturar:

    src/features/courier-onboarding/evidence/T-325/360-05-cargado.jpg

o equivalente a 390 px, mostrando archivo + «Cargado».

Actualizar el README de evidencia y la bitácora.

### Revalidación final

    pnpm vitest run src/features/courier-onboarding/components.test.tsx
    pnpm typecheck
    pnpm lint
    pnpm test
    git diff --check
    pnpm vitest run tools/verify-fichas.test.ts
    node .github/workflows/verify-workflows.test.mjs
    node docs/adr/verify-adr.test.mjs
    node docs/revision-pr/analizar.mjs verificacion

Cuando no queden bloqueantes, auditar también los logs de CI del SHA exacto.
