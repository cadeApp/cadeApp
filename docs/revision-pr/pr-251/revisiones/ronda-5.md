# PR #251 · T-313 — Ronda 5

- **SHA revisado:** `1b23706d743664851fe7bf44e7a4c81d67577e55`
- **Fecha:** 2026-10-05
- **Resultado:** CON BLOQUEANTES (3)
- **Nuevos hallazgos:** 0
- **Decisiones nuevas:** 0

## H04 · ABIERTO

El nuevo `e2e-preview` `37376151360` no sirve como evidencia funcional: el resolver encontró correctamente la PR y el Preview, pero el job `e2e-preview` fue **cancelado antes de ejecutar Playwright**.

El status publicado al SHA fue `error`, no GREEN/RED.

Sigue faltando:

```text
baseline T-313 GREEN
→ probe D02-A
→ RED discriminante courier
→ git revert
→ GREEN final
```

## H05 · PARCIAL

Kira agregó `trackCreatedUserByEmailIfPresent` y lo llama inmediatamente después del click de “Crear cuenta”, antes de las aserciones UI. Eso elimina el hueco original en el happy path, pero no garantiza cleanup ante fallo.

Quedan dos residuales:

1. **Carrera:** `page.click()` no garantiza que el server action de registro haya terminado cuando el helper consulta Auth. Si `listUsers` devuelve `null` y la cuenta aparece después, una aserción UI puede fallar sin que el usuario haya quedado trackeado.
2. **Cobertura de paginación:** el helper revisa como máximo 5 páginas × 50 usuarios. Si el usuario exacto está fuera de esas 250 filas, devuelve `null`.

La reconciliación debe ejecutarse desde un `finally` posterior al flujo de alta o desde el teardown local, usando el email exacto registrado **antes del click**, y recorrer la paginación disponible hasta agotarla. Los errores de Admin no se silencian.

## H06 · ARREGLADO SIN VERIFICAR

La aserción:

```ts
expect(state.profile?.role).toBe('merchant');
```

está correctamente ubicada antes de `consent_status`.

Pero la evidencia RED declarada no valida esa aserción: al mutar temporalmente el fixture a `courier`, la ejecución local murió antes por:

```text
[E2E Fail-Closed] Proyecto Supabase 'desconocido'
```

Por lo tanto, el RED no llegó a `role === merchant`.

Para verificar H06 hace falta:
1. baseline de **ese caso** GREEN en Preview;
2. commit temporal cambiando solo ese fixture a `courier`;
3. comprobar que el mismo caso falla específicamente en la nueva aserción;
4. revertir el commit;
5. comprobar GREEN del caso restaurado.

Este probe puede hacerse aunque H04/DoD1 siga rojo, siempre que el caso H06 tenga baseline GREEN y la diferencia RED sea específica.

## H07 · CERRADO Y VERIFICADO

Se enumeró toda la bitácora del SHA revisado con patrones categóricos de SMTP. Resultado: **0 afirmaciones no calificadas**.

Las referencias actuales dicen correctamente:
- error de Auth observable;
- primer intento genérico;
- retries con rate-limit;
- email/SMTP/validación solo como hipótesis;
- causa raíz no demostrada.

## H08 · CERRADO Y VERIFICADO

Se comparó el body actual contra las secciones obligatorias del template. Están presentes:

- `### Qué cambia`
- `### DoD`
- `### Evidencia de checks`
- checkbox RED
- checkbox bitácora
- `### Informe de revisión de agy`
- `### Rutas de otra zona`
- `### Dependencias nuevas`
- `### Rollback`

Además, `approval-policy` del HEAD actual quedó GREEN.

## CI

Run `37375915213`: GREEN.

Todos los jobs observados quedaron success, incluidos lint, typecheck, unit, build, db-tests, audit y bundle-budget.

## Sincronización

La rama volvió a quedar 4 commits detrás de `develop`.

Los 4 commits nuevos son de contratos/skills/fichas T-338–T-341 y no modifican el runtime de T-313, pero regla 50 exige rama al día antes del cierre.

## Aprobaciones

- Lautaro073 tiene una aprobación GitHub registrada y `approval-policy` está GREEN.
- Eso **no sustituye** el visto bueno P3 exigido por la ficha sobre `e2e/specs/merchant-registration.spec.ts`.
- P3 sigue pendiente.

## Veredicto

**CON BLOQUEANTES (3): H04, H05, H06.**

No apruebo ni mergeo.
