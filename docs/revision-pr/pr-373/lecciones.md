# Lecciones — PR #373 · CC-026 (ronda 1)

**Hallazgos:** 4, todos abiertos, por análisis del HEAD `eadaf54581b1c1cd3875e4a039ba66ffe70f0548`. Esta revisión es preliminar sobre una PR Draft WIP; no se infieren defectos de una migración aún inexistente.

## pr-373/AG-78 — Los schemas de RPC son contratos entre valores, no solamente listas de tipos

**Origen:** H01, H02 · `P11`/`P08`

Declarar errorCodes y usar `.strict()` da apariencia de contrato cerrado, pero dos propiedades básicas quedan fuera de la prueba: que **cada código de error emitido por el wrapper sea declarable** y que **el conteo coincida con la lista que lo justifica**.

> **Regla propuesta:** para cada RPC nueva, enumerar respuestas negativas de validación y autorización por todas las fronteras (fake, wrapper, SQL). En outputs con `count` y `ids`, afirmar relaciones estructurales con `.refine`/`.superRefine` y romper esas relaciones a propósito en pruebas de contrato.

## pr-373/AG-79 — El camino feliz del fake no verifica la frontera real ni toda la clase de estados

**Origen:** H03, H04 · `P06`

La prueba agregada pasa por un único comercio y dos solicitudes, mientras la implementación tiene guardas para consentimiento, estado previo, ofertas asignadas y lotes. La ausencia de casos negativos impide observar una regresión en cualquiera de las guardas.

> **Regla propuesta:** en RPC que altera estados por lotes, tests por actor (incluidos rechazos), transición vigente, borde exacto del reloj, 50/51/>100 filas y reintento sin side effects. El fake nunca sustituye pgTAP real de seguridad/atomicidad ni la revisión de fuentes de verdad.

## Advertencia

No promover reglas a `AGENTS.md` automáticamente por una sola PR. La demostración runtime y los mutantes independientes quedan pendientes de entorno con clon y suites disponibles; no escribir `verificado_en_sha` hasta ejecutarlos.

## Ronda 2 — PR #373, HEAD `f62a385c6e152ea206598aa3460eeec31f97b2a1`

### pr-373/AG-80 — Un bypass de fecha es una transición de negocio no autorizada
**Origen: H05; P17.** En el test pgTAP, un comerciante pudo ejecutar `UPDATE delivery_requests.expires_at` y un courier `UPDATE offers.decided_at` sin excepción. Las policies RLS revisadas congelan status/otras columnas pero omiten esas dos. Un `WITH CHECK` que ignore un campo no lo congela. **Regla:** enumerar cada columna de tiempo/decisión controlada por RPC, impedir UPDATE directo con una barrera comprobable y afirmar resultado de la fila, no solo SQLSTATE. La vulnerabilidad afecta plazo y trazabilidad.

### pr-373/AG-81 — Un archivo de prueba no ejecutado y un mock obsoleto no son pruebas
**Origen: H06/H07/H08/H09; P15/P08.** El workflow solo invoca los scripts de concurrencia T-340/CC-024; subir `cc026_reconcile_expired_requests.mjs` no lo conecta al job. El test pgTAP abortó por limpiar parent antes de offers; otra suite cron no se adaptó a la nueva RPC. **Regla:** rastrear cada prueba hasta el comando CI real; forzar fallo de SQL (ON_ERROR_STOP=1 y assertion de salida) y verificar que rompe el job antes de proclamar concurrencia verde. Corregir mocks únicamente para reflejar la API nueva, manteniendo las afirmaciones del resultado real.

### pr-373/AG-82 — `hasMore` debe dirigir el barrido de mantenimiento
**Origen: H10; P06.** El mismo resultado SQL contiene `hasMore` pero `runSweep` realiza solo una llamada con limit 200. El cron diario puede postergar solicitudes si hay más de 200 pendientes. **Regla:** testear explícitamente lotes 201/401 y establecer presupuesto temporal/acotado que no haga spin cuando `SKIP LOCKED` informa pendientes bloqueados, devolviendo un estado claro de continuación.

No promover reglas de una sola revisión automáticamente a AGENTS.md. Sin mutaciones independientes locales verificadas: el resultado CI fallido es evidencia observada, no un RED provocado por el revisor.

## Ronda 3 — `f30193d6c633589390b22276cbc09a3bf7d31d2c`

### pr-373/AG-83 — Si el runner aborta antes de los casos críticos, los 41 PASS previos no prueban rollback
**H11; P15.** El archivo pgTAP registra 41 subtests exitosos y luego `ERROR: function like(text, unknown, unknown) does not exist` justo al entrar a los fallos forzados. **Regla propuesta**: leer último test ejecutado, status del proceso y resultado completo antes de afirmar cobertura del DoD. El objetivo de una prueba no ejecutada no es verde. Verificar la propia API del framework de tests (en SQL, `LIKE` es operador).

### pr-373/AG-84 — 100% de assertions PASS no significa cumplir la política de coverage
**H12; P08.** Vitest reporta 2347/2347 PASS y mismo job termina FAILURE por `rpc-fake.ts` 89,94 % ramas, bajo mínimo 90 %. **Regla propuesta:** tratar el estado de coverage como parte del resultado unit; cubrir ramas semánticamente importantes del código nuevo, medir mutación RED independiente y no reducir thresholds por comodidad.

### Observación de coordinación
El test de concurrencia mejora su detección de errores, pero sin integrarlo al runner no genera evidencia de CI. Las modificaciones de alcance para workflow y master-plan son decisiones a resolver por Lautaro073: están comparadas y recomendadas en `revisiones/ronda-3.md`. No extender en silencio alcance autorizado.

## Ronda 4 — Decisiones de alcance y evidencia remota

**pr-373/R4-alcance — No presentar “autorización posterior” como elección del propietario sin referencia trazable.** El implementador corrigió bien y los nuevos controles pasaron CI, pero la rama incorpora `.github/workflows/ci.yml` y `docs/master-plan.md` después de la R3, que había pedido expresamente D1 y D2. La solución técnica no autoriza por sí misma ampliar la ficha. Registrar opción elegida por Lautaro073 antes de cerrar el dictamen. Una vez autorizada, preferir conservar el control automatizado en CI y la única frase de paridad temporal.

**pr-373/R4-evidencia — Una prueba de DB real sigue siendo prueba observada de CI, no una mutación del revisor.** Se verificaron logs con los números completos, el RED del mutante H11, el GREEN 54/54, el harness de 2 sesiones y el diff de tipos; distinguirlo de tests independientes ejecutados localmente (no ejecutados). El E2E marcado BLOCKED por migración de Develop no es ni PASS ni FAIL del flujo de navegador.

No se crea un ID AG adicional sin inspeccionar el máximo de todas las ramas remotas, disponible sólo mediante clon completo.