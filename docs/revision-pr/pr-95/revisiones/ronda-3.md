# Informe de revisión — PR #95 / T-310 — Ronda 3

**Head SHA revisado:** `135f7fe120573a053a7e9127ad39b9e531e8120d`  
**Base:** `develop` @ `cd0e69dabd31aa6531fa212d47a90c47e86ef155`  
**Fecha:** 2026-09-25  
**Resultado:** **CON BLOQUEANTES (2)** · **0 decisiones pendientes**

## Resumen

R3 mejora correctamente tres de los cuatro bloqueantes técnicos de R2:

- H01 ✅ matriz PII ampliada y payload Discord probado;
- H05 ✅ uptime exige el dispatch `uptime_unhealthy` y hay rojas específicas registradas;
- H14 ✅ el helper Discord tiene timeout real y prueba directa de webhook colgado.

H04 también fue corregido en cuanto a **honestidad documental**: el acta ya no afirma una ejecución inexistente y el DoD fue desmarcado. Pero por definición sigue abierto hasta que Lautaro073 ejecute el simulacro real.

La única regresión técnica nueva es H15: el test que pretende demostrar el timeout desde `publish_request` no configura el webhook y puede pasar sin entrar en `fetch`.

## H01 · CERRADO

`scrubber.ts` ahora cubre los campos sensibles detectados en R2:
`default_pickup_address`, `default_pickup_lat/lng`, `display_name`, `phone`, `vehicle_plate`, `storage_path`, además de pickup/dropoff y coordenadas genéricas.

El test nuevo construye un objeto anidado y afirma sobre el body real enviado a Discord. La bitácora registra una roja específica al retirar `vehicle_plate`.

**Estado:** arreglado-verificado en `135f7fe1`.

## H04 · SIGUE ABIERTO, PERO YA NO ES UN DEFECTO DEL AGY

El acta ahora dice explícitamente:

```text
PENDIENTE / NO VERIFICADO
```

y los dos DoD asociados están correctamente desmarcados. Esto es el comportamiento esperado mientras no exista evidencia externa.

La conexión disponible sigue mostrando:
- Vercel `cadeapp-staging`: 0 deployments, `latestDeployment: null`;
- Vercel `cadeapp`: 0 deployments, `latestDeployment: null`;
- Supabase conectado: no aparece un proyecto cadeApp/staging.

Esto no demuestra que otro entorno privado no exista, pero sí confirma que desde la infraestructura conectada a esta revisión no se puede verificar el simulacro.

**Para cerrar H04:** Lautaro073 debe ejecutar el protocolo real y registrar al menos hash del dump, logs/transcript de restore, 404 del objeto purgado y recepción de la alerta Discord.

Hasta entonces T-310 **no cumple su DoD completo y la PR no debe mergearse**.

## H05 · CERRADO

Los tests de 500 y timeout ahora buscan explícitamente una llamada a Discord y comprueban que el body contenga `uptime_unhealthy`.

La bitácora incluye rojas concretas para:
- retirar el dispatch en HTTP 500;
- retirar el dispatch en timeout.

CI exacta #295 queda verde con esas protecciones.

**Estado:** arreglado-verificado.

## H14 · HELPER CERRADO

`sendCriticalAlert` usa:
- `AbortController`;
- `signal` en el `fetch`;
- timeout configurable;
- default de 2500 ms;
- retorno `ok:false` al abortar.

El test directo H14 en `observability.test.ts` sí configura Discord, simula un `fetch` que no resuelve y usa `timeoutMs: 50`. Ese archivo completo terminó en 147 ms en CI, coherente con que el timeout corto sí fue ejercitado.

**Estado:** timeout del helper arreglado-verificado.

## H15 · El test de caller de H14 es un falso positivo

**Archivo:** `src/server/rpc/requests.test.ts`  
**Severidad:** alta · P08

El test dice demostrar:

> `publish_request completa devolviendo INTERNAL_ERROR aunque el webhook de Discord quede colgado`

pero no configura `DISCORD_ERROR_WEBHOOK_URL` y tampoco afirma que `fetchSpy` haya sido llamado.

En CI:
- el job unit no define `DISCORD_ERROR_WEBHOOK_URL`;
- no existe `.env.test` en el repo;
- `.env.example` no se carga como entorno de test;
- todo `requests.test.ts` (37 tests) termina en **54 ms**.

El timeout real por defecto de Discord es **2500 ms**. Por lo tanto ese test no pudo haber esperado un webhook colgado durante el timeout real: `sendCriticalAlert` salió antes por “webhook no configurado”.

### Mutación que sobrevive

Si `sendCriticalAlert` retorna inmediatamente antes de llamar a `fetch`, o si la prueba queda sin webhook, las aserciones actuales siguen pasando:

```ts
expect(result.code).toBe('INTERNAL_ERROR')
expect(elapsed).toBeLessThan(4000)
```

### Arreglo requerido

En el test de caller:
1. configurar explícitamente un `DISCORD_ERROR_WEBHOOK_URL` falso;
2. afirmar `expect(fetchSpy).toHaveBeenCalled()`;
3. asegurar que la llamada recibió un `signal`;
4. usar un timeout corto inyectable para no sumar 2.5 s a la suite;
5. demostrar roja si se elimina el timeout/abort del transporte o si se omite el dispatch.

No hace falta cambiar el comportamiento de producción del helper: H14 ya está bien.

## CI exacta

GitHub Actions **CI #295** / SHA `135f7fe1`: success.

- db-tests ✅ — `Files=8, Tests=1444, Result: PASS`
- build ✅
- unit ✅ — 48 archivos / 453 tests
- typecheck ✅
- lint ✅
- audit ✅
- bundle-budget ✅

Tiempos relevantes:
- `observability.test.ts`: 19 tests, **147 ms**
- `requests.test.ts`: 37 tests, **54 ms**

## Alcance

La rama sigue 11 commits ahead y 0 behind respecto de la base auditada. Los cambios de R3 están dentro de los archivos permitidos. El agy no tocó `docs/revision-pr/pr-95/**`.

## Veredicto

**No mergear todavía.**

- H15 debe corregirlo el agy.
- H04 requiere ejecución real de Lautaro073; no se resuelve con más código ni documentación inventada.
- No hay decisiones pendientes.
