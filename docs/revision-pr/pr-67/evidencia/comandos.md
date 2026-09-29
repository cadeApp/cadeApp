# Evidencia — PR #67 (T-112) — Ronda 1 & Ronda 2

## Entorno Ronda 1
- **SHA:** `adf9fd7`

## Entorno Ronda 2
- **SHA:** `c014a95`

## Checks locales — Ronda 2

### typecheck
```
> cadeapp@0.1.0 typecheck
> tsc --noEmit && tsc --project .github/workflows/tsconfig.json
(sin salida = 0 errores)
```

### lint
```
> cadeapp@0.1.0 lint
> next lint --dir src --file middleware.ts --max-warnings 0 && eslint --no-ignore --ext .mjs .github/workflows --max-warnings 0
✔ No ESLint warnings or errors
```

### test
```
> cadeapp@0.1.0 test
> vitest run && node --test .github/workflows/verify-workflows.test.mjs && node --test docs/adr/verify-adr.test.mjs

 Test Files  25 passed (25)
      Tests  228 passed (228)
```

### build
```
> cadeapp@0.1.0 build
> next build
/requests/new Size: 130 B, First Load JS: 156 kB (presupuesto < 180 kB)
```

### Prettier — docs
```
$ npx prettier --check docs/tasks/T-112.md docs/tasks/log/T-112.md
Checking formatting...
All matched files use Prettier code style!
```

## Búsquedas de verificación de hallazgos

### H01 — text-success reemplazado
```
$ grep 'text-success' src/features/requests/components/create-request-form.tsx
(sin resultados)
```

### H03 — as unknown as AppSupabaseClient eliminado
```
$ grep 'as unknown as AppSupabaseClient' src/features/requests/ -r
(sin resultados)
```

## CI — Ronda 2

```
$ gh pr checks 67 --json name,state
[
  {"name":"approval-policy","state":"FAILURE"},
  {"name":"bundle-budget","state":"SUCCESS"},
  {"name":"db-tests","state":"SUCCESS"},
  {"name":"build","state":"SUCCESS"},
  {"name":"audit","state":"SUCCESS"},
  {"name":"typecheck","state":"SUCCESS"},
  {"name":"lint","state":"SUCCESS"},
  {"name":"unit","state":"SUCCESS"}
]
```
