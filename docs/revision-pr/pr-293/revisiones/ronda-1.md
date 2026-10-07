# Informe de revisión — PR #293 / T-347 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/293  
**HEAD revisado:** `dfb5fb1cf9db5013a322c11129b97b063a6ded8b`  
**Base:** `develop` @ `64dfdf653219c6cf08a223c0df829353d9d9d8f1`  
**Fecha:** 2026-10-07

## Resultado

**CON BLOQUEANTE (1).**

La rama estaba sincronizada: `ahead 1 / behind 0`. El diff funcional es únicamente documental:

- `docs/implementation-plan.md`;
- `docs/tasks/T-347.md`;
- `docs/tasks/log/T-347.md`.

No había historial previo en `docs/revision-pr/pr-293/**`.

## PR293-H01 — `workflow_dispatch` no establece la frontera trusted que declara la ficha

**Severidad:** alta · **categoría:** correctness/security · **patrón:** P01-contrato-de-framework-no-verificado.

La ficha afirma en `docs/tasks/T-347.md:47-52`:

```text
Disparo: on: workflow_dispatch
Confianza: corre con el workflow de la rama por defecto,
así que la PR bajo prueba no puede reescribirlo.
```

Esa propiedad no está garantizada por `workflow_dispatch`.

Un workflow manual debe existir en la rama por defecto para estar disponible, pero una ejecución manual puede seleccionar otro ref. El run usa el workflow/configuración de ese ref. Por lo tanto, una rama del mismo repositorio podría modificar `e2e-mutation.yml` y ejecutar esa variante con `environment: develop`.

Un guard dentro del mismo YAML, por ejemplo `if: github.ref == 'refs/heads/develop'`, no es una frontera suficiente: la misma rama que modifica el workflow puede eliminar ese guard.

Esto contradice el objetivo de T-347, que pretende que el workflow sea trusted y que código de una rama no pueda reescribir la lógica que entrega los secretos del Environment `develop`.

### Comparación con el patrón existente

`e2e-preview` usa `repository_dispatch`. Ese evento ejecuta la definición disponible en la rama por defecto; luego el target de la PR se trata como dato no confiable y se valida antes de ejecutar el E2E.

T-347 debe conservar esa separación:

- **workflow/control plane:** rama por defecto;
- **target SHA y mutation id:** datos no confiables;
- **checkout objetivo:** sin credenciales persistentes;
- **catálogo de mutaciones:** rama por defecto, no la PR.

### Corrección decidida

Lautaro073 eligió **0-B**:

- reemplazar `workflow_dispatch` por `repository_dispatch`;
- usar un `event_type` dedicado, por ejemplo `e2e.mutation.requested`;
- leer `target` y `mutation` desde `github.event.client_payload`;
- validar ambos como datos no confiables;
- mantener `environment: develop`, permisos mínimos y `concurrency: cadeapp-develop-e2e`;
- tests estructurales deben exigir `repository_dispatch` y prohibir `workflow_dispatch` para este workflow.

Con esa corrección H01 puede cerrarse en la siguiente ronda.

## Decisiones aceptadas

### PR293-A01 — 0-B · trigger trusted

**Decisión:** `repository_dispatch` con event type propio.

Estado: **aceptado**.

### PR293-A02 — 1-A · catálogo versionado

**Decisión:** mantener `e2e/mutations/manifest.json` + patches revisados en `develop`; cada mutación nueva requiere PR.

Estado: **aceptado**.

Esto evita que el mecanismo acepte como entrada código de mutación que nunca fue revisado.

### PR293-A03 — 2-A · ejecución solo dentro del runner

**Decisión:** control y mutante usan `next start -H 127.0.0.1` dentro del runner trusted.

Estado: **aceptado**.

No se despliega el mutante en Vercel ni se publica en una URL accesible externamente.

### PR293-A04 — 3-A · validación post-merge

**Decisión:** el workflow se valida de punta a punta después de entrar a la rama por defecto. Si alguna mutación no termina `RED_CONFIRMED`, #289 debe permanecer/reabrirse aunque `board-sync` la haya cerrado.

Estado: **aceptado**.

## Catálogo inicial y defensa en profundidad

La ficha reconoce correctamente una limitación importante: MFA AAL2 y DNI tienen defensas también en PostgreSQL.

En el spec T-302, el caso MFA comprueba directamente `admin_decide_courier` con una sesión AAL1. Por eso una mutación únicamente de `src/**` puede sobrevivir si la barrera DB sigue rechazando el escenario.

La regla propuesta es correcta y debe conservarse:

- si el mutante queda `MUTANT_SURVIVED` o el control no está GREEN, no cambiar el spec;
- no mutar Supabase Develop;
- frenar y consultar a Lautaro073;
- tratarlo como señal de que el caso protege otra capa de la declarada.

No se exige que la ficha invente una mutación DB para forzar RED.

## Otros puntos revisados

### Catálogo

La decisión 1-A mantiene el diseño más seguro: solo patches revisados en `develop`; ningún patch ad hoc entra por el evento.

### Runtime

La decisión 2-A mantiene el mutante fuera de Vercel. La corrida de control GREEN contra el mismo runtime `next start` es obligatoria antes de interpretar un RED.

### Entorno

La ficha conserva:

- verificación positiva del proyecto Supabase Develop;
- ref de producción obligatorio y distinto;
- base URL local exacta;
- `isAllowedE2EEnvironment` sin cambios;
- secretos solo en runner;
- ningún secreto en artifacts;
- `persist-credentials: false`;
- sin token de Vercel.

### Resultado RED

El resultado solo puede ser `RED_CONFIRMED` si:

1. control GREEN;
2. patch aplicó limpio;
3. mismo caso quedó RED;
4. el fallo coincide con `expectedFailure`;
5. árbol restaurado.

No se encontró otro bloqueante en esta etapa de diseño.

## CI del HEAD revisado

CI run `37575457747`:

- lint ✅
- build ✅
- unit ✅
- typecheck ✅
- audit ✅
- db-tests ✅
- bundle-budget ✅

Vercel ✅.

`approval-policy` falla porque todavía no existe un informe independiente **SIN BLOQUEANTES**. Eso es correcto en esta ronda.

## Cierre

Hay **un solo bloqueante**: corregir la frontera trusted del disparador.

No implementar el workflow antes de arreglar la ficha; el error está en el contrato de la tarea, no en una implementación todavía inexistente.

La revisión independiente no aprobó ni mergeó la PR.
