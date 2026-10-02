# Evidencia de comandos locales — PR #180 (T-307)

## pnpm typecheck
```
> cadeapp@0.1.0 typecheck
> tsc --noEmit && tsc --project .github/workflows/tsconfig.json
(código de salida: 0)
```

## pnpm lint
```
> cadeapp@0.1.0 lint
> next lint --dir src --file middleware.ts --max-warnings 0 && eslint --no-ignore --ext .mjs .github/workflows --max-warnings 0
✔ No ESLint warnings or errors
(código de salida: 0)
```

## pnpm exec playwright test e2e/specs/notifications.spec.ts --project=chromium
```
Running 2 tests using 2 workers

  ok 2 [chromium] › e2e\specs\notifications.spec.ts:5:7 › E2E: Notificaciones y Resiliencia (T-307) › con el permiso de notificaciones denegado la oferta aparece por tiempo real (832ms)
  ok 1 [chromium] › e2e\specs\notifications.spec.ts:93:7 › E2E: Notificaciones y Resiliencia (T-307) › offline muestra un aviso y al reconectar refresca sin perder el formulario (falla si se quita el refetch) (16.9s)

  2 passed (18.0s)
(código de salida: 0)
```
