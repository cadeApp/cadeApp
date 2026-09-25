# Evidencia y comandos reproducibles — PR #95

## Ronda 4

**SHA revisado:** `513cad3f4528e5c7befbc0e2d92c31a39bbb7eae`

### CI #298

```text
typecheck     success
lint          success
unit          success
audit         success
build         success
bundle-budget success
db-tests      in_progress al momento de la revisión

unit:
Test Files 48 passed
Tests      453 passed
observability.test.ts: 19 / 164 ms
requests.test.ts:      37 / 127 ms
```

## H15 · cierre

El test corregido:

```ts
process.env.DISCORD_ERROR_WEBHOOK_URL = 'https://discord.com/api/webhooks/test/token'
setDiscordTimeoutForTesting(50)

expect(fetchSpy).toHaveBeenCalled()
expect(signalReceived).toBeDefined()
expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' })
```

y el mock no resuelve hasta recibir `abort`.

La bitácora registra:
- roja al quitar `signal`;
- roja por timeout al quitar `controller.abort`;
- verde al restaurarlos.

**Resultado:** H15 cerrado.

## H16 · frontera env degradada

Contrato del repo:

```text
AGENTS.md: Zod parsea toda frontera, incluidas variables de entorno.
.agents/rules/25-stack-y-patrones.md: variables privadas -> src/server/env.ts.
```

Código R4:

```ts
let webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL || undefined

const timeoutMs =
  options?.timeoutMs ??
  testDiscordTimeoutMs ??
  (process.env.DISCORD_ALERT_TIMEOUT_MS
    ? Number.parseInt(process.env.DISCORD_ALERT_TIMEOUT_MS, 10)
    : DEFAULT_DISCORD_TIMEOUT_MS)
```

`src/server/env.ts` sí valida `DISCORD_ERROR_WEBHOOK_URL`, pero no contiene `DISCORD_ALERT_TIMEOUT_MS`. `.env.example` tampoco documenta esa variable.

Prueba independiente de semántica usada para el riesgo:

```text
Number.parseInt('abc', 10) -> NaN
setTimeout(callback, NaN) en Node -> callback ~1 ms
```

### Mutación/control para el arreglo

Después de restaurar `serverEnv` como fuente productiva:

- el test H15 debe seguir configurando el webhook mediante un seam/mock de test;
- `fetchSpy` debe seguir siendo llamado;
- `signal` debe existir;
- quitar `signal` o `abort` debe volver roja la prueba.

No añadir una nueva variable productiva para resolver un problema exclusivamente de test.

## H04

Sin cambio: estado pendiente y DoD desmarcado. Requiere evidencia externa real, no pruebas unitarias.
