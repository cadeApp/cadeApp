# Comandos reproducibles — PR #424

Estos comandos reproducen la evidencia que cita la ronda 1. Solo leen GitHub Actions y no modifican nada.

## CI verificado por la revisión (`cc7ddf4e`)

```bash
gh run view 39204975610 -R cadeApp/cadeApp --json jobs --jq '.jobs[] | "\(.name) \(.conclusion)"'
gh run view 39204975610 -R cadeApp/cadeApp --job 117908729571 --log | grep -E "cc032_request_cancellation_history.sql \.\.|Files=31|Result:"
```

- **En `cc7ddf4e`:** `cc032_request_cancellation_history.sql .. ok`, `Files=31, Tests=2868`, `Result: PASS`, y
  «Compare generated database types» con success.

## RED de pgTAP sin migración (declarado por el autor, `06b86873`)

```bash
gh run view 39204487690 -R cadeApp/cadeApp --job 117904244053 --log | grep -E "does not exist|planned 53|Result:"
```

- **En `06b86873`:** `function "public.get_request_cancellation_history(uuid, integer, timestamptz, uuid)" does not exist`,
  `You planned 53 tests but ran 0`, `Result: FAIL`.

## Batería local (la revisión no la ejecutó)

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
