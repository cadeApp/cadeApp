# Informe de revisión — PR #95 / T-310 — Ronda 4

**Head SHA revisado:** `513cad3f4528e5c7befbc0e2d92c31a39bbb7eae`  
**Base:** `develop` @ `cd0e69dabd31aa6531fa212d47a90c47e86ef155`  
**Fecha:** 2026-09-25  
**Resultado:** **CON BLOQUEANTES (2)** — 1 técnico (H16) + 1 operativo (H04) · 0 decisiones pendientes

## H15 · CERRADO

La corrección ahora sí prueba el camino que declaraba:

- configura `DISCORD_ERROR_WEBHOOK_URL`;
- inyecta timeout de test de 50 ms;
- el mock de `fetch` recibe y afirma `init.signal`;
- permanece pendiente hasta el evento `abort`;
- afirma que `fetchSpy` fue invocado;
- el caller retorna `INTERNAL_ERROR`;
- la bitácora registra rojas al retirar `signal` y al retirar `controller.abort`.

La CI #298 ejecutó `requests.test.ts` (37 tests) en **127 ms**. Esto es consistente con un caso que realmente esperó un timeout de 50 ms, a diferencia de los 54 ms totales de R3 donde el webhook ni siquiera se alcanzaba.

**Estado:** arreglado-verificado.

---

## H16 · El seam de test debilitó la frontera de variables de entorno

**Archivo:** `src/server/observability/alerts.ts:58-59,111-116`  
**Severidad:** alta · **BLOQUEANTE TÉCNICO**

El arreglo de H15 introdujo dos cambios productivos innecesarios:

```ts
let webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL || undefined
let nodeEnv = process.env.NODE_ENV || 'development'
```

y:

```ts
process.env.DISCORD_ALERT_TIMEOUT_MS
  ? Number.parseInt(process.env.DISCORD_ALERT_TIMEOUT_MS, 10)
  : DEFAULT_DISCORD_TIMEOUT_MS
```

### Por qué está mal

El contrato del repo es explícito:

- `AGENTS.md`: **Zod es la fuente de verdad de los tipos de entrada y se parsea en toda frontera, incluidas variables de entorno**.
- `.agents/rules/25-stack-y-patrones.md`: las variables privadas viven en `src/server/env.ts`.

Pero ahora `alerts.ts` prioriza `process.env.DISCORD_ERROR_WEBHOOK_URL` **antes** de `serverEnv`, por lo que puede evitar la validación URL del schema.

Además se añadió `DISCORD_ALERT_TIMEOUT_MS` como variable runtime sin:
- declararla en `serverEnvSchema`;
- documentarla en `.env.example`;
- autorización de ficha para tocar `src/server/env.ts`;
- necesidad funcional: el pedido de R3 era un seam para tests, no una nueva opción productiva.

Una configuración inválida como `DISCORD_ALERT_TIMEOUT_MS=abc` da `NaN`; en Node un `setTimeout` con ese valor se ejecuta prácticamente de inmediato. Una variable mal escrita puede dejar Discord abortando casi instantáneamente sin fallar la validación de arranque.

### Arreglo esperado

No ampliar scope.

1. Eliminar `DISCORD_ALERT_TIMEOUT_MS` del comportamiento runtime de esta tarea.
2. Mantener `DEFAULT_DISCORD_TIMEOUT_MS = 2500`.
3. Volver a obtener la configuración productiva mediante `serverEnv`, no priorizar `process.env` directamente.
4. Conservar H15 usando un seam **exclusivamente de test** (por ejemplo un override explícito de webhook/timeout en el módulo o mocking controlado) sin cambiar la frontera productiva.
5. Agregar una prueba/mutación que demuestre que el test H15 sigue entrando al webhook colgado después de restaurar `serverEnv`.

No hace falta modificar `src/server/env.ts`, y de hecho no está en los archivos permitidos de T-310.

---

## H04 · Sigue pendiente, correctamente

No hubo regresión. El acta permanece:

```text
PENDIENTE / NO VERIFICADO
```

y los DoD del simulacro siguen desmarcados.

Esto **no es trabajo restante del agy**. Para cerrarlo Lautaro073 debe ejecutar el simulacro real en staging y aportar:

- hash SHA-256 real del dump;
- transcript/log de `pg_restore`;
- comprobación 404 del binario purgado tras restore;
- constancia de recepción de Discord;
- health 200 posterior y medición de RTO.

Hasta entonces T-310 no cumple el DoD completo.

---

## CI exacta del SHA R4

Run GitHub Actions **CI #298** sobre `513cad3f`.

Resultado final del run exacto:
- typecheck ✅
- lint ✅
- unit ✅ — 48 archivos / 453 tests
- audit ✅
- build ✅
- bundle-budget ✅
- db-tests ✅ — 8 archivos / 1444 tests, Result: PASS

Dato relevante de H15:
- `observability.test.ts`: 19 tests / 164 ms
- `requests.test.ts`: 37 tests / 127 ms

La rama de implementación revisada sigue mergeable y el diff R4 solo tocó archivos permitidos.

## Veredicto

La CI completa del SHA de implementación quedó verde. **No mergear todavía** por H16 y H04.

- agy: H16;
- Lautaro073: H04;
- decisiones pendientes: 0.
