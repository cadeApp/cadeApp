# Evidencia reproducible — PR #222

## Ronda 1

**SHA funcional revisado:** `588439a8e3bf91ab76c7affa56b682034bdb8807`

### Sincronización / alcance

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

### CI del SHA funcional

GitHub Actions run: `37080138161` / run number **951**.

```text
unit          success
db-tests      success
build         success
lint          success
typecheck     success
audit         success
bundle-budget success

src/ui/select.test.tsx (5 tests) PASS
Test Files 114 passed (114)
Tests 1687 passed (1687)
```

### Preview inicial

```text
context: Vercel
state: failure
deployment: dpl_CqVhLF7kG57bper8AXMYk7oPmG7E
errorCode: type_error
errorMessage: Command "pnpm run build" exited with 1
```

El deployment anterior de `develop@8ee022c2bf9166f6550b6973c5c4d8fd2413b9d2`,
`dpl_Zqi6KHioJK1Yiq83DYVqaZoyXqCV`, estaba READY.

El endpoint detallado de logs del connector Vercel no estuvo disponible durante Ronda 1; no se inventó una causa.

### Mutación declarada por el autor

No se ejecutó una mutación runtime independiente por falta de clon ejecutable en el entorno connector-only.

La mutación declarada fue reintroducir un callback `onValueChange('')` posterior a la selección. La prueba principal afirma exactamente:

```ts
expect(onChange.mock.calls).toEqual([[ZONE_B]]);
```

por lo que la mutación cambia la secuencia observada. El archivo sí fue ejecutado en CI del SHA funcional, 5/5 GREEN.

---

## Ronda 2

**SHA verificado:** `bbe675a5d0516b3402f6f85c458b25c02ae56164`

El commit entre rondas contiene únicamente `docs/revision-pr/pr-222/**`; no cambia la implementación funcional.

### Preview fresco

```text
deployment: dpl_H7iXX1GGecoXGyEhZVYeEE7k3XVM
SHA: bbe675a5d0516b3402f6f85c458b25c02ae56164
state: READY
```

### CI

GitHub Actions run: `37080878590` / run number **952**.

```text
unit          success
db-tests      success
build         success
lint          success
typecheck     success
audit         success
bundle-budget success

src/ui/select.test.tsx (5 tests) PASS
Test Files 114 passed (114)
Tests 1687 passed (1687)
```

Conclusión: el fallo Vercel de Ronda 1 no reapareció sin cambios funcionales y se cierra como transitorio.
