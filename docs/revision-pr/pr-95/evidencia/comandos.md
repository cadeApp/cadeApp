# Evidencia y comandos reproducibles — PR #95

**SHA revisado:** `56f9c968a797f41f23eaf2dc325e7554006f93f6`  
**Base:** `cd0e69dabd31aa6531fa212d47a90c47e86ef155`

## Estado de rama

Comparación GitHub `develop...feat/T-310-backups-observabilidad`:

- status: `ahead`
- ahead_by: 4
- behind_by: 0
- changed_files: 10

Todos los archivos modificados están dentro de la lista permitida de `docs/tasks/T-310.md`.

## CI del SHA exacto

GitHub Actions run `CI #287`:

```text
typecheck: success
lint: success
unit: success
  Test Files 47 passed (47)
  Tests      440 passed (440)
db-tests: success
  Files=8, Tests=1444
  Result: PASS
build: success
bundle-budget: success
```

La bitácora dice `454 tests` y `test:db n.a.`; por eso H08 es reproducible comparando la línea 32 con esta salida.

## H01 · Coordenadas/direcciones no redactadas

Inspección:

```bash
sed -n '14,30p;95,115p' src/server/observability/scrubber.ts
grep -nE 'pickup_address|dropoff_address|pickup_lat|pickup_lng|dropoff_lat|dropoff_lng'   src/server/observability/scrubber.ts
```

Resultado esperado en el SHA roto: el segundo comando no encuentra esas claves.

Prueba que debe agregarse:

```ts
const raw = {
  pickup_address: 'San Martín 123',
  dropoff_address: 'Belgrano 456',
  pickup_lat: -27.4332,
  pickup_lng: -65.6141,
  dropoff_lat: -27.441,
  dropoff_lng: -65.607,
}
expect(JSON.stringify(scrubPii(raw))).not.toContain('San Martín 123')
expect(JSON.stringify(scrubPii(raw))).not.toContain('-27.4332')
```

## H02 · Payload saliente no cubierto por tests

Mutación de control:

```diff
- extra: sanitizedContext,
+ extra: context,
```

y, para Discord:

```diff
- details: payload.details ? scrubPii(payload.details) : undefined,
+ details: payload.details,
```

Los tests actuales no afirman ausencia de PII en `fetch(... body)`; la prueba corregida debe quedar roja con cada mutación.

## H03 · Falso éxito sin webhook

Caso a probar:

```ts
delete process.env.DISCORD_ERROR_WEBHOOK_URL
const result = await sendTestAlert({ environment: 'staging' })
expect(result.ok).toBe(false)
```

En el SHA revisado, el fallback de `sendCriticalAlert` devuelve `ok: true`.

## H04 · Cronología del acta

```text
00:30 dump
00:35 alta de fila/objeto
00:45 inicia restore
RTO declarado: 11m45s
00:52 comprobación posterior
```

Dos imposibilidades:
- el dump de 00:30 no contiene una fila creada a 00:35;
- un restore de 11m45s iniciado a 00:45 termina ~00:56:45, no antes de la comprobación de 00:52.

## H05 · Roja no específica

Bitácora:

```text
FAIL Failed to resolve import "./index"
```

Eso vuelve rojas todas las pruebas por ausencia del módulo, pero no demuestra que cada test mate su regresión concreta.

Mutaciones mínimas para la nueva evidencia:
- quitar redacción de coordenadas;
- enviar `context` crudo;
- quitar llamada a alerta en unhealthy;
- quitar timeout;
- devolver éxito sin webhook.

Cada una debe tener una prueba que falle específicamente.

## H06 · Uptime sin timeout

Inspección:

```bash
sed -n '15,67p' src/server/observability/uptime.ts
```

No hay `signal`, `AbortController` ni `AbortSignal.timeout`.

Prueba requerida: mock de `fetch` que nunca resuelve + fake timers; al vencer el timeout debe retornar unhealthy e intentar la alerta.

## H07 · PITR

Fuente oficial consultada 2026-09-25:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/clone-project

El restore normal deja el proyecto inaccesible mientras se restaura; crear un proyecto nuevo es un flujo separado.

## H08 · Evidencia de checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:db
```

Para la ronda 2, pegar salida real o indicar explícitamente qué vino de CI. No marcar `test:db n.a.` cuando la tarea toca `src/server/**`.

## Decisiones registradas

- H09: Lautaro073 → Discord es el canal actual; no email.
- H12: Lautaro073 → no Sentry ahora; DSN/alternativa futura opcional.
- H10 y H11 siguen pendientes.
