# Ronda 3 — PR #204 / T-305

**Fecha:** 2026-10-02  
**SHA funcional revisado:** `b20d7cb4f5d1199e06610d6b9ed604ab07f172d8`  
**Resultado:** **CON BLOQUEANTES (2)**

## Qué se verificó

- H06: el test ahora limpia cookies + localStorage + sessionStorage antes de `loginAsCourier(0, page)`; el segundo rol vuelve a entrar por login real.
- M01: la rama volvió a usar `trusted E2E gate GREEN/RED contra el Preview`.
- CI exact-head: run `37051189722` GREEN.
- commit status `e2e-preview`: GREEN, run `37051338095`, pero el workflow confiable de `develop` ejecutó 9 tests y **no incluyó** `authorization.spec.ts`; el residual 3-A sigue vigente.
- No hay decisiones P1 nuevas.

## Estado de hallazgos previos

- H01–H04: corregidos en árbol/evidencia; la ejecución remota completa de authorization sigue post-merge por 3-A.
- H06: corregido por inspección. El flujo merchant→courier ya no reutiliza la sesión autenticada.
- M01: corregida.
- H05: parcial; ver bloqueante.
  
## BLOQUEANTES

### PR204-H05 — El body todavía no contiene el informe en formato literal

**Severidad:** medio · **Categoría:** conventions/evidencia

El body ya corrigió `Refs #37`, checkbox de mutaciones, rollback y evidencia de CI. Pero en “Informe de revisión de agy” la cabecera quedó concatenada:

```text
Informe revisar-pr — T-305 — 2026-10-02 — generado por revisión independiente de Lautaro073Resultado: ...
```

y el resto del informe también perdió saltos estructurales. La skill exige el formato literal con líneas separadas: `Informe revisar-pr`, `Resultado:`, `Checks locales:`, `BLOQUEANTES:`, `MEJORAS:`, `No revisado / dudas...`.

Además, al sincronizar develop el SHA y run exact-head cambiarán, por lo que el body debe actualizarse una vez más con el nuevo CI.

**Qué debe pasar:** tras sincronizar, reemplazar toda la sección “Informe de revisión de agy” por el informe literal de esta Ronda 3, con saltos de línea normales, y actualizar la evidencia exact-head al SHA nuevo. No declarar `SIN BLOQUEANTES` hasta Ronda 4.

### PR204-H07 — El SHA revisado no incorpora el gate T-329 ya mergeado a develop

**Severidad:** alto · **Categoría:** correctness/integración

Al iniciar Ronda 3:
- `develop = ff5c51f7edd003c152f56a2bd2edc0cf2feab698`
- head = `b20d7cb4f5d1199e06610d6b9ed604ab07f172d8`
- ahead 16 / behind 4.

Los 4 commits de base son T-329 e incluyen:
- `subscription.global-settings.spec.ts` en el gate;
- nuevas aserciones en `verify-workflows.test.mjs`.

La rama de #204 todavía no contiene esas líneas. Incluso `refs/pull/204/merge` observable sigue mostrando authorization + request-states, **sin global-settings**. Por eso el CI GREEN de `b20d7cb` no demuestra el resultado sobre la base actual.

**Qué debe pasar:** `git fetch origin && git merge --no-edit origin/develop`, conservar:
1. authorization condicional;
2. request-states condicional;
3. global-settings condicional;
4. descripción genérica del status.

Luego correr/pushear y esperar CI exact-head nuevo.

## Checks del SHA b20d7cb

CI `37051189722`: audit, unit, lint, build, db-tests, typecheck, bundle-budget ✅.

E2E Preview `37051338095`: status GREEN, 9 tests GREEN, pero el comando confiable de develop solo ejecutó smoke/main-flow/request-states; authorization no entró todavía. Esto **no cierra T-305/#37**.

## Resultado

**CON BLOQUEANTES (2).** No hay decisiones nuevas. La siguiente corrección es mecánica: sincronizar `origin/develop`, preservar los tres gates opcionales y arreglar el body literal con evidencia del nuevo SHA. No aprobar ni mergear todavía.
