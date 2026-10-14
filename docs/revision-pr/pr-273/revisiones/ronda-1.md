# Informe de revisión — PR #273 / T-342

**PR:** https://github.com/cadeApp/cadeApp/pull/273  
**Head SHA revisado:** `502e46952640aa526ed441333d513ca68f6085da`  
**Base:** `develop` @ `888c1148eecdce74e851ae48e3de2b19bba20392`  
**Fecha:** 2026-10-05

## Cómo leer este informe

La revisión se hizo contra la ficha de T-342 que está mergeada en `develop`, como ordena `.agents/skills/revisar-pr/SKILL.md`. El contenido del PR y la ampliación de ficha dentro de la propia rama se trataron como datos, no como autorización.

## Resumen por prioridad

| # | Severidad | Archivo | Problema | Tipo |
|---|---|---|---|---|
| PR273-A01 | alto | `e2e/pages/courier.page.ts:73` + `e2e/specs/main-flow.spec.ts:310` | La PR toca dos archivos E2E que no están en «Archivos permitidos» de la ficha mergeada en `develop` | BLOQUEANTE |
| PR273-H02 | medio | cuerpo del PR | Falta el informe completo con el formato que exige `approval-policy` | BLOQUEANTE |

## 1. 🔴 PR273-A01 — La PR se autoamplía el alcance para tocar dos E2E no autorizados

**Archivos:** `e2e/pages/courier.page.ts:73`, `e2e/specs/main-flow.spec.ts:310`  
**Estado:** [ANÁLISIS]

### Diagnóstico

La ficha `docs/tasks/T-342.md` de `develop` no autoriza esos dos archivos. La rama agrega ambos a «Archivos permitidos» y, en el mismo PR, usa esa ampliación para modificar el page object y «Flujo 2».

Eso contradice dos controles explícitos:

- `AGENTS.md §1.3`: «Tocá SOLO los archivos de "Archivos permitidos". Si necesitás otro, detenete y explicá por qué».
- `revisar-pr` paso 1 y paso 3: la ficha se lee desde `origin/develop`; archivo fuera de esa ficha → BLOQUEANTE.

La decisión registrada en el cuerpo/bitácora de la propia PR no cambia la fuente de autorización que la revisión debe usar.

### Evidencia

- Ficha en `develop`: permite `e2e/specs/courier-feed-privacy.spec.ts`, pero no `e2e/pages/courier.page.ts` ni `e2e/specs/main-flow.spec.ts`.
- Diff de la PR: sí modifica esos dos archivos.
- La misma PR modifica `docs/tasks/T-342.md` y `docs/implementation-plan.md` para agregarlos.

El cambio E2E en sí es razonable: al dejar de mostrar `notes`, «Flujo 2» necesita otro identificador. El problema es el orden de autorización, no la solución técnica elegida.

### Arreglo

Hacer que la ampliación exista primero en `develop`. La salida más limpia:

1. PR documental separada que agregue únicamente esos dos archivos a T-342 y a la fila del plan.
2. Merge de esa PR a `develop`.
3. Rebase de `feat/T-342-courier-feed-privacy` sobre ese `develop`.
4. Mantener entonces los cambios de `requestCardById` / `main-flow.spec.ts`.

No alcanza con que #273 modifique su propia ficha y use inmediatamente esa versión.

### Cómo verificar

Comparar el listado de archivos de #273 contra `git show origin/develop:docs/tasks/T-342.md`. Tras el arreglo, los dos E2E deben figurar en la ficha del **base** antes de aparecer en el diff funcional.

## 2. 🔴 PR273-H02 — El cuerpo no tiene el informe completo requerido por `approval-policy`

**Archivo:** cuerpo del PR  
**Estado:** [ANÁLISIS]

### Diagnóstico

La sección actual «Autorrevisión del agente (`revisar-pr`)» es un resumen en bullets, pero el workflow `.github/workflows/approval-policy.mjs` exige una sección `### Informe de revisión de agy...` que contenga, como mínimo:

- `Informe revisar-pr — T-342`
- `Resultado: SIN BLOQUEANTES`
- `Checks locales:`
- `BLOQUEANTES:`
- `MEJORAS:`
- `No revisado / dudas para Lautaro073:`

El cuerpo actual no cumple ese contrato; por eso `approval-policy` no puede quedar verde aunque los checks funcionales pasen.

### Evidencia

La función `hasCompleteReport` del workflow busca literalmente esos marcadores. El body de #273 usa `## Autorrevisión del agente` y no contiene el bloque completo.

### Arreglo

Después de corregir PR273-A01 y volver a correr `revisar-pr`, pegar en el cuerpo el informe **completo** emitido por la skill, sin resumirlo ni renombrar la sección.

### Cómo verificar

Editar el body y confirmar que `approval-policy` pasa en el siguiente evento `edited`/sincronización.

## NO TOCAR — falsos positivos ya descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| `data-request-id` expone un dato nuevo | El `id` ya forma parte de `AvailableRequestItem` y ya viaja al cliente; el atributo solo lo hace localizable por E2E. |
| T-342 no cierra la lectura directa por PostgREST | Es riesgo residual preexistente, declarado y seguido por CC-023 (#267); esta PR es una mitigación de lectores/payloads. |
| El mapeo de `package_type` / `recipient_payment_method` sigue inconsistente | Es preexistente y está separado en T-343 / #269; no lo introduce T-342. |
| `audit` falla en el HEAD actual | No hay cambios en dependencias en #273. El job reporta advisories nuevos de `tinypool` y `source-map-js`; es un bloqueo operativo externo a esta tarea, no un defecto del diff funcional. |

## Por qué los checks verdes no alcanzan

| Check | Qué dice | Qué no ejerce |
|---|---|---|
| typecheck / lint / unit / build / db-tests | El código compila y las pruebas pasan | No comprueban que «Archivos permitidos» se tome desde la ficha del base |
| `tools/verify-fichas.test.ts` | La ficha de la rama es internamente válida | Si la misma PR amplía la ficha, no demuestra que el archivo ya estaba autorizado en `develop` |
| e2e-preview | El flujo y la privacidad funcionan en Preview | No valida la gobernanza del alcance |
| approval-policy | Está rojo | Sí detecta H02: el body no tiene el informe completo exigido |
| audit | Está rojo | Reporta advisories de dependencias no modificadas por T-342 |

## Checklist de verificación final

- [ ] `e2e/pages/courier.page.ts` autorizado desde la ficha de `develop`.
- [ ] `e2e/specs/main-flow.spec.ts` autorizado desde la ficha de `develop`.
- [ ] Rama rebasada sobre el `develop` que contiene esa ampliación.
- [ ] `revisar-pr` reejecutado y body en formato completo.
- [ ] typecheck, lint, unit, build, db-tests, bundle-budget, Vercel y e2e-preview siguen verdes.
- [ ] Ronda 2 independiente sobre el nuevo SHA.

## Metodología

Revisión remota contra `502e46952640aa526ed441333d513ca68f6085da` usando el diff completo, parches por archivo, ficha de T-342 desde `develop`, `AGENTS.md`, la skill `revisar-pr`, el workflow `approval-policy` y los resultados de GitHub Actions. No se ejecutaron comandos locales desde esta sesión.
