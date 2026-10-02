# Comandos reproducibles — PR #188

## Ronda 1

Ver informe R1 para el RED original.

## Ronda 2 — SHA `c5964452bf1624669e69a56483bb5be4c8562139`

### Alcance del arreglo del autor

Entre el merge de develop `3e446958c3a842a67695b9d01b717f81e073ea3c` y el HEAD R2 solo cambiaron:

```text
docs/tasks/log/T-324.md
src/app/(courier)/courier/onboarding/status/page.tsx
src/features/courier-onboarding/components.test.tsx
src/features/courier-onboarding/components/status-view.tsx
src/features/courier-onboarding/queries.test.ts
src/features/courier-onboarding/queries.ts
src/features/courier-onboarding/server.ts
```

No se tocaron archivos de revisión por el autor.

### H01

```bash
grep -n "getCourierDocumentsStatus\|redirect('/login?redirectTo=/courier/onboarding/status')\|StatusView documents" \
  'src/app/(courier)/courier/onboarding/status/page.tsx'
```

La página real está cableada y `queries.test.ts` la invoca.

### H02 / H04

```bash
grep -n "H02:\|H04:" src/features/courier-onboarding/components.test.tsx
```

R2 cubre rejected para selfie/insurance, DNI parcial submitted y avatar ausente.

### H03

```bash
grep -n "select('kind, status, uploaded_at')\|order('uploaded_at'\|seenKinds" \
  src/features/courier-onboarding/queries.ts
```

Retorno público contiene solo `kind/status`.

### CI #853

Primer intento de build:

```text
src/app/layout.tsx
An error occurred in next/font.
TypeError: Cannot read properties of null (reading '1')
```

Se reintentó **solo el mismo job build**, sin cambios de código. Resultado del rerun:

```text
Build and capture route sizes: success
build: success
bundle-budget: success
```

Resto:
```text
typecheck: success
lint: success
unit: 111 files / 1642 tests PASS
db-tests: 13 files / 1621 tests PASS
audit: success
```

### H05 · reproducción lógica

Código actual:

```ts
const hasDni = Boolean(dniFront && dniBack);
let dniStatus: ItemStatus = 'pending';
if (hasDni) {
  if (dniFront?.status === 'rejected' || dniBack?.status === 'rejected') {
    dniStatus = 'rejected';
  }
}
```

Entrada:

```ts
[{ kind: 'dni_front', status: 'rejected' }]
```

Como `dniBack` no existe, `hasDni=false`; la rama rejected no se evalúa y queda `pending`.

El contrato existente del perfil ya cubre:

```ts
combineDniDocumentStatus('rejected', 'none') === 'rejected'
```

### Mutación requerida para H05

Después del arreglo, volver temporalmente a condicionar rejected a que ambos lados existan. Los dos tests:
- front rejected / back ausente;
- back rejected / front ausente;

deben quedar rojos.

## Checks para Ronda 3

```bash
pnpm vitest run src/features/courier-onboarding/components.test.tsx
pnpm typecheck
pnpm lint
pnpm test
git diff --check
git status --short
```

No correr Supabase/Docker local.

## Ronda 3 — SHA `a3d32c484898a83392d546ad55f95ba9ed3bba6f`

### Delta desde Ronda 2

```text
docs/tasks/log/T-324.md
src/features/courier-onboarding/components.test.tsx
src/features/courier-onboarding/components/status-view.tsx
```

Sin otros archivos modificados por el autor.

### H05

Código final:

```ts
if (dniFront?.status === 'rejected' || dniBack?.status === 'rejected') {
  dniStatus = 'rejected';
} else if (
  dniFront &&
  dniBack &&
  (dniFront.status === 'submitted' || dniFront.status === 'verified') &&
  (dniBack.status === 'submitted' || dniBack.status === 'verified')
) {
  dniStatus = 'uploaded';
}
```

Tests agregados:
- dni_front rejected + dni_back ausente → Observado;
- dni_back rejected + dni_front ausente → Observado.

### CI #859

```text
typecheck: success
lint: success
unit: 111 files / 1645 tests PASS
db-tests: 13 files / 1621 tests PASS
audit: success
build: success
bundle-budget: success
/courier/onboarding/status: 175 kB <= 180 kB
```

### Develop avanzó después de la implementación

La comparación contra develop actual mostró 9 commits nuevos y **0 archivos T-324 solapados**.

Archivos nuevos/modificados en esos 9 commits:

```text
.github/workflows/e2e-staging.yml
.github/workflows/verify-workflows.test.mjs
docs/tasks/T-303.md
docs/tasks/log/T-303.md
e2e/pages/login.page.ts
e2e/specs/main-flow.spec.ts
src/features/offers/queries.test.ts
src/features/offers/queries.ts
```

Antes del merge final:

```bash
git pull --ff-only
git fetch origin
git merge origin/develop
git diff --name-only origin/develop...HEAD
```

Esperar CI completo verde sobre el nuevo HEAD. No correr Supabase/Docker local.
