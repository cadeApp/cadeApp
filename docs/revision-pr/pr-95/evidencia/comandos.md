# Evidencia y comandos reproducibles — PR #95

## Ronda 2

**SHA revisado:** `369756bd91a9757d3f97b420513e8b423d081881`  
**Base:** `cd0e69dabd31aa6531fa212d47a90c47e86ef155`

### Estado de rama

```text
develop...feat/T-310-backups-observabilidad
ahead_by: 8
behind_by: 0
changed_files: 25
```

### CI exacta

Run `CI #291` / `36096183341`: success.

```text
audit         success
typecheck     success
unit          success
lint          success
build         success
db-tests      success
bundle-budget success

db-tests:
Files=8, Tests=1444
Result: PASS
pnpm db:types --local -> generado exitosamente
```

## H01 · Enumeración completa de PII

Campos del esquema real que siguen fuera de `SENSITIVE_KEYS`:

```text
merchants.default_pickup_address
merchants.default_pickup_lat
merchants.default_pickup_lng
profiles.display_name
profiles.phone
couriers.vehicle_plate
courier_documents.storage_path
```

Prueba mínima a agregar:

```ts
const details = {
  default_pickup_address: 'San Martín 777',
  default_pickup_lat: -27.434,
  default_pickup_lng: -65.615,
  display_name: 'Persona Prueba',
  phone: '(03865) 481-234',
  vehicle_plate: 'AB123CD',
  storage_path: 'courier-uuid/dni_front.jpg',
}

await sendCriticalAlert({ type: 'test_alert', severity: 'critical', message: 'x', details })
const body = String(fetchSpy.mock.calls[0]?.[1]?.body)
for (const secret of Object.values(details)) expect(body).not.toContain(String(secret))
```

Mutación de control: retirar cualquiera de esas claves de la matriz debe volver roja la prueba.

## H04 · Evidencia del simulacro

El diff R2 únicamente reemplaza la cronología:

```text
00:20 crea fila/objeto
00:25 dump
00:30 purga
00:35 inicia restore
00:47 termina restore
00:50 comprueba
00:55 Discord
00:58 health
```

La secuencia es posible, pero el repo no contiene el hash SHA-256 real, transcript del restore, comprobación 404 ni referencia de recepción Discord.

Corroboración disponible en la conexión Vercel durante R2:

```text
cadeapp-staging: latestDeployment=null, deployments=0
cadeapp:         latestDeployment=null, deployments=0
```

Esto no demuestra no-ejecución si se usó otro entorno/cuenta; demuestra que el acta no queda corroborada por el entorno conectado.

Regla para el arreglo: **si no existe evidencia real, no fabricar otra acta**. Marcarla pendiente y desmarcar el DoD.

## H05 · Mutaciones

La bitácora afirma rojas individuales pero no contiene sus outputs.

Control que falta hoy:

```diff
// src/server/observability/uptime.ts
- await sendCriticalAlert({ type: 'uptime_unhealthy', ... })
+ // mutación: quitar dispatch
```

Los tests actuales de 500/timeout solo afirman `HealthCheckResult`, por lo que esta mutación no toca sus aserciones.

Prueba esperada:

```ts
expect(sendCriticalAlert).toHaveBeenCalledWith(
  expect.objectContaining({ type: 'uptime_unhealthy' })
)
```

Registrar comando + salida roja antes de restaurar la implementación.

## H14 · Webhook Discord colgado

Código actual:

```ts
const res = await fetch(webhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(discordBody),
})
```

No hay `signal` ni timeout.

Prueba requerida:

```ts
vi.spyOn(globalThis, 'fetch').mockImplementation((_url, init) =>
  new Promise((_resolve, reject) => {
    const signal = init?.signal as AbortSignal | undefined
    signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })
)

const result = await sendCriticalAlert(/* ... timeout corto de test ... */)
expect(result.ok).toBe(false)
```

Después, una prueba de caller debe demostrar que el `INTERNAL_ERROR` completa aunque Discord no responda.

## Hallazgos cerrados

H02, H03, H06, H07, H08, H10, H11 y H13 se verificaron contra `369756bd91a9757d3f97b420513e8b423d081881`. H09/H12 permanecen aceptados por decisión humana.

## Limitación de ejecución independiente

El checkout local del repositorio no estuvo disponible en este entorno de revisión. Por eso H01/H05/H14 se marcan [ANÁLISIS] y no [VERIFICADO] por ejecución local. La CI exacta del SHA y el job db-tests sí se verificaron vía GitHub Actions.
