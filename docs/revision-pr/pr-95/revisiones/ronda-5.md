# Informe de revisión — PR #95 / T-310 — Ronda 5

**Head SHA revisado:** `42936d102fa58e4edeea6b8e18b15ed63708e492`  
**Base:** `develop` @ `cd0e69dabd31aa6531fa212d47a90c47e86ef155`  
**Fecha:** 2026-09-25  
**Resultado:** **CON BLOQUEANTES (2)** — H16 técnico + H04 operativo · 0 decisiones pendientes

## Resumen

El agy corrigió correctamente la mayor parte de H16:

- eliminó `DISCORD_ALERT_TIMEOUT_MS`;
- mantuvo `DEFAULT_DISCORD_TIMEOUT_MS = 2500`;
- agregó `setDiscordWebhookUrlForTesting`;
- H15 sigue pasando por el webhook colgado con timeout corto;
- no tocó H04.

Sin embargo, H16 **no queda cerrado** porque la ruta productiva todavía contiene un fallback que evade la validación Zod.

## H16 · SIGUE ABIERTO

Código actual:

```ts
let webhookUrl: string | undefined = testDiscordWebhookUrl || undefined
let nodeEnv = 'development'

if (!webhookUrl) {
  try {
    webhookUrl = serverEnv.DISCORD_ERROR_WEBHOOK_URL || undefined
    nodeEnv = serverEnv.NODE_ENV || 'development'
  } catch {
    webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL || undefined
    nodeEnv = process.env.NODE_ENV || 'development'
  }
}
```

El problema ya no es el camino normal; es el `catch`.

### Por qué sigue violando el contrato

`serverEnv` no lanza solamente por Discord. Valida también, entre otras:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `DNI_HMAC_SECRET`;
- `CRON_SECRET`;
- `NODE_ENV`;
- `DISCORD_ERROR_WEBHOOK_URL`.

Si cualquiera está mal, `serverEnv` debe hacer visible una configuración inválida. Pero `sendCriticalAlert` captura ese error y vuelve a leer Discord/Node directamente desde `process.env`, convirtiendo el fallo de validación en una ruta paralela no validada.

Esto contradice explícitamente:

- `AGENTS.md`: Zod es fuente de verdad en toda frontera, incluidas env.
- `.agents/rules/25-stack-y-patrones.md`: env privadas se leen desde `src/server/env.ts`.

### Por qué los tests siguen verdes

`observability.test.ts` configura:

```ts
process.env.DISCORD_ERROR_WEBHOOK_URL = '...'
process.env.NODE_ENV = 'test'
```

pero no configura todas las variables privadas requeridas por `serverEnvSchema`. Por eso el `try` puede lanzar y los tests continúan gracias al fallback que precisamente queremos eliminar.

H15 ya no necesita ese mecanismo: usa `setDiscordWebhookUrlForTesting` y `setDiscordTimeoutForTesting`.

### Arreglo requerido

Sin ampliar scope:

1. eliminar por completo el fallback a `process.env` en `alerts.ts`;
2. producción debe obtener webhook y NODE_ENV solo desde `serverEnv`;
3. hacer que el seam de tests distinga:
   - “sin override” → usar `serverEnv`;
   - “webhook falso” → usarlo;
   - “ausencia explícita de webhook” → probar H03 sin consultar `serverEnv`;
4. adaptar `observability.test.ts` para usar esos seams en vez de mutar `process.env.DISCORD_ERROR_WEBHOOK_URL`;
5. agregar una prueba/mutación que demuestre que reintroducir el fallback a `process.env` vuelve roja la suite.

No tocar `src/server/env.ts`; está fuera de alcance y no hace falta.

## H04 · SIGUE PENDIENTE OPERATIVO

Sin cambios y correctamente mantenido en:

```text
PENDIENTE / NO VERIFICADO
```

Los DoD siguen desmarcados.

Solo Lautaro073 puede cerrarlo ejecutando el simulacro real con evidencia.

## CI del SHA R5

GitHub Actions **CI #301** sobre `42936d10`.

Resultado final del run exacto:
- typecheck ✅
- audit ✅
- build ✅
- unit ✅ — 48 archivos / 453 tests
- lint ✅
- bundle-budget ✅
- db-tests ✅ — 8 archivos / 1444 tests, Result: PASS

Tiempos relevantes:
- `observability.test.ts`: 19 tests / 155 ms
- `requests.test.ts`: 37 tests / 122 ms

La rama está 18 commits ahead y 0 behind respecto de la base auditada.

## Veredicto

La CI completa del SHA quedó verde. **No mergear todavía.**

- H16 sigue abierto para agy.
- H04 sigue abierto para Lautaro073.
- No hay decisiones pendientes.
