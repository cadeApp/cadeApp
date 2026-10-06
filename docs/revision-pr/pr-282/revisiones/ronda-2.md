# Informe de revisión — PR #282 / CC-023 — ronda 2

**PR:** https://github.com/cadeApp/cadeApp/pull/282  
**Head SHA revisado:** `39153caa7ad1cb5f617115fd2fc3f2734462c7ee`  
**Base:** `develop` @ `80f0b56a9ff94d3c4e10fb215c63faccd9097365`  
**Fecha:** 2026-10-06

## Resultado

**CON BLOQUEANTES (2 nuevos).**

PR282-H01 y PR282-H02 quedan cerrados por inspección independiente del SHA revisado. El cambio no implementa todavía T-345; los dos bloqueantes nuevos están en el plan de rollout.

## H01 — cerrado

El CC ahora:

- enumera `getMerchantHistoryRequests`, `getMerchantRequests` y `getMerchantRequestWithOffers`;
- registra que `RequestOffersList` muestra el monto exacto de cambio;
- conserva la decisión 1-A mediante `get_merchant_request_private_fields`;
- quita de los listados la lectura muerta de `cash_change_amount`;
- exige tests de contrato, wrapper, queries, UI y E2E;
- actualiza tipos generados, fake y matriz de privacidad.

**Estado:** `arreglado-verificado` por inspección en `39153ca`.

## H02 — cerrado

El fallback ya no usa `ALTER PUBLICATION ... SET TABLE`. La alternativa:

1. elimina solo `public.delivery_requests` de `supabase_realtime`;
2. la vuelve a agregar con column list;
3. conserva `public.offers`;
4. exige verificar miembros de la publicación, columnas privadas excluidas y replica identity;
5. solo se aplica si el E2E demuestra que los grants por columna no bastan.

**Estado:** `arreglado-verificado` por inspección en `39153ca`.

## PR282-H03 — tres PR para una sola T-345 contradicen la regla raíz

**Severidad:** decisión.  
**Patrón:** P10-desvio-de-ficha-sin-consultar.

`docs/tasks/T-345.md` define «Rollout obligatorio: tres PR, en orden» y dice que cada paso es una PR de la misma T-345.

Eso contradice explícitamente:

```text
AGENTS.md §5:
Una tarea = un issue = una rama feat/T-xxx-slug = un PR
```

y `.agents/rules/50-git-y-coordinacion.md`, donde el trabajo en curso de una tarea vive en una única rama/PR.

El rollout técnico en tres despliegues es razonable y está bien justificado por los workflows reales, pero no puede expresarse como tres PR del mismo issue sin una decisión de proceso.

### Decisión pendiente para Lautaro073

**A — recomendada:** dividir el rollout en tres tareas/issues consecutivos, cada una con una sola rama/PR:
- paso 1: RPC de compatibilidad;
- paso 2: migración de lectores;
- paso 3: enforcement + Realtime/E2E.

CC-023 bloquea las tres y define sus dependencias encadenadas.

**B:** autorizar una excepción explícita a la regla «una tarea = un PR». Esta opción requiere reconciliar también la regla raíz/documentación de coordinación; no alcanza con escribir la excepción solo dentro de T-345.

No corresponde que agy elija entre A y B.

## PR282-H04 — PR 1 no puede pasar db-tests como está escrito

**Severidad:** alto.  
**Patrón:** P15-entregable-declarado-pero-no-ejecutable.

El rollout pone:

- PR 1: migración que crea `get_merchant_request_private_fields`;
- PR 2: «contrato, fake, wrapper y tipos generados».

Pero CI `db-tests` hace, después de aplicar las migraciones:

```bash
pnpm db:types --local
git diff --exit-code -- src/types/database.types.ts
```

Una función RPC nueva aparece en `Database['public']['Functions']`. Por lo tanto, si PR 1 crea la función y no commitea el cambio generado en `src/types/database.types.ts`, el drift check deja PR 1 rojo.

### Corrección requerida

`src/types/database.types.ts` debe actualizarse **en el mismo PR/paso que crea la RPC**, no en el paso de aplicación. El contrato Zod, fake, wrapper y lectores sí pueden quedar en el paso siguiente.

La ficha y CC deben asignar explícitamente `database.types.ts` al paso 1 y exigir el drift check verde allí.

## Verificación del rollout contra workflows

La razón para separar el enforcement sí está sustentada:

- `migrate.yml` aplica migraciones a `develop` en cada push mergeado;
- Vercel Develop despliega por integración de Git, sin depender de `migrate-develop`;
- en `staging` y `main`, `deploy.yml` espera al workflow `migrate`.

Por eso no es seguro juntar «lectores nuevos» y «revoke» en un único merge hacia develop. El defecto es cómo se modelaron esos pasos dentro del sistema de tareas, no la necesidad del rollout.

## CI del SHA revisado

Sobre `39153ca`:

- typecheck ✅
- lint ✅
- unit ✅
- build ✅
- audit ✅
- bundle-budget ✅
- db-tests ✅
- Vercel ✅
- e2e-preview: corrida cancelada por el gate/concurrency; el commit status quedó `error`, no un fallo funcional de specs
- approval-policy ❌ porque la PR todavía no tiene una revisión independiente SIN BLOQUEANTES.

## Conclusión

H01/H02 están resueltos. Quedan H03 (decisión humana de estructura de rollout) y H04 (tipos generados deben viajar con la migración que crea la RPC). No se mergea aún.
