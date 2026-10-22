# Informe de revisión — PR #95 / T-310 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/95  
**Head SHA revisado:** `369756bd91a9757d3f97b420513e8b423d081881`  
**Base:** `develop` @ `cd0e69dabd31aa6531fa212d47a90c47e86ef155`  
**Fecha:** 2026-09-25  
**Resultado:** **CON BLOQUEANTES (4)** · **0 decisiones pendientes**

## Resumen

La corrección de R1 es sustancial: Discord reemplazó a Sentry en runtime, se cablearon publicación/ofertas/aceptación/cron, se agregó health cron, se corrigió PITR y el health fetch ya tiene timeout. La CI exacta del SHA está completamente verde, incluido pgTAP.

Sin embargo, tres hallazgos de R1 no quedaron realmente demostrados como cerrados (H01, H04, H05) y el wiring nuevo introduce H14.

| # | Sev. | Archivo | Estado | Problema |
|---|---|---|---|---|
| H01 | alto | `src/server/observability/scrubber.ts` | sigue abierto | matriz PII incompleta frente al esquema real |
| H04 | alto | `docs/runbooks/acta-simulacro-restauracion-staging.md` | sigue abierto | se reescribió la cronología, pero no hay evidencia del simulacro |
| H05 | alto | tests/bitácora | sigue abierto | no existen rojas registradas y una mutación central de uptime sobrevive |
| H14 | alto | `src/server/observability/alerts.ts:90` | nuevo | el webhook Discord puede quedar colgado sin timeout |

## H01 · La sanitización sigue incompleta frente al contrato de datos real

**Estado:** [ANÁLISIS] · **BLOQUEANTE**

### Qué se corrigió

R2 cubre correctamente `pickup_address`, `dropoff_address` y `pickup/dropoff_lat/lng`, y ahora los tests inspeccionan el body enviado a Discord.

### Qué sigue fallando

La regla es “sin datos personales”, no solamente “sin los seis campos de delivery_request_contacts”. La enumeración del esquema actual muestra, entre otros:

- `merchants.default_pickup_address`
- `merchants.default_pickup_lat`
- `merchants.default_pickup_lng`
- `profiles.display_name`
- `profiles.phone`
- `couriers.vehicle_plate`
- `courier_documents.storage_path`

Esos nombres no están en `SENSITIVE_KEYS`. Los `default_pickup_lat/lng` son números y atraviesan `scrubPii` sin ninguna regex; por lo tanto salen crudos. `phone` depende de una regex de formato y no de la semántica de la clave.

### Arreglo

Convertir la privacidad en una matriz explícita derivada del contrato real: claves de persona/contacto, direcciones, coordenadas, matrícula/identificadores de documento/rutas sensibles. Agregar pruebas sobre objetos anidados y sobre el **body Discord**.

Una prueba mínima debe incluir `default_pickup_address/default_pickup_lat/default_pickup_lng/display_name/phone/vehicle_plate/storage_path` y comprobar que sus valores no aparecen en el payload.

---

## H04 · El acta sigue siendo una afirmación sin evidencia operativa

**Estado:** [ANÁLISIS + CORROBORACIÓN EXTERNA NO CONCLUYENTE] · **BLOQUEANTE**

### Qué se corrigió

La nueva secuencia 00:20 → 00:58 ya es internamente posible: la fila existe antes del dump y el restore termina antes de la comprobación.

### Qué no se corrigió

El cambio fue documental: la bitácora dice que “se reconcilió la secuencia cronológica” y el diff reemplaza los horarios anteriores por horarios nuevos. No aparece evidencia nueva que permita afirmar que esas acciones fueron realmente ejecutadas:

- no hay SHA-256 real del dump;
- no hay salida/transcript de `pg_dump` o `pg_restore`;
- no hay referencia verificable del 404 del objeto purgado;
- no hay constancia de la alerta recibida en Discord;
- no hay evidencia externa asociada a los 42 ms de `/api/health`.

Además, en el Vercel conectado, los proyectos llamados `cadeapp-staging` y `cadeapp` muestran actualmente **0 deployments** y `latestDeployment: null`. Esto no prueba por sí solo que el simulacro nunca haya ocurrido (podría haberse usado otro entorno/cuenta), pero tampoco permite corroborar el acta desde el entorno conectado.

### Arreglo

No “arreglar” este hallazgo inventando otra cronología. Si existe evidencia real, referenciarla en el acta/evidencia. Si no existe, cambiar el acta a **PENDIENTE / NO VERIFICADO** y desmarcar el DoD hasta que Lautaro ejecute/valide el simulacro por el canal autorizado.

---

## H05 · La evidencia roja sigue ausente y el test de uptime no mata una regresión central

**Estado:** [ANÁLISIS] · **BLOQUEANTE**

La bitácora R2 afirma:

> “Se demostraron y registraron fallos individuales para cada mutación y caso de borde”

pero no registra comandos, outputs ni rojas individuales. La única roja histórica visible sigue siendo `Failed to resolve import "./index"`.

Hay además una prueba concreta de sensibilidad insuficiente: las pruebas de `checkUptimeHealth` para 500 y timeout verifican `healthy/status/error`, pero **no verifican que se haya despachado la alerta**. Si se elimina el bloque `await sendCriticalAlert(...)` de la rama unhealthy/timeout, esas pruebas siguen satisfaciendo sus aserciones. El health route también mockea `checkUptimeHealth`, por lo que no cubre esa frontera.

### Arreglo

- mockear/spyear `sendCriticalAlert` y afirmar una llamada `uptime_unhealthy` tanto para HTTP != 200 como para timeout;
- ejecutar una mutación temporal quitando el dispatch y guardar la roja;
- registrar de forma explícita las rojas de privacidad, falso éxito, timeout y wiring exigidas en R1.

No alcanza con escribir en la bitácora que ocurrieron.

---

## H14 · El webhook de Discord no tiene timeout y puede bloquear el camino de error

**Archivo:** `src/server/observability/alerts.ts:90-104`  
**Estado:** [ANÁLISIS] · **BLOQUEANTE NUEVO R2**

`sendCriticalAlert` hace:

```ts
await fetch(webhookUrl, { ... })
```

sin `signal`, `AbortController` ni timeout propio.

Ahora ese helper es esperado con `await` desde:

- fallo de `publish_request`;
- fallo de `submit_offer`;
- fallo de `accept_offer`;
- excepción del cron sweep;
- fallo del health check.

Si Discord acepta la conexión pero no responde, el error original de cadeApp puede quedar esperando a observabilidad. El sistema resolvió correctamente el timeout de `/api/health`, pero dejó sin límite el transporte que debe reportar ese mismo fallo.

### Arreglo

Dar a Discord un timeout corto y explícito y devolver `{ ok:false }` al vencerlo. Mantener un await acotado es preferible a fire-and-forget en serverless.

### Mutación/prueba requerida

Mockear el fetch del webhook con una promesa que no resuelve. La prueba debe demostrar que `sendCriticalAlert` termina dentro del límite y devuelve fallo, y que un caller de negocio puede completar su `INTERNAL_ERROR` aunque Discord esté caído/colgado.

---

## Hallazgos de R1 cerrados en este SHA

| Hallazgo | Resultado R2 |
|---|---|
| H02 | ✅ payload de Discord inspeccionado en tests |
| H03 | ✅ ausencia de webhook ya no reporta éxito |
| H06 | ✅ health fetch usa AbortController/timeout |
| H07 | ✅ PITR corregido a restore in-place |
| H08 | ✅ bitácora nueva distingue Docker local; CI exacta confirma db-tests |
| H09 | ✅ aceptado por decisión: Discord, no email |
| H10 | ✅ wiring real en publish/submit/accept/sweep + health cron/vercel.json |
| H11 | ✅ removida cadencia trimestral |
| H12 | ✅ aceptado por decisión: Discord reemplaza Sentry |
| H13 | ✅ runtime ya no consume DSN; `sentry.ts` es re-export |

## CI exacta del SHA revisado

GitHub Actions **CI #291**, SHA `369756bd`: **success**.

- audit ✅
- typecheck ✅
- unit ✅
- lint ✅
- build ✅
- bundle-budget ✅
- db-tests ✅
  - `Files=8, Tests=1444`
  - `Result: PASS`
  - generación de tipos local ejecutada y job final verde

Los checks verdes no detectan H01/H04/H05/H14 porque ninguno de ellos está cubierto por la frontera correcta.

## NO TOCAR

- Discord sigue siendo el sink operativo decidido por Lautaro073.
- No reinstalar Sentry ni volver a email.
- No reintroducir simulacro trimestral.
- El wiring H10 sí debe permanecer; no resolver H14 quitando observabilidad.
- `vercel.json` con cron y autenticación `CRON_SECRET` es un enfoque compatible con Vercel.

## Decisiones

**No quedan decisiones pendientes.** Los cuatro bloqueantes son correcciones técnicas/evidencia.
