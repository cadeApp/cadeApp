# Comandos reproducibles — PR #188

**SHA funcional revisado:** `86328317dd3d31f17a58e1d8a528bcc04ef810ee`

## Sincronización y alcance

```bash
git fetch origin
git rev-parse HEAD
git rev-parse origin/develop
git rev-list --left-right --count origin/develop...HEAD
git diff --name-only origin/develop...HEAD
git merge-tree --write-tree origin/develop HEAD
```

Observado en revisión: rama divergida, **26 detrás / 1 delante**; GitHub reporta mergeable. Ningún cambio de develop entre la base original y el develop actual pisa los archivos funcionales de T-324.

## RED del autor reproducido en CI #823

```bash
pnpm vitest run src/features/courier-onboarding/components.test.tsx src/features/courier-onboarding/queries.test.ts
pnpm typecheck
```

Resumen del job unit del SHA revisado:

```text
Test Files  2 failed | 109 passed (111)
Tests       5 failed | 1626 passed (1631)
queries.test.ts: Failed to resolve import "./queries"
```

Typecheck: falla porque `StatusViewProps` aún no tiene `documents` y porque `./queries` no existe.

DB job (sin Supabase local):

```text
All tests successful.
Files=13, Tests=1614
Result: PASS
```

## H01 · el wiring real no está bajo prueba

```bash
grep -n "StatusView" 'src/app/(courier)/courier/onboarding/status/page.tsx'
grep -R "CanonicalCourierOnboardingStatusPage" src --include='*.test.ts' --include='*.test.tsx'
```

En el SHA revisado, la página contiene `<StatusView />`; la segunda búsqueda no tiene un test T-324 que invoque esa página.

### Mutación a ejecutar tras el arreglo

Cambiar temporalmente:

```tsx
<StatusView documents={documents} />
```

por:

```tsx
<StatusView documents={[]} />
```

El test de la página debe quedar rojo. Revertir en memoria/sin commit.

## H02 · rejected

Tras agregar los tests, mutar temporalmente el mapper de estado para que `rejected` devuelva `Listo`. Los tests de obligatorio y opcional rechazado deben fallar.

## H03 · latest por uploaded_at

Comprobar en esquema:

```bash
grep -n -A14 "create table public.courier_documents" supabase/migrations/20260922031435_schema_v1.sql
```

No hay unique `(courier_id, kind)`.

Mutaciones después del arreglo:
1. `.order('uploaded_at', { ascending: false })` → `ascending: true`: el test de query debe fallar.
2. En la deduplicación, sobrescribir un kind ya visto: el resultado con histórico viejo/nuevo debe fallar.

## H04 · clase de obligatorios

Mutaciones después del arreglo:
1. DNI: `hasFront && hasBack` → `hasFront || hasBack`.
2. Avatar: devolver siempre estado loaded.

Los tests DNI parcial/avatar ausente deben quedar rojos.

## Checks finales para la próxima ronda

```bash
pnpm vitest run src/features/courier-onboarding/queries.test.ts src/features/courier-onboarding/components.test.tsx
pnpm typecheck
pnpm lint
pnpm test
git diff --check
git status --short
git diff --name-only origin/develop...HEAD
```

No correr Supabase/Docker local.
