# Evidencia — PR #67 (T-112) — Ronda 1

## Entorno

- **Worktree:** `c:\Users\El Yisus Pai\Desktop\Proyectos\cadeApp-rev67`
- **SHA:** `adf9fd7`
- **Node:** >=22.14.0
- **pnpm:** 10.28.0

## Checks locales

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
      Tests  227 passed (227)
```

### Prettier — source

```
$ npx prettier --check "src/features/requests/**"
Checking formatting...
All matched files use Prettier code style!
```

### Prettier — docs

```
$ npx prettier --check docs/tasks/T-112.md docs/tasks/log/T-112.md
Checking formatting...
[warn] docs/tasks/T-112.md
[warn] docs/tasks/log/T-112.md
Code style issues found in 2 files.
```

## Búsquedas de hallazgos

### H01 — text-success no definido

```
$ grep 'success' tailwind.config.ts
(sin resultados)

$ grep 'text-success' src/features/requests/components/create-request-form.tsx
304: <span className="text-success ml-3 ...">
377: <span className="text-success ml-3 ...">
```

### H02 — React.useState en vez de react-hook-form

```
$ grep 'react-hook-form' src/features/requests/ -r
(sin resultados)

$ grep 'React.useState' src/features/requests/components/create-request-form.tsx
(18 ocurrencias: líneas 48-96)

$ grep 'react-hook-form' package.json
39: "react-hook-form": "7.88.0",
```

### H03 — as unknown as AppSupabaseClient

```
$ grep 'as unknown as AppSupabaseClient' src/features/requests/ -r
actions.ts:21
queries.ts:32
```

### H05 — HTML select nativo

```
$ grep '<select' src/features/requests/components/create-request-form.tsx
255: <select
327: <select

$ grep 'react-select' package.json
27: "@radix-ui/react-select": "2.3.7",
```

## CI

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
