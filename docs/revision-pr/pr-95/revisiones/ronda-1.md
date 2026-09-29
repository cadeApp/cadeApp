# Informe de revisión — PR #95 / T-310

**PR:** https://github.com/cadeApp/cadeApp/pull/95  
**Head SHA revisado:** `56f9c968a797f41f23eaf2dc325e7554006f93f6`  
**Base:** `develop` @ `cd0e69dabd31aa6531fa212d47a90c47e86ef155`  
**Fecha:** 2026-09-25  
**Resultado:** **CON BLOQUEANTES (11)** · 2 decisiones aceptadas por Lautaro073 · **0 decisiones pendientes**

## Alcance comprobado

- La rama está 4 commits adelante y 0 detrás de `develop`; merge-base = base actual.
- Los 10 archivos modificados están dentro de “Archivos permitidos” de T-310.
- `docs/tasks/T-310.md` solo marca los cuatro checkboxes del DoD; no amplía archivos, dependencias ni objetivo.
- No existía `docs/revision-pr/pr-95/` antes de esta revisión.
- CI del SHA exacto está verde, pero los checks verdes no ejercen varios invariantes de operación/privacidad descritos abajo.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| H01 | alto | `src/server/observability/scrubber.ts:14-30,95-115` | deja pasar direcciones reales y coordenadas exactas | BLOQUEANTE |
| H02 | alto | `src/server/observability/observability.test.ts:84-105,139-160` | los tests no inspeccionan lo que efectivamente se envía | BLOQUEANTE |
| H03 | alto | `src/server/observability/alerts.ts:49-58,121-135` | “éxito” aun sin webhook/recepción | BLOQUEANTE |
| H04 | alto | `docs/runbooks/acta-simulacro-restauracion-staging.md:24-30` | cronología incompatible con el resultado declarado | BLOQUEANTE |
| H05 | alto | `docs/tasks/log/T-310.md:18,32` | una sola roja por import faltante no valida 14 pruebas; tests de acta son tautológicos | BLOQUEANTE |
| H06 | alto | `src/server/observability/uptime.ts:19-23` | no existe timeout aunque el contrato lo afirma | BLOQUEANTE |
| H07 | alto | `docs/runbooks/backups-and-disaster-recovery.md:55-59` | procedimiento PITR describe un proyecto nuevo, no el restore real | BLOQUEANTE |
| H08 | medio | `docs/tasks/log/T-310.md:32` | “454 tests / test:db n.a.” contradice CI y AGENTS | BLOQUEANTE |
| H09 | decisión | `docs/master-plan.md:305` | email vs Discord | ACEPTADA: Discord |
| H10 | alto | `src/server/rpc/**`, `src/app/api/cron/**`, `vercel.json` | integrar alertas/uptime end-to-end ahora | BLOQUEANTE |
| H11 | medio | `docs/runbooks/backups-and-disaster-recovery.md:91-93` | quitar obligación trimestral no decidida | BLOQUEANTE |
| H12 | decisión | regla 25 vs ficha | Discord reemplaza a Sentry para recepción de errores | ACEPTADA |
| H13 | alto | `src/server/observability/sentry.ts:18-79` | `captureError` todavía envía errores a un DSN/Sentry en vez de Discord | BLOQUEANTE |

---

## H01 · El scrubber deja pasar direcciones reales y coordenadas exactas

**Archivo:** `src/server/observability/scrubber.ts:14-30,95-115`  
**Estado:** [ANÁLISIS]

### Diagnóstico

El master plan prohíbe registrar o transmitir coordenadas exactas en logs estructurados, Sentry, webhooks o analítica. El schema real usa:

- `pickup_address`
- `dropoff_address`
- `pickup_lat`
- `pickup_lng`
- `dropoff_lat`
- `dropoff_lng`

Ninguna aparece en `SENSITIVE_KEYS`. Los strings de dirección pasan por regex genéricas que no reconocen una dirección arbitraria y los números de lat/lng llegan a la rama final sin modificación.

Por tanto:

```ts
scrubPii({
  pickup_address: 'San Martín 123',
  pickup_lat: -27.4332,
  pickup_lng: -65.6141,
})
```

conserva datos que D15 prohíbe enviar.

### Arreglo

Redactar explícitamente todas las claves sensibles del contrato real (incluidas coordenadas numéricas y ambas direcciones), y cubrir variantes anidadas/arrays.

### Cómo verificar

Agregar una prueba con los seis campos reales y comprobar que ninguno aparece ni en el retorno ni en el body saliente de Discord/error transport.

---

## H02 · Los tests de privacidad no inspeccionan el payload que sale por red

**Archivo:** `src/server/observability/observability.test.ts:84-105,139-160`  
**Estado:** [ANÁLISIS]

### Diagnóstico

La prueba de `captureError` afirma `result.sanitizedMessage`, pero nunca parsea `fetch.mock.calls[0][1].body`. Si la implementación enviara `context` crudo y devolviera un mensaje limpio, el test seguiría verde.

La prueba de `sendCriticalAlert` inspecciona que el body contenga `CRITICAL` o el tipo, pero no prueba ausencia de PII en `message`, `details`, objetos anidados ni coordenadas.

Es el mismo patrón P08 ya observado en revisiones anteriores: el control verifica una salida distinta de la frontera que intenta proteger.

### Arreglo

Afirmar el body exacto que sale hacia Discord. En el SHA auditado también existe un transporte Sentry que debe eliminarse por H13; el resultado final debe demostrar que el único sink operativo de errores es Discord y que su body no contiene PII.

---

## H03 · La alerta de prueba puede informar éxito sin haber entregado nada

**Archivo:** `src/server/observability/alerts.ts:49-58,121-135`  
**Estado:** [ANÁLISIS]

### Diagnóstico

Cuando no existe `DISCORD_ERROR_WEBHOOK_URL`, `sendCriticalAlert` devuelve:

```ts
{ ok: true, message: 'Alerta registrada localmente (sin webhook configurado)' }
```

Luego `sendTestAlert` convierte ese `ok: true` en “despachada: éxito”. Eso permite marcar el DoD “alerta de prueba recibida” sin canal configurado.

Además, el test actual solo mockea un HTTP 204; demuestra que el código acepta una respuesta simulada, no que el mensaje haya sido recibido en el canal real.

### Arreglo

Separar “fallback local” de “entregada al canal”. En staging/producción, ausencia de webhook no puede cerrar el DoD. `sendTestAlert` debe exponer si hubo entrega real y el acta debe guardar evidencia operativa verificable de la recepción.

**Decisión ya tomada:** **Discord es el destino de observabilidad de errores y reemplaza a email/Sentry en T-310.**

---

## H04 · El acta tiene una cronología imposible y no respalda el DoD

**Archivo:** `docs/runbooks/acta-simulacro-restauracion-staging.md:24-30`  
**Estado:** [ANÁLISIS]

### Diagnóstico

Hay dos contradicciones internas:

1. El dump se genera a las **00:30** y la fila/archivo de prueba se crea recién a las **00:35**. Sin embargo, a las 00:52 se afirma que “el backup de base restauró la fila SQL”. Un dump anterior a la inserción no puede contener esa fila.
2. La restauración empieza a las **00:45** y se declara un RTO de **11m45s**. Finalizaría alrededor de **00:56:45**, pero la comprobación posterior figura a las **00:52**.

El acta es el entregable específico de T-310; no puede declararse “APROBADO / EXITOSO” con una secuencia temporal que no puede haber ocurrido como está escrita.

### Arreglo

No corregir los horarios por cálculo. Repetir o reconstruir el simulacro desde evidencia real y registrar tiempos observados. Si el objetivo es comprobar que una fila SQL reaparece mientras el binario no, la fila y el objeto deben existir **antes** de tomar el backup y el objeto debe borrarse **después**.

---

## H05 · La fase roja y los tests documentales no demuestran cada regla nueva

**Archivo:** `docs/tasks/log/T-310.md:18,32`; `src/server/observability/observability.test.ts:219-248`  
**Estado:** [ANÁLISIS]

### Diagnóstico

Regla 40 exige que **cada prueba nueva pueda fallar** y que se rompa deliberadamente la regla que prueba. La bitácora registra una única roja:

`FAIL Failed to resolve import "./index"`

Ese fallo solo demuestra que el módulo aún no existía; no demuestra que cada una de las 14 pruebas detecte la regresión concreta que declara.

Además, los dos tests de runbooks solo buscan palabras como `APROBADO`, `courier-docs`, `RPO` o `RTO`. Un acta inventada con esas palabras pasa, como muestra H04.

### Arreglo

Registrar rojas dirigidas por regla/mutación. Para el simulacro externo, no intentar convertir presencia de texto en prueba de ejecución: separar test estructural del documento de la evidencia operativa del acto real.

---

## H06 · El chequeo de uptime no tiene timeout real

**Archivo:** `src/server/observability/uptime.ts:19-23`  
**Estado:** [ANÁLISIS]

### Diagnóstico

El comentario promete alertar si el endpoint “sufre timeout”, pero `fetch` se ejecuta sin `AbortSignal` ni `AbortController`. Si la conexión queda abierta y nunca resuelve, la función queda pendiente indefinidamente y jamás llega al `catch` que dispara la alerta.

El test “no responde o retorna 500” solo simula un 500 resuelto; no prueba una promesa colgada.

### Arreglo

Definir timeout explícito y probarlo con fake timers / una promesa que no resuelve. La prueba debe verificar tanto el retorno unhealthy como el intento de alerta.

---

## H07 · El runbook describe incorrectamente la restauración PITR de Supabase

**Archivo:** `docs/runbooks/backups-and-disaster-recovery.md:55-59`  
**Estado:** [VERIFICADO-DOC]

### Diagnóstico

El runbook afirma que al confirmar PITR “Supabase creará una nueva instancia” y luego indica actualizar `NEXT_PUBLIC_SUPABASE_URL` y credenciales.

La documentación oficial vigente de Supabase describe el restore de backup/PITR **sobre el proyecto**, que queda inaccesible durante el proceso. Restaurar a un proyecto nuevo es un flujo separado (“Restore to a new project” / clone).

Fuente verificada el 2026-09-25:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/clone-project

En un incidente real, el runbook actual puede hacer que el operador busque una URL/proyecto nuevo que el restore normal no crea.

### Arreglo

Corregir el procedimiento para el restore normal y documentar por separado el flujo opcional de clonación a un proyecto nuevo si se decide usarlo.

---

## H08 · La bitácora contradice los checks reales del SHA

**Archivo:** `docs/tasks/log/T-310.md:32`  
**Estado:** [VERIFICADO-CI]

### Diagnóstico

La bitácora declara:

- `47 archivos / 454 tests`
- `test:db n.a.`

En GitHub Actions para el SHA revisado, el job `unit` muestra **47 archivos / 440 tests**, no 454. El job `db-tests` sí ejecutó Supabase local y terminó **Files=8, Tests=1444, Result: PASS**.

Además, `AGENTS.md §4` exige `pnpm test:db` cuando se toca `src/server/`, por lo que “n.a.” no corresponde.

### Arreglo

Actualizar la bitácora con la salida real y distinguir qué se corrió localmente de qué se verificó en CI. No sumar manualmente los 14 tests de observabilidad al total de Vitest si ya están incluidos.

---

## H13 · `captureError` todavía envía errores a Sentry/DSN en vez de Discord

**Archivo:** `src/server/observability/sentry.ts:18-79`  
**Estado:** [ANÁLISIS]

### Diagnóstico

Lautaro073 aclaró durante esta misma ronda que **Discord ocupa el lugar de Sentry**: ahí deben recibirse los errores y eventos operativos. Sin embargo, el SHA revisado todavía implementa otro transporte:

- lee `NEXT_PUBLIC_SENTRY_DSN`;
- construye un payload con `message`, `extra` y `environment`;
- hace `fetch(dsn, ...)`;
- considera ese envío como `dispatched`.

Eso no es un “fallback futuro”: es una ruta de ejecución activa si el DSN está configurado. Contradice la decisión humana ya cerrada.

Las variables de entorno de Sentry pueden permanecer donde ya existen para una integración futura/open-source fuera de T-310; **esta tarea no necesita tocarlas**. El problema está en que el runtime actual las consume.

### Arreglo

Mantener `captureError` como API genérica si resulta útil, pero hacer que el error sanitizado llegue al transporte Discord (`sendCriticalAlert` o una abstracción equivalente) y eliminar la salida Sentry/DSN de T-310. No instalar `@sentry/nextjs`.

El nombre `sentry.ts` también debería dejar de sugerir un proveedor que no se usa; dentro de los archivos permitidos puede renombrarse/reorganizarse si hace falta.

### Cómo verificar

Con `NEXT_PUBLIC_SENTRY_DSN` definido y Discord configurado, provocar un error y afirmar que:
1. el request saliente va al webhook de Discord;
2. no se realiza ningún request al DSN;
3. el body de Discord está sanitizado.

---

# Decisiones

## H09 · Discord reemplaza al email del master plan y es el sink operativo de errores

**Estado:** **ACEPTADO por Lautaro073 en la sesión de revisión (2026-09-25).**

El master plan decía “alerta al admin por email”. La implementación usa Discord. Lautaro073 decidió explícitamente:

- canal operativo actual: **Discord**;
- no cambiar esta PR a email;
- Discord recibe los errores y ocupa el lugar de Sentry en T-310. Una integración Sentry/compatible podrá agregarse en el futuro, pero no participa del runtime actual.

Residual: el master plan queda desactualizado hasta que se actualice por una vía/PR autorizada. No ampliar T-310 fuera de sus archivos para corregirlo silenciosamente.

## H10 · Integrar alertas/uptime end-to-end dentro de T-310

**Estado:** **DECIDIDO por Lautaro073: integrar ahora. BLOQUEANTE hasta implementarlo.**

El master plan exige alertar cuando fallen publicación, ofertas, aceptación o cron, y chequear `/api/health`. Sin embargo, T-310 solo permite `src/server/observability/**` y docs.

En el SHA revisado:

- `src/server/rpc/requests.ts` devuelve `INTERNAL_ERROR` sin llamar observabilidad;
- `src/server/rpc/offers.ts` devuelve errores sin llamar alertas;
- `src/app/api/cron/sweep/route.ts` captura y devuelve 500 sin alertar;
- `checkUptimeHealth` no está cableado a ningún scheduler.

Lautaro073 eligió la opción A: **integrar ahora en T-310**. La ficha de esta rama queda ampliada formalmente para permitir:
- `src/server/rpc/**`
- `src/app/api/cron/**`
- `vercel.json`

El arreglo debe conectar errores reales de publicación/ofertas/aceptación/cron a Discord y programar el chequeo de `/api/health`.

## H11 · Quitar la frecuencia trimestral del runbook

**Estado:** **DECIDIDO por Lautaro073: quitarla. BLOQUEANTE documental hasta corregir el runbook.**

El runbook agrega “Frecuencia obligatoria: Trimestral y previa a cada salida mayor”. El plan/ADR solo exigen el simulacro antes de producción / como precondición de release.

Lautaro073 eligió quitar la obligación trimestral. El runbook debe conservar únicamente el simulacro requerido por release/producción según el plan vigente.

## H12 · Discord reemplaza a Sentry en T-310

**Estado:** **ACEPTADO por Lautaro073 en la sesión de revisión (2026-09-25).**

La regla 25 menciona `@sentry/nextjs (T-310)`, pero la ficha prohíbe dependencias nuevas. Lautaro073 aclaró que **Discord ocupa el lugar de Sentry**: los errores deben llegar por Discord. Las variables DSN ya existentes pueden quedar reservadas para una futura integración Sentry/compatible, pero T-310 no debe consumirlas.

Por lo tanto:
- no instalar `@sentry/nextjs` en esta tarea;
- no tratar una integración Sentry como condición del DoD;
- eliminar/reemplazar la ruta de ejecución que hoy hace `fetch(dsn)`; Discord debe ser el sink operativo de errores;
- no hace falta tocar las variables DSN existentes si están fuera del alcance de la ficha.

---

## NO TOCAR — falsos positivos ya descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `docs/tasks/T-310.md` fue modificado | La ficha permite ese archivo y el diff solo marca checkboxes; no amplió alcance. |
| Hay archivos fuera de alcance | No: los 10 paths del PR están permitidos por la ficha de `develop`. |
| La rama está desactualizada | No: está 0 commits detrás de `develop` en la ronda 1. |
| Hay que reemplazar Discord por email | No: Lautaro073 decidió Discord durante esta revisión. |
| Hay que instalar/usar Sentry | No: Lautaro073 decidió que Discord reemplaza a Sentry en T-310. |

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| typecheck | tipos compilan | privacidad, recepción real, timeout, exactitud del acta |
| lint | reglas estáticas pasan | wiring, protocolo externo, evidencia operativa |
| unit | 47 archivos / 440 tests pasan | mutaciones H01/H02/H03/H06; runbook externo real |
| db-tests | 8 archivos / 1444 pgTAP pasan | observabilidad server-side y simulacro remoto |
| build | Next compila | disponibilidad/alertas efectivas |

## Checks observados en el SHA

No hubo checkout local disponible en esta sesión de revisión; se verificó el SHA exacto mediante GitHub Actions:

- typecheck ✅
- lint ✅
- unit ✅ — 47 archivos / 440 tests
- db-tests ✅ — 8 archivos / 1444 tests, PASS
- build ✅
- bundle-budget ✅

Esto **no** convierte H01–H08 ni H10–H13 en verificados: son huecos que los checks actuales no cubren.

## Checklist para ronda 2

- [ ] H01: direcciones + coordenadas redactadas
- [ ] H02: tests inspeccionan body saliente y matan mutación de PII
- [ ] H03: sin webhook no se puede declarar “recibida”
- [ ] H04: acta reconstruida desde ejecución/evidencia coherente
- [ ] H05: rojas dirigidas registradas; no usar grep del acta como prueba de ejecución
- [ ] H06: timeout real + test de promesa colgada
- [ ] H07: runbook PITR corregido según proveedor
- [ ] H08: bitácora coincide con outputs reales
- [x] H09: Discord decidido por Lautaro073
- [ ] H10: wiring real de errores/uptime a Discord implementado en los archivos ahora autorizados
- [ ] H11: runbook sin obligación trimestral
- [x] H12: Discord reemplaza a Sentry, decidido por Lautaro073
- [ ] H13: `captureError` no usa DSN/Sentry y entrega errores sanitizados por Discord
