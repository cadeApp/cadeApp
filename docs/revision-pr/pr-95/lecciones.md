# Lecciones de la PR #95 para `AGENTS.md` y las reglas

**Fuente:** 13 registros en ronda 1: 11 bloqueantes técnicos derivados/confirmados y 2 decisiones humanas aceptadas; no quedan decisiones pendientes.

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
- **Wiring:** Lautaro073 decidió integrarlo ahora dentro de T-310; se amplió formalmente la ficha.
- **Simulacros:** Lautaro073 decidió quitar la cadencia trimestral y mantener el requisito de release/producción.

## Qué cambiar, en orden de impacto

1. Añadir una regla explícita para DoD externos (AG-78) si vuelve a aparecer en otra PR o se considera severidad suficiente.
2. Incorporar campos de geolocalización/direcciones a la matriz obligatoria de privacidad de observabilidad (AG-79).
3. Exigir fuente oficial fechada en runbooks de proveedor (AG-80).
4. Resolver en la ficha/plan la contradicción entre objetivo transversal y archivos permitidos antes de tareas futuras de observabilidad.

## Advertencias

- H04 afecta el entregable específico de la tarea, no solo documentación cosmética.
- H09/H12 son decisiones humanas tomadas durante esta revisión; H13 es la consecuencia técnica pendiente: el código actual todavía consume el DSN.
- H10/H11 ya están decididos y deben ejecutarse sin volver a consultar: integrar ahora y quitar la frecuencia trimestral.


## Ronda 2

### AG-81 · Acotá el timeout del propio transporte de observabilidad

**Origen:** H14

Agregar observabilidad dentro del camino de error crea una dependencia nueva: si el sink externo se cuelga y el caller hace `await`, la aplicación puede quedar esperando al sistema que debía observarla.

> **Regla propuesta.** Todo transporte externo de observabilidad/alertas invocado desde un camino de negocio debe tener timeout explícito y prueba de servicio colgado. La prueba debe demostrar que la operación original termina aunque el sink no responda.

### Revalidación de AG-78 y AG-79

- **AG-78** se confirma en H04/H05: reescribir un acta o afirmar “se registraron mutaciones” no sustituye la evidencia.
- **AG-79** se confirma en H01: cubrir los seis campos detectados inicialmente no equivale a derivar la matriz de privacidad del contrato completo.

## Estado al cierre de R2

- Cerrados/verificados: H02, H03, H06, H07, H08, H10, H11, H13.
- Aceptados por decisión: H09, H12.
- Abiertos: H01, H04, H05, H14.
- Decisiones pendientes: 0.


## Ronda 3

### AG-82 · Un test de integración debe demostrar que entró en la dependencia que afirma degradar

**Origen:** H15

Un test puede mockear un `fetch` colgado y aun así no usarlo. Si falta la configuración que habilita esa ruta, el caso pasa por un fallback temprano y produce un falso verde.

> **Regla propuesta.** Cuando una prueba diga que un caller tolera una dependencia externa caída/colgada, debe afirmar que la dependencia fue efectivamente invocada y que se alcanzó su mecanismo de timeout/fallo. No basta con comprobar que el resultado final llegó rápido.

### Estado al cierre de R3

- Cerrados/verificados: H01, H02, H03, H05, H06, H07, H08, H10, H11, H13, H14.
- Aceptados por decisión: H09, H12.
- Abiertos: H04 (operativo, Lautaro073) y H15 (test técnico, agy).
- Decisiones pendientes: 0.


## Ronda 4

### AG-83 · Un seam de test no debe crear una ruta productiva paralela a la validación de configuración

**Origen:** H16

Para hacer testeable una dependencia se puede inyectar comportamiento, pero no conviene resolverlo leyendo `process.env` directamente en el módulo productivo cuando el proyecto ya tiene una frontera Zod canónica.

> **Regla propuesta.** Los seams de test deben ser explícitos y no modificar el origen/validación de configuración de producción. Si el repo centraliza env en un schema, ningún arreglo de tests puede agregar lecturas `process.env` paralelas ni variables runtime no declaradas.

### Estado al cierre de R4

- H15: cerrado/verificado.
- H16: abierto técnico.
- H04: abierto operativo.
- Todos los demás hallazgos: cerrados o aceptados.
- Decisiones pendientes: 0.
