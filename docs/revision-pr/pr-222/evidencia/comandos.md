# Evidencia reproducible — PR #222 / Ronda 1

**SHA funcional revisado:** `588439a8e3bf91ab76c7affa56b682034bdb8807`

## Sincronización / alcance

```text
base: develop@8ee022c2bf9166f6550b6973c5c4d8fd2413b9d2
head: 588439a8e3bf91ab76c7affa56b682034bdb8807
ahead: 1
behind: 0
mergeable: true

changed files:
docs/contracts/CC-018.md
src/ui/select.test.tsx
src/ui/select.tsx
```

Equivalentes CLI:

```bash
git fetch origin
git diff --stat origin/develop...588439a8e3bf91ab76c7affa56b682034bdb8807
git diff origin/develop...588439a8e3bf91ab76c7affa56b682034bdb8807
gh pr view 222 --repo cadeApp/cadeApp --json headRefOid,baseRefOid,mergeable,files
```

## CI del SHA revisado

GitHub Actions run: `37080138161` / run number **951**.

Jobs:

```text
unit          success
db-tests      success
build         success
lint          success
typecheck     success
audit         success
bundle-budget success
```

Unit, extracto:

```text
✓ src/ui/select.test.tsx (5 tests)
Test Files 114 passed (114)
Tests 1687 passed (1687)
```

Equivalente:

```bash
gh api repos/cadeApp/cadeApp/actions/runs/37080138161/jobs
```

## Vercel

Status publicado sobre el mismo SHA:

```text
context: Vercel
state: failure
deployment: dpl_CqVhLF7kG57bper8AXMYk7oPmG7E
errorCode: type_error
errorMessage: Command "pnpm run build" exited with 1
```

El deployment anterior de `develop@8ee022c2bf9166f6550b6973c5c4d8fd2413b9d2`:
`dpl_Zqi6KHioJK1Yiq83DYVqaZoyXqCV` → READY.

El endpoint de logs detallados del connector Vercel no estuvo disponible durante esta revisión, por lo que no se inventa una causa.

## Mutaciones

No se ejecutó una mutación runtime independiente por falta de clon ejecutable en el entorno connector-only.

La mutación declarada por el autor fue reintroducir un callback `onValueChange('')` posterior a la selección. Por inspección, la prueba principal afirma exactamente:

```ts
expect(onChange.mock.calls).toEqual([[ZONE_B]]);
```

por lo que esa mutación cambia la secuencia observada y debe volver rojo el caso. El archivo de pruebas sí fue ejecutado por CI del SHA revisado (5/5 GREEN).
