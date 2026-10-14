# Informe de revisión — PR #228 / T-327 — Ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/228  
**SHA funcional verificado:** `c911032b2af21aced5a30121e2100aae834b4eca`  
**Base:** `develop@abf89d8ec9019667c227fbe6ce2534aea1762dbe` · 4 ahead / 0 behind  
**Fecha:** 2026-10-03

## Resultado

**SIN BLOQUEANTES.**

La implementación funcional es mínima y mantiene el modelo de confianza: el workflow privileged sigue saliendo de la rama por defecto y solo agrega `notifications.spec.ts` cuando el SHA exacto probado contiene ese archivo.

## Verificación de los hallazgos de R1

### PR228-H01 — arreglado-verificado

`assertOptionalSpecBeforeChromiumRun` ya no comprueba solo presencia. Exige:
1. bloque `if [ -f ... ]; then / specs+=(...) / fi` exacto;
2. existencia de la invocación Chromium;
3. `blockMatch.index < runMatch.index`.

La revisión reprodujo el comportamiento de forma independiente:
- orden correcto → GREEN;
- mover notifications debajo del run → RED;
- mover request-states debajo del run → RED.

El CI del SHA verificó además `verify-workflows.test.mjs` en GREEN.

### PR228-H02 — aceptado

La excepción de `e2e-staging.yml` quedó documentada en la ficha. Se mantiene como **aceptada por decisión P1**, no como hallazgo técnico “verificado”.

El cambio es simétrico y no altera secrets, environments, permisos, concurrency ni el modelo de despliegue.

### PR228-H03 — arreglado-verificado

La bitácora y la evidencia de la sesión están presentes. El cuerpo incluye el informe y checks.

Durante R2 apareció un residual de formato, separado como H04.

### PR228-H04 — encontrado y corregido en R2

El cuerpo usaba `## Informe de revisión de agy`; `approval-policy.mjs` delimita la sección con `### Informe de revisión de agy`.

Evidencia:
- runs 1214/1215 → RED: “Falta el informe completo…”
- fix del heading en el cuerpo;
- runs 1217/1219 → GREEN.

No se debilitó el policy.

## Sincronización

Al abrir R2 la rama estaba 15 commits detrás de `develop`. El reverse compare mostró que esos commits no tocaban archivos funcionales de #228.

La revisión hizo merge normal de `develop`; estado final funcional:

```text
ahead_by: 4
behind_by: 0
```

## CI

Run `37099538822` sobre `c911032b`:

- typecheck ✅
- lint ✅
- build ✅
- unit / coverage ✅
- workflow tests ✅
- ADR ✅
- bundle-budget ✅
- audit ❌ — advisory preexistente `braces`, idéntico a `develop` run `37098671655`
- db-tests: sin cambio DB propio de #228; el mismo árbol DB de `develop@abf89d8` ya estaba GREEN. El job del SHA seguía ejecutándose al momento de redactar.

## Seguridad

No se encontró:
- ampliación de permisos;
- cambio de Environment;
- secrets nuevos;
- entrega de secrets a forks;
- `pull_request_target` nuevo;
- `continue-on-error`;
- aumento de workers;
- deploy de Vercel desde Actions;
- modificación de producto/RLS/RPC.

## Limitación intencional de evidencia runtime

La #228 no puede probar pre-merge que el gate trusted de `develop` ejecute notifications, porque ese diseño impediría justamente que una PR reescriba su propio gate privileged.

La prueba runtime correcta es post-merge:
- sincronizar #180;
- nuevo Preview;
- confirmar en logs que aparecen los 3 tests de `notifications.spec.ts`.

Eso no bloquea el merge de #228; es el paso posterior que desbloquea T-307 y permite continuar #205.

## Decisiones P1

No hay decisiones nuevas pendientes.

## Veredicto

**SIN BLOQUEANTES.** No aprobar ni mergear automáticamente; el merge queda a decisión explícita de Lautaro073.
