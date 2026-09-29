# Informe de revisión — PR #95 / T-310 — Ronda 6

**Head SHA revisado:** `c47c836f4e70b7fb37e70e7011ae164735379d81`  
**Base:** `develop` @ `cd0e69dabd31aa6531fa212d47a90c47e86ef155`  
**Fecha:** 2026-09-25  
**Resultado:** **SIN BLOQUEANTES TÉCNICOS** · **1 bloqueo operativo (H04)** · 0 decisiones pendientes

## Resumen

R6 cierra H16. No quedan fallos técnicos abiertos en la implementación de T-310.

El único impedimento para cerrar/mergear la tarea es H04: el DoD exige un simulacro real en staging y todavía no fue ejecutado/verificado.

## H16 · CERRADO

La implementación actual cumple el contrato de configuración:

- `alerts.ts` ya no lee `process.env`;
- producción obtiene webhook y NODE_ENV exclusivamente desde `serverEnv`;
- no existe `DISCORD_ALERT_TIMEOUT_MS`;
- `DEFAULT_DISCORD_TIMEOUT_MS = 2500` permanece fijo;
- el seam de test es triestado:
  - `undefined`: usar `serverEnv`;
  - `string`: webhook de test;
  - `null`: ausencia explícita;
- H03 ya no depende de mutar env;
- H15 sigue ejercitando webhook colgado + `signal` + abort;
- H16 tiene una prueba dedicada que falla si se reintroduce un fallback a `process.env`.

La bitácora además registra la mutación roja:

```text
AssertionError: promise resolved ... instead of rejecting
```

al reintroducir el fallback.

### Cambios laterales en RPCs

Los nuevos `try/catch` alrededor de `sendCriticalAlert` en requests/offers son coherentes con el contrato existente: una caída del sink de observabilidad no cambia el resultado RPC y el caller sigue recibiendo `INTERNAL_ERROR`.

No se detectó regresión derivada de esos cambios.

### Residual no bloqueante

La prueba H16 usa la ausencia de variables privadas en el workflow CI actual para forzar que `serverEnv` falle. Esto está determinado por el workflow versionado y hoy es estable, aunque podría hacerse más autocontenido en una futura refactorización de tests. No justifica otro bloqueo de T-310.

## H04 · ÚNICO BLOQUEO RESTANTE

El acta sigue correctamente en:

```text
PENDIENTE / NO VERIFICADO
```

y los dos ítems del DoD de simulacro siguen desmarcados.

Para cerrarlo Lautaro073 debe ejecutar realmente el protocolo de staging y registrar:

1. dump y hash SHA-256;
2. fila/documento de prueba previo al backup según protocolo;
3. `pg_restore` / restore con logs reales;
4. comprobación de restauración SQL;
5. comprobación 404 del objeto `courier-docs` excluido/purgado;
6. alerta de prueba realmente recibida en Discord;
7. `/api/health` posterior;
8. RTO/RPO medidos con tiempos reales.

Hasta entonces el DoD no está completo.

## CI exacta

GitHub Actions **CI #304** sobre `c47c836f`: **success**.

```text
build         success
db-tests      success
audit         success
lint          success
typecheck     success
unit          success
bundle-budget success
```

Unit:
- 48 archivos;
- **454 tests PASS**;
- `observability.test.ts`: 20 tests / 150 ms;
- `requests.test.ts`: 37 tests / 112 ms.

DB:
- Files=8;
- Tests=1444;
- **Result: PASS**;
- tipos generados exitosamente contra Supabase local de CI.

## Alcance

La rama está:
- 22 commits ahead;
- 0 behind;
- 29 archivos modificados.

Los cambios de implementación R6 están dentro de los archivos permitidos.

## Veredicto

**Código técnicamente limpio para T-310. No mergear todavía por H04.**

Agy ya no tiene correcciones técnicas pendientes. El siguiente paso es operativo de Lautaro073.
