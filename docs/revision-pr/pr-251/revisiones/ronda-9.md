# PR #251 · T-313 — Ronda 9

- **SHA funcional revisado:** `4f3dacd01dc350c36f937a629ddfd6bf1f2a9f78`
- **Commit previo de revisión:** `b0e0821f9c1f0d62698c1cd97180795e764c385b`
- **Fecha:** 2026-10-07
- **Resultado:** CON BLOQUEANTES (3)
- **Hallazgos nuevos:** 1 · H11
- **Hallazgos cerrados:** 0
- **Decisión nueva:** D03-A

## Evidencia funcional

El run trusted `e2e-preview` `37575010421`, sobre el SHA funcional `9cd4bdb763ddf4266c30068a3e8511af8bf1af2d`, produjo:

```text
45 passed
1 failed
```

El único fallo fue:

```text
DoD: Alta completa y panel visible con la versión de consentimiento registrada
```

La sonda discriminante devolvió exactamente:

```text
[T-313 Onboarding Diagnostic] setting=v1; pilotConsent=1.0; profileUpdated=true; merchantUpdated=false
```

Esto descarta como frontera del fallo:
- lectura/normalización de `pilot_terms_version`;
- persistencia de `pilot_terms`;
- update de `profiles`.

El tramo restante es la persistencia de `public.merchants`.

## H11 — NUEVO · BLOQUEANTE

La revisión estática cerró la causa raíz:

1. `public.handle_new_user()` crea una fila en `public.merchants(profile_id)` para cada alta con rol merchant.
2. `merchantOnboardingAction` vuelve a tratar esa fila como inserción mediante:
   ```ts
   supabase.from('merchants').upsert(...)
   ```
3. Las policies vigentes para self-service de `merchants` definen SELECT y UPDATE, pero no INSERT.
4. Un `INSERT ... ON CONFLICT DO UPDATE` sigue necesitando autorización para el camino INSERT; por eso el upsert de la sesión autenticada es incompatible con el modelo RLS aunque la fila ya exista.

Además, la policy `merchants_update_self` exige que:

```sql
notes is not distinct from (
  select m.notes
  from public.merchants m
  where m.profile_id = auth.uid()
)
```

por lo que el dueño tampoco puede cambiar `notes`. Sin embargo:
- `merchantOnboardingSchema` acepta `notes`;
- `MerchantOnboardingForm` muestra el campo «Referencia adicional»;
- `merchantOnboardingAction` intenta persistirlo.

Por eso **cambiar solamente `.upsert()` por `.update()` no alcanza**: el onboarding seguiría fallando cuando el usuario escriba una referencia.

### Corrección esperada

La fila merchant es preexistente y debe actualizarse como tal.

En la action:
- usar `TablesUpdate<'merchants'>`;
- UPDATE por `profile_id = user.id`;
- no enviar `profile_id`, `subscription_status` ni `paid_until` como campos mutables;
- exigir que el UPDATE haya afectado una fila; cero filas debe ser `INTERNAL_ERROR`.

En RLS:
- **NO** agregar `merchants_insert_self`;
- conservar ownership + `is_active_operational_actor()`;
- permitir `notes`;
- mantener inmutables para self-service `subscription_status` y `paid_until`.

Esto mantiene el alta de la fila bajo el trigger privilegiado y no amplía la capacidad del merchant a insertar filas arbitrarias.

## RED que debe demostrarse

Antes de implementar la corrección:

1. **pgTAP real:** ampliar la prueba de update legítimo de merchant para cambiar también `notes`. Con la policy actual debe fallar.
2. **Unit de action:** preparar el contrato para el camino UPDATE y para el caso cero filas; el código actual con `upsert` debe quedar RED.
3. No adulterar mocks para que den verde al código actual.
4. El trusted E2E actual ya es RED real para el flujo de usuario.

Después del arreglo:
- unit GREEN;
- db-tests GREEN;
- E2E positivo debe completar dashboard **incluyendo una nota no vacía** y verificarla en DB.

## Decisión D03-A — Lautaro073

Lautaro073 eligió la opción **A**: resolver el bug productivo dentro de esta misma PR.

Se autoriza ampliar la ficha T-313 únicamente con:

- `src/features/merchants/actions.ts`
- `src/features/merchants/actions.test.ts`
- una migración nueva generada con Supabase CLI para ajustar `merchants_update_self`
- `supabase/tests/rls_matrix.sql`
- el spec E2E T-313 para cubrir `notes`
- `docs/tasks/T-313.md`
- `docs/tasks/log/T-313.md`
- body de la PR
- `docs/revision-pr/**` sigue reservado a revisión.

No se autoriza:
- service role/admin para guardar merchant;
- policy INSERT self;
- relajar `subscription_status` o `paid_until`;
- tocar Staging;
- cambiar contratos no relacionados.

## H04

Sigue abierto. Primero debe quedar el baseline normal T-313 completamente GREEN con H11 resuelto.

Recién después puede ejecutarse el probe D02-A ya autorizado:

```text
GREEN baseline
→ RED courier
→ revert
→ GREEN final
```

T-347 todavía es solo una ficha documental; el workflow trusted de mutaciones aún no está implementado, por lo que no reemplaza el procedimiento ya autorizado para T-313.

## H10

El body se actualizó parcialmente:
- usa CI `37574917655`;
- usa Preview `37575010421`;
- describe correctamente el diagnóstico `merchantUpdated=false`.

Pero mantiene dos contradicciones:
1. arriba registra `pnpm test` con 122 archivos / 1940 tests pasados, mientras el informe de agy dice `test ❌`;
2. Rollback todavía afirma «no afecta código de producción», lo que deja de ser cierto bajo D03-A.

H10 continúa abierto hasta que el body refleje el nuevo alcance y los checks finales.

## Sincronización y checks

HEAD revisado:
`4f3dacd01dc350c36f937a629ddfd6bf1f2a9f78`

`develop` avanzó a:
`a773c05cc488a1fc60bfb36512cdca35d12d1271`

Estado:

```text
31 ahead / 1 behind
```

El commit pendiente es T-347 documental. Debe mergearse antes del siguiente cierre.

CI del HEAD:
- CI `37576126221`: GREEN
- approval-policy `37576188205`: GREEN
- Vercel: GREEN
- e2e-preview del HEAD documental `37576209756`: cancelado; no reemplaza la evidencia funcional `37575010421`.

## P3

Sigue faltando visto bueno explícito P3. Como el spec se modificará nuevamente para cubrir `notes`, el visto bueno debe pedirse sobre el spec final.

## Veredicto

**CON BLOQUEANTES: H04 + H10 + H11.**

No apruebo ni mergeo.
