# Lecciones de la PR #95 para `AGENTS.md` y las reglas

**Fuente:** 13 registros en ronda 1: 9 bloqueantes técnicos, 2 decisiones aceptadas y 2 decisiones pendientes.

## Patrón dominante

La PR confunde varias veces **“existe una función/documento/test”** con **“el efecto operativo ocurrió y quedó demostrado”**. Es el mismo tipo de problema que P08/P15: el check mira una representación barata de la regla (un string, un retorno limpio, un 204 simulado) en lugar de la frontera real.

## Lecciones propuestas

### AG-78 · Un DoD externo se prueba en la frontera externa, no con un mock que devuelve éxito

**Origen:** H02, H03, H04, H05

“Alerta recibida” no queda probada porque `fetch` mockeado devuelva 204; “simulacro ejecutado” no queda probado porque un Markdown contenga `APROBADO`. Los tests pueden validar estructura y lógica local, pero el resultado externo necesita evidencia externa.

> **Regla propuesta.** Cuando el DoD use verbos como “recibida”, “restaurado”, “publicado”, “aplicado en staging” o “verificado en proveedor”, separar dos evidencias: test automatizado de la lógica local + constancia operativa del sistema externo. Ninguna búsqueda de texto o mock HTTP puede sustituir la segunda.

### AG-79 · El scrubber de privacidad se deriva del contrato de datos real y se prueba sobre el payload saliente

**Origen:** H01, H02

El scrubber enumera nombres genéricos como `delivery_address`, pero el contrato real usa `pickup_address`, `dropoff_address` y coordenadas numéricas. Además, los tests miran el retorno de la función y no el body enviado.

> **Regla propuesta.** Todo scrubber de observabilidad debe mantener una tabla/test generada desde los campos sensibles reales del dominio y afirmar la frontera saliente completa (logger/webhook/telemetría). Si una coordenada o dirección se agrega al contrato, una prueba de privacidad debe fallar hasta incorporarla.

### AG-80 · Un runbook de recuperación se contrasta con el flujo vigente del proveedor antes de declararlo operativo

**Origen:** H07

El procedimiento de PITR asumió que el proveedor crea una instancia nueva, pero el restore normal de Supabase restaura el proyecto existente y lo deja temporalmente inaccesible; el clonado es otro flujo.

> **Regla propuesta.** Los pasos de disaster recovery que dependen de un proveedor se verifican contra documentación oficial vigente en la fecha de la tarea y se registra la fuente. No inferir comportamiento de restore, URLs, credenciales ni downtime.

## Decisiones de producto/operación registradas

- **Discord:** Lautaro073 decidió que es el sistema operativo de recepción de errores/alertas y ocupa el lugar de email/Sentry en T-310.
- **Sentry:** no participa del runtime actual. No instalar `@sentry/nextjs` ni hacer `fetch` a un DSN; las variables ya existentes pueden quedar reservadas para una futura integración.
- **Pendiente:** wiring end-to-end de alertas/uptime vs alcance de T-310.
- **Pendiente:** cadencia trimestral del simulacro.

## Qué cambiar, en orden de impacto

1. Añadir una regla explícita para DoD externos (AG-78) si vuelve a aparecer en otra PR o se considera severidad suficiente.
2. Incorporar campos de geolocalización/direcciones a la matriz obligatoria de privacidad de observabilidad (AG-79).
3. Exigir fuente oficial fechada en runbooks de proveedor (AG-80).
4. Resolver en la ficha/plan la contradicción entre objetivo transversal y archivos permitidos antes de tareas futuras de observabilidad.

## Advertencias

- H04 afecta el entregable específico de la tarea, no solo documentación cosmética.
- H09/H12 son decisiones humanas tomadas durante esta revisión; H13 es la consecuencia técnica pendiente: el código actual todavía consume el DSN.
- H10/H11 siguen pendientes y no deben ser resueltos por el agy sin decisión de Lautaro073.
