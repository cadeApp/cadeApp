# Evidencia y comandos reproducibles — PR #95

## Ronda 6

**SHA revisado:** `c47c836f4e70b7fb37e70e7011ae164735379d81`

### Estado de rama

```text
ahead_by: 22
behind_by: 0
changed_files: 29
```

### CI #304 — resultado final

```text
build         success
db-tests      success
audit         success
lint          success
typecheck     success
unit          success
bundle-budget success

unit:
Test Files 48 passed
Tests      454 passed
observability.test.ts: 20 / 150 ms
requests.test.ts:      37 / 112 ms

db-tests:
Files=8, Tests=1444
Result: PASS
db-types: generado exitosamente contra Supabase local de CI
```

## H16 · cierre

Código productivo de `alerts.ts`:

```ts
if (testDiscordWebhookUrl !== undefined) {
  webhookUrl = testDiscordWebhookUrl === null ? undefined : testDiscordWebhookUrl
  nodeEnv = 'test'
} else {
  webhookUrl = serverEnv.DISCORD_ERROR_WEBHOOK_URL || undefined
  nodeEnv = serverEnv.NODE_ENV
}
```

No existe fallback a `process.env`.

`sendTestAlert` también usa `serverEnv.NODE_ENV` cuando no hay override.

La prueba H16:
- quita el override;
- deja una URL señuelo en `process.env`;
- exige rechazo de `serverEnv`;
- afirma que `fetch` no fue llamado.

La bitácora registra roja al reintroducir el fallback.

**Resultado:** H16 cerrado.

## H04

Sin cambio:

```text
PENDIENTE / NO VERIFICADO
```

DoD desmarcado. No es un defecto de código; requiere ejecución real en staging por Lautaro073.

### Evidencia mínima requerida para cerrar

```text
- SHA-256 del dump real
- salida/logs del restore
- verificación SQL post-restore
- 404 de courier-docs excluido/purgado
- recepción de alerta Discord
- /api/health 200 posterior
- RTO/RPO reales
```

## Resultado de R6

No quedan hallazgos técnicos abiertos. H04 es el único bloqueo de la PR.
