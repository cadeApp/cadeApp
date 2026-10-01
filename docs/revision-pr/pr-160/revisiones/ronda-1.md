# Ronda 1 — PR #160 / T-303

**Fecha:** 2026-10-01  
**SHA revisado:** `803632187079aab355b3cadb8d20477a50ef274d`  
**Resultado:** **CON BLOQUEANTES (5)**

## Sincronización y alcance

- PR #160 abierta en Draft, base `develop`, head `803632187079aab355b3cadb8d20477a50ef274d`.
- La rama estaba 2 commits por delante y 0 por detrás de `develop` al iniciar la ronda.
- No había comentarios previos en la PR.
- Archivos modificados antes de esta revisión:
  - `docs/tasks/T-303.md`
  - `docs/tasks/log/T-303.md`
  - `e2e/specs/main-flow.spec.ts`
- La ficha oficial se leyó desde `develop`. El cambio de la ficha en la rama solo marca el DoD como completado; no amplía alcance por sí mismo.
- No se consultó CI para cerrar esta ronda porque existen bloqueantes estáticos en el propio instrumento E2E.

## Decisión P1 resuelta antes del informe

**1-A — aprobada por Lautaro073.** Se autoriza una ampliación mínima del arnés dentro de T-303 para soportar usuarios/roles reales, autenticación y cleanup del flujo principal en staging.

Archivos adicionales autorizados:
- `e2e/fixtures/**`
- `e2e/pages/**`, solo Page Objects estrictamente necesarios
- `src/server/e2e/staging-seed.ts`
- `src/server/e2e/staging-seed.test.ts`

La rama debe registrar esta excepción en `docs/tasks/T-303.md`. No se autorizan cambios funcionales de producto, contratos, migraciones, dependencias ni workflows.

## BLOQUEANTES

### PR160-H01 — El “E2E” reemplaza la aplicación por HTML fabricado dentro del test

**Severidad:** alto · **Patrón:** P08-control-no-cubre-lo-que-dice  
**Dónde:** `e2e/specs/main-flow.spec.ts:30-357`

Los casos interceptan las mismas URLs que navegan y responden con `route.fulfill({ body: '<html>…' })`. Las aserciones verifican ese HTML construido por el propio test, no componentes, Server Actions, RPC, RLS ni datos renderizados por cadeApp.

La regla de `e2e/AGENTS.md` dice que los specs corren contra staging/local con seed y que cada spec crea datos por fixtures. El arnés T-301 ya provee `stagingContext` con seed/cleanup real. Este spec importa esas fixtures pero no consume el contexto real.

**Qué debe pasar:** las navegaciones deben cargar la aplicación real. Se pueden interceptar servicios externos irrelevantes solo si no sustituyen el flujo bajo prueba; no se puede cumplir el DoD devolviendo HTML inventado.

### PR160-H02 — La prueba de “concurrencia” fabrica el resultado y ejecuta las aceptaciones en serie

**Severidad:** alto · **Patrón:** P04-test-tautologico  
**Dónde:** `e2e/specs/main-flow.spec.ts:69-129`

El propio test implementa el comportamiento que pretende validar:

- `acceptedCount === 0` → responde 200;
- cualquier llamada posterior → responde 409 + `ALREADY_MATCHED`.

Luego ejecuta `await tab1.evaluate(...)` y recién después `await tab2.evaluate(...)`. No hay dos aceptaciones concurrentes ni se ejerce el backend real.

Aunque la RPC real aceptara dos ofertas, esta prueba seguiría devolviendo exactamente una aceptación porque el mock la fuerza.

**Qué debe pasar:** crear una solicitud y dos ofertas reales y disparar ambos intentos de aceptación sin serializarlos (`Promise.all`/barrera equivalente), dejando que el backend real determine el resultado. Afirmar exactamente una aceptación y que el perdedor reciba el código de contrato esperado.

### PR160-H03 — Los cinco flujos nominales no ejecutan los comportamientos que declaran

**Severidad:** alto · **Patrón:** P06-enumeracion-incompleta  
**Dónde:** `e2e/specs/main-flow.spec.ts:133-357`

Enumeración de la clase completa observada:

1. **Publicar:** solo comprueba valores precargados y que exista “Publicar solicitud”; no llena ni envía el formulario ni verifica persistencia/estado.
2. **Ofertar/piso:** carga un input ya puesto en `1500`; no prueba rechazo bajo `min_offer_ars`, lectura del valor real ni creación de oferta.
3. **Retirar:** solo comprueba que existe “Retirar oferta”; no hace click, no confirma modal y no verifica que la oferta deje de estar pendiente.
4. **Ordenar:** solo comprueba `aria-pressed` inicial; no cambia a precio ni verifica el orden resultante por `doc_level` y por monto.
5. **Viaje/pago/WhatsApp/avance:** comprueba un enlace hardcodeado y la existencia de “Marcar como retirado”; no cubre transferencia, desglose/cambio, transición de retiro ni confirmación de entrega.

**Qué debe pasar:** cada flujo debe ejecutar la interacción real y verificar el efecto observable y/o estado persistido correspondiente.

### PR160-H04 — La bitácora y la ficha declaran evidencia que el código no ejecuta

**Severidad:** medio · **Patrón:** P03-comentario-contradice-codigo  
**Dónde:** `docs/tasks/log/T-303.md` y `docs/tasks/T-303.md`

La bitácora afirma “fixtures (roles y seed real transitorio)” y “contextos multi-pestaña para probar la concurrencia”, además de declarar 7/7 GREEN. Sin embargo, `main-flow.spec.ts` no solicita `stagingContext` en ningún test y reemplaza las páginas/endpoint relevantes con mocks locales. La ficha marca el DoD específico como verificado sobre esa evidencia.

**Qué debe pasar:** corregir la entrada de cierre con una nueva entrada append-only que explique la evidencia anterior inválida y, hasta demostrar los E2E reales, no afirmar ese DoD como verificado. La ficha puede quedar marcada solo cuando la nueva evidencia sea reproducible.

### PR160-H05 — El cuerpo de la PR no sigue el template ni aporta la evidencia obligatoria

**Severidad:** medio · **Patrón:** P19-cuerpo-de-pr-fuera-de-template  
**Dónde:** cuerpo de PR #160

Faltan las secciones obligatorias del template: “Qué cambia”, DoD copiado literalmente de la ficha, bloque de salida/enlace de checks, checkbox de mutación RED, informe de revisión de agy, dependencias, rutas de otra zona y rollback. El texto actual afirma checks y DoD sin pegar salida ni enlace verificable.

**Qué debe pasar:** rehacer el body usando `.github/pull_request_template.md`, pegar evidencia reproducible y mantener el informe de revisión literal requerido por `approval-policy`.

## Checks de esta ronda

- `typecheck`: **no ejecutado por esta revisión**
- `lint`: **no ejecutado por esta revisión**
- `test`: **no ejecutado por esta revisión**
- Playwright real de T-303: **no usado como evidencia de cierre**
- `test:db`: n.a. para el SHA revisado (el PR no tocaba Supabase/server antes de la decisión 1-A)

La ronda se cierra por inspección estática del SHA `803632187079aab355b3cadb8d20477a50ef274d`. No se presenta CI verde como compensación de los bloqueantes anteriores.

## Resultado

**CON BLOQUEANTES (5).** No aprobar ni mergear. La siguiente ronda debe revisar un nuevo SHA remoto y reproducir la evidencia RED/GREEN del autor sin confiar en sus mutaciones.
