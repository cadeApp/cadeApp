# Evidencia y comandos reproducibles — PR #95

## Ronda 3

**SHA revisado:** `135f7fe120573a053a7e9127ad39b9e531e8120d`  
**Base:** `cd0e69dabd31aa6531fa212d47a90c47e86ef155`

### Estado de rama

```text
ahead_by: 11
behind_by: 0
changed_files: 26
```

### CI exacta #295

```text
db-tests      success
build         success
unit          success
typecheck     success
lint          success
audit         success
bundle-budget success

db-tests:
Files=8, Tests=1444
Result: PASS

unit:
Test Files 48 passed
Tests      453 passed
observability.test.ts: 19 tests / 147 ms
requests.test.ts:      37 tests / 54 ms
```

## H01

R3 agregó a la matriz:
`default_pickup_address`, `default_pickup_lat`, `default_pickup_lng`, `display_name`, `phone`, `vehicle_plate`, `storage_path`.

El test nuevo inspecciona el body Discord de un objeto anidado. La bitácora registra roja específica con `vehicle_plate` sin redacción.

**Resultado:** cerrado.

## H04

Estado documental correcto en R3:

```text
ESTADO DEL SIMULACRO: PENDIENTE / NO VERIFICADO
```

DoD correspondientes: desmarcados.

Corroboración externa disponible:
```text
Vercel cadeapp-staging: deployments=0, latestDeployment=null
Vercel cadeapp:         deployments=0, latestDeployment=null
Supabase conectado: no existe proyecto cadeApp/staging visible
```

**Resultado:** sigue abierto como DoD operativo. No pedir al agy que invente evidencia.

## H05

Los casos HTTP 500 y timeout ahora localizan el fetch Discord y afirman:

```ts
expect(discordCall).toBeDefined()
expect(discordBody.content).toContain('uptime_unhealthy')
```

La bitácora registra rojas específicas al eliminar cada dispatch.

**Resultado:** cerrado.

## H14

El helper incluye `AbortController`, `signal` y timeout configurable.

Prueba directa válida:
- beforeEach de `observability.test.ts` configura `DISCORD_ERROR_WEBHOOK_URL`;
- mock de fetch no resuelve hasta recibir abort;
- se llama `sendCriticalAlert(..., { timeoutMs: 50 })`;
- archivo completo pasa en 147 ms.

**Resultado:** helper cerrado.

## H15 · prueba de caller falsa

El test en `requests.test.ts`:
- NO configura `DISCORD_ERROR_WEBHOOK_URL`;
- NO afirma que `fetchSpy` haya sido llamado;
- solo exige `INTERNAL_ERROR` y `elapsed < 4000`.

CI no define la variable Discord y no hay `.env.test`. El archivo completo termina en 54 ms, imposible si el caso estuviera esperando el timeout productivo de 2500 ms.

### Prueba corregida esperada

```ts
process.env.DISCORD_ERROR_WEBHOOK_URL =
  'https://discord.com/api/webhooks/test/token'

const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
  expect(init?.signal).toBeDefined()
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () =>
      reject(new DOMException('Aborted', 'AbortError'))
    )
  })
})

const result = await callRequestRpc(/* publish_request que da INTERNAL_ERROR */)

expect(fetchSpy).toHaveBeenCalled()
expect(result).toEqual({ ok: false, code: 'INTERNAL_ERROR' })
```

Para evitar 2500 ms, inyectar el timeout de observabilidad en el camino testeado o extraer una opción/test seam; no bajar el default productivo solo para acelerar CI.

### Mutación de control

Quitar el timeout/abort del transporte debe volver roja la prueba del caller, no solo la del helper.

## Limitación

No hubo checkout local ejecutable en este entorno. La verificación runtime independiente usada aquí es la CI del SHA exacto y sus logs; las observaciones de H15 se apoyan además en los tiempos reales de ese job.
