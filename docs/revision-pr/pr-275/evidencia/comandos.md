# Evidencia y comandos reproducibles — PR #275

## Ronda 2 — H01

Diff nuevo desde el registro de decisión:

```bash
git diff c8daf3ae69e70f5bbfcbf40727c01df9fd807d05..bee887e9ee66313be532354b2ead22b4329f7a14 --   src/features/offers/queries.ts   src/features/offers/queries.test.ts
```

Resultado inspeccionado:

- enum inválido en SSR → `throw Error`;
- tests para `package_type` y `recipient_payment_method` → `rejects.toThrow`.

CI `unit` del HEAD → success.

## Ronda 2 — H03

`approval-policy` run `37409596878` → **success**.

## Ronda 2 — H04

Evidencia del propio body:

```text
Checks locales: ... test ✅ ...
pnpm test completo 1917 passed y 4 timeouts intermitentes
```

Evidencia de la bitácora:

```text
pnpm test completo → 1917 passed | 4 failed
```

Verificación requerida:

```bash
pnpm test
```

Solo si ese comando termina GREEN corresponde declarar `test ✅`.

## CI observado sobre bee887e

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- db-tests ✅
- bundle-budget ✅
- Vercel ✅
- e2e-preview ✅
- approval-policy ✅
- audit ❌ — advisories externos a T-343
