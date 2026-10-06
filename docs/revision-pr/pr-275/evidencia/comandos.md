# Evidencia y comandos reproducibles — PR #275

## PR275-H01 · enum inválido en SSR

Inspección del HEAD revisado:

```ts
const packageType = packageTypeSchema.safeParse(req.package_type);
const recipientPaymentMethod = recipientPaymentMethodSchema.safeParse(req.recipient_payment_method);
if (!packageType.success || !recipientPaymentMethod.success) {
  return { requests: [], nextCursor: null };
}
```

El test actual también espera:

```ts
expect(result.requests).toEqual([]);
```

Verificación esperada tras el arreglo: el caso inválido debe rechazar/lanzar y la ruta SSR debe poder activar `src/app/(courier)/courier/feed/error.tsx`.

## PR275-A01 · alcance

```bash
git show origin/develop:docs/tasks/T-343.md | grep -F "feed-privacy.test.tsx" || echo "NO AUTORIZADO EN DEVELOP"
git diff --name-only origin/develop...origin/feat/T-343-feed-canonical-vocabulary | grep -F "feed-privacy.test.tsx"
```

En el SHA revisado, el primer comando no encuentra el archivo en la ficha base y el segundo sí lo encuentra en el diff.

## PR275-H03 · approval-policy

Runs observados sobre el HEAD:

- approval-policy #1590 ❌
- approval-policy #1591 ❌
- approval-policy #1592 ❌

El workflow exige la sección `### Informe de revisión de agy` y los marcadores definidos por `hasCompleteReport()`.

## Batería CI observada

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- Vercel ✅
- e2e-preview ✅
- audit ❌ — advisories externos a T-343
