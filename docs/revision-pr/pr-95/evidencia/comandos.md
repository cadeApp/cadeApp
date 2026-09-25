# Evidencia y comandos reproducibles — PR #95

## Ronda 5

**SHA revisado:** `42936d102fa58e4edeea6b8e18b15ed63708e492`

### Estado de rama

```text
ahead_by: 18
behind_by: 0
changed_files: 28
```

### CI #301

```text
typecheck     success
audit         success
build         success
unit          success
lint          success
bundle-budget success
db-tests      in_progress al momento de registrar R5

unit:
Test Files 48 passed
Tests      453 passed
observability.test.ts: 19 / 155 ms
requests.test.ts:      37 / 122 ms
```

## H16 · residual exacto

Código:

```ts
try {
  webhookUrl = serverEnv.DISCORD_ERROR_WEBHOOK_URL || undefined
  nodeEnv = serverEnv.NODE_ENV || 'development'
} catch {
  webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL || undefined
  nodeEnv = process.env.NODE_ENV || 'development'
}
```

Reglas:

```text
AGENTS.md § env: Zod parsea toda frontera, incluidas variables de entorno.
.agents/rules/25-stack-y-patrones.md: variables privadas -> src/server/env.ts.
```

### Mutación de control esperada

Luego del arreglo, reintroducir:

```ts
catch {
  webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL || undefined
}
```

debe hacer fallar una prueba dedicada.

### Diseño de seam esperado

Un override triestado evita depender de env inválido en tests:

```ts
// idea de contrato, no implementación obligatoria:
undefined => sin override / usar serverEnv
string    => webhook de test
null      => simular webhook ausente
```

Así H03 puede probar “sin webhook” y H15 un webhook colgado sin crear rutas productivas alternativas.

## H04

Sin cambio. Requiere ejecución real de Lautaro073 y evidencia externa.
