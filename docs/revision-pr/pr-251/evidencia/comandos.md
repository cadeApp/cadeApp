# Evidencia y comandos — PR #251

## Ronda 7 — revalidación ambiental

### Run
`e2e-preview` `37433304282`, attempt 2, job `112489877756`.

Resultado:

```text
35 passed
1 failed
```

### T-313
```text
DoD courier                    GREEN
DoD sin consentimiento         GREEN
DoD alta completa              RED
```

Fallo:

```text
merchant-registration.spec.ts:184
Locator: getByRole('alert')
Expected: 0
Received: 1
```

### Artifact
Artifact `11443831505`, `playwright-report`.

Page snapshot final:
- heading `Revisá tu email`
- copy neutral de registro exitoso
- un único `alert` vacío

Trace:
```html
<NEXT-ROUTE-ANNOUNCER>
  <template shadow-root="open">
    <div
      aria-live="assertive"
      id="__next-route-announcer__"
      role="alert"
    />
  </template>
</NEXT-ROUTE-ANNOUNCER>
```

El mismo route announcer aparece en el snapshot inicial, antes de enviar el formulario.

### Conclusión
La modificación manual en Supabase Develop permitió completar el alta. El rojo actual es un falso positivo del selector E2E global, no evidencia de error de Auth.

### Sincronización
Rama: 23 ahead / 34 behind respecto de develop `5c7febf6c2a4cba97d29148cc797e373103bd838`.

### P3
Solicitud existe en comment `5999858656`; no hay respuesta explícita P3 registrada.

## Ronda 8 — H09 corregido; fallo real en merchant onboarding

### SHA revisado

```text
b62331f5c96b2c79da5fac2960bf7e9baa815210
```

El job E2E hizo checkout explícito de ese SHA.

### Sincronización

```text
develop = 64dfdf653219c6cf08a223c0df829353d9d9d8f1
HEAD    = b62331f5c96b2c79da5fac2960bf7e9baa815210
ahead   = 27
behind  = 1
mergeable = true
```

El commit pendiente de develop corresponde a T-345 / CC-023 y no toca T-313 ni merchant onboarding.

### CI

```text
CI              37567209715  success
approval-policy 37567207925  success
Vercel                         success
e2e-preview      37567338127  failure
```

### trusted e2e-preview

Run `37567338127`, job `112618005276`:

```text
T-313 alta completa             FAIL (+ retry #1 + retry #2)
T-313 courier                   PASS
T-313 sin consentimiento        PASS

44 passed
1 failed
```

Fallo final:

```text
Expected URL: /merchant/dashboard
Received:     /merchant/onboarding
merchant-registration.spec.ts:228
```

Artifact `11458974386`:

```text
Ocurrió un error al guardar los datos. Por favor reintentá.
```

Trace seguro del POST `/merchant/onboarding`:

```text
{ ok: false, code: "INTERNAL_ERROR" }
```

No se copiaron cookies, tokens, emails ni datos personales del trace.

### H09

El locator actual está acotado al formulario:

```ts
const registrationError = page.locator('form').getByRole('alert');
await expect(registrationError).toHaveCount(0);
```

El mismo run avanza más allá de esa aserción hasta el submit de onboarding. H09 queda revalidado.

### Enumeración de merchantOnboardingAction

Ramas que pueden devolver `INTERNAL_ERROR` en el tramo alcanzado:

1. lectura/validación de `platform_settings.pilot_terms_version`;
2. upsert de `consents(pilot_terms)` vía admin;
3. update de `profiles` vía cliente autenticado;
4. upsert de `merchants` vía cliente autenticado.

Precondiciones estáticas verificadas:

- documento publicado `pilot_terms = 1.0`;
- T-321 siembra `pilot_terms_version = "v1"` y la action lo normaliza a `1.0`;
- el seed usa `ON CONFLICT DO NOTHING`, así que no prueba el valor remoto actual;
- SELECT de `platform_settings` está permitido a `authenticated`;
- CC-007 permite update a actor `active`;
- el E2E comprueba `consent_status=active` antes del onboarding;
- `merchants.subscription_status` default = `pilot`.

Los unit tests de `src/features/merchants/actions.test.ts` mockean esos cuatro accesos y no reproducen la integración remota.

### Observabilidad externa

- El conector Supabase accesible en esta sesión no expone cadeApp Develop; no se consultó ni modificó ningún otro proyecto.
- Vercel runtime logs en la ventana exacta del fallo no contienen un error de aplicación para `/merchant/onboarding`. La action devuelve el código de dominio sin loguear qué operación interna falló.

Conclusión: la causa raíz exacta sigue **no demostrada**.

### P3

Solicitud: comentario `5999858656`. No existe visto bueno explícito P3 en las reviews/comentarios actuales.

## Ronda 9 — causa raíz productiva + decisión D03-A

### HEAD y sincronización

```text
HEAD    4f3dacd01dc350c36f937a629ddfd6bf1f2a9f78
develop a773c05cc488a1fc60bfb36512cdca35d12d1271
ahead   31
behind  1
```

El commit pendiente de develop es T-347 documental.

### Checks

```text
CI              37576126221  success
approval-policy 37576188205  success
Vercel                         success
e2e-preview HEAD 37576209756 cancelled
```

El Preview funcional usado para diagnóstico sigue siendo:

```text
run 37575010421
SHA 9cd4bdb763ddf4266c30068a3e8511af8bf1af2d
45 passed / 1 failed
```

Línea discriminante:

```text
[T-313 Onboarding Diagnostic] setting=v1; pilotConsent=1.0; profileUpdated=true; merchantUpdated=false
```

### Enumeración completa del tramo merchants

`handle_new_user()`:

```sql
if requested_role = 'merchant' then
  insert into public.merchants (profile_id) values (new.id);
end if;
```

Por lo tanto la fila merchant ya existe antes del onboarding.

Action actual:

```ts
await supabase
  .from('merchants')
  .upsert(merchantPayload as never);
```

Policies self-service vigentes:
- `merchants_select_self`;
- `merchants_update_self`;
- no existe `merchants_insert_self`.

La policy UPDATE además congela:
- `subscription_status`;
- `paid_until`;
- `notes`.

El formulario y el schema sí exponen `notes` como dato editable del onboarding.

### Conclusión

La causa raíz ya no es una hipótesis ambiental:

1. la action usa semántica INSERT/UPSERT sobre una fila que el trigger ya creó;
2. el actor authenticated no tiene INSERT self;
3. aunque se cambiara solo a UPDATE, `notes` seguiría siendo bloqueado por la policy actual cuando la persona escriba una referencia.

### Decisión

Lautaro073 eligió **D03-A**: corregir el bug productivo en esta misma PR.

Guardas de la decisión:
- no agregar INSERT self;
- no usar admin/service role para merchant;
- UPDATE solo de campos editables;
- permitir `notes`;
- mantener protegidos `subscription_status` y `paid_until`;
- exigir pruebas unitarias, pgTAP y E2E.

### Body

El body ya usa los runs recientes, pero todavía contiene:
- `pnpm test` pasado arriba y `test ❌` dentro del informe;
- rollback que afirma que no toca producción, incompatible con D03-A.

### P3

No hay visto bueno explícito P3. Como el spec se modificará para cubrir notas, P3 debe revisar la versión final.

## Ronda 10 — validación de migración en feature branch

### migrate.yml

La workflow de migraciones solo corre en push a `develop`, `staging` o `main`.
Para Develop, el comentario contractual dice que nunca se migra desde una feature branch porque la base es compartida por todos los Preview.

### ci.yml / db-tests

El job `db-tests` de PR:
- levanta Supabase local;
- aplica las migraciones de la rama;
- ejecuta `pnpm supabase test db`;
- compara tipos locales.

### e2e-preview.yml

El trusted Preview:
- hace checkout del SHA de la PR;
- verifica que las credenciales apunten a Supabase Develop;
- **no aplica migraciones**;
- ejecuta Playwright contra el Vercel Preview y la base Develop ya existente.

### Regla para H11

La evidencia pre-merge se divide así:

```text
unit                -> action usa UPDATE y falla si 0 filas
db-tests / pgTAP    -> notes permitido; subscription_status/paid_until siguen protegidos
e2e-preview         -> onboarding normal llega al dashboard con la action corregida
```

No se aplica la migración de la feature manualmente a Develop.


## Ronda 11 — H11 GREEN + Preview bloqueado por migration + D04-A

### HEAD

```text
9d0556ab56f581f95850fbbd319d0908f88d97e1
```

Sincronización:

```text
develop 284683b65e25e10b94e9286a03b4fc85a2cfada3
ahead 42
behind 0
mergeable true
```

### CI 37668929864

Jobs:

```text
unit           PASS
db-tests       PASS
typecheck      PASS
lint           PASS
build          PASS
audit          PASS
bundle-budget  PASS
```

Unit:

```text
src/features/merchants/actions.test.ts (13 tests) PASS
Test Files 123 passed (123)
Tests 1942 passed (1942)
```

DB:
- `supabase/tests/rls_matrix.sql` declara `select plan(65)`;
- el job aplica `20261007081131_t313_merchant_onboarding_update_policy.sql`;
- `Result: PASS`.

### H11

Action inspeccionada:
- UPDATE de `merchants`;
- filtro por `profile_id = user.id`;
- `select('profile_id').maybeSingle()`;
- error o cero filas => `INTERNAL_ERROR`;
- payload sin `profile_id`, `subscription_status` ni `paid_until`.

Migration inspeccionada:
- no INSERT policy;
- ownership + actor activo;
- `subscription_status` y `paid_until` congelados;
- `notes` editable.

H11 queda arreglado-verificado.

### Preview actual

Status `e2e-preview` apunta al run `37669080365`.

`resolve-preview`:

```text
BLOCKED / REQUIRES DEVELOP MIGRATION
```

Jobs:

```text
resolve-preview        success
e2e-preview            skipped
report-preview-status  skipped
```

No hubo ejecución de Playwright sobre el HEAD actual.

### D04-A

Lautaro073 decidió separar a una PR previa únicamente:
- `supabase/migrations/20261007081131_t313_merchant_onboarding_update_policy.sql`;
- cambio T-313/H11 de `supabase/tests/rls_matrix.sql`;
- ficha/bitácora mínima necesaria para declarar el subalcance.

Después del merge de esa PR:
1. esperar migrate-develop GREEN;
2. mergear origin/develop en #251;
3. comprobar que migration + pgTAP ya no forman parte del diff de #251;
4. ejecutar trusted Preview normal;
5. exigir baseline T-313 GREEN antes de cualquier mutación de H04.

### P3

Comment de solicitud: `5999858656`.
No hay visto bueno explícito P3.

## Ronda 12 — T-348 mergeada, baseline navega mal aunque merchant persiste

### Comparación y sincronización

```text
develop cd023e3453ead76983d54982df1548cb97aa57eb
HEAD    39ceff9890da8906d5d19457587ec33718d73814
ahead 46
behind 0
```

`develop...HEAD` no incluye `supabase/migrations/**` ni `supabase/tests/**` propios.

T-348 / PR #302: `migrate-develop` run `37693700041`, job `113039919723`, GREEN; log `Applying migration 20261007081131_t313_merchant_onboarding_update_policy.sql...`, `Finished supabase db push.`.

### CI / Vercel

CI `37703591192`, checkout HEAD `39ceff9`:
```text
typecheck PASS
lint PASS
unit PASS
db-tests PASS
build PASS
audit PASS
bundle-budget PASS
Vercel success
approval-policy 37703586790 success (no equivale a P3)
```

### Trusted e2e-preview

```text
Run:      37703693643
Job:      113072983040
Checkout: 39ceff9890da8906d5d19457587ec33718d73814
Resultado: 45 passed / 1 failed
```

```text
DoD: Un courier no entra a (merchant)                              PASS
DoD: Sin consentimiento guardado el comercio no llega al panel      PASS
DoD: Alta completa y panel visible con versión de consentimiento    FAIL
```

El último caso falla en `merchant-registration.spec.ts:285`, luego de dos retries:

```text
[T-313 Onboarding Diagnostic] setting=v1; pilotConsent=1.0;
profileUpdated=true; merchantUpdated=true

Expected: /merchant/dashboard
Received: /merchant/onboarding
```

Se confirma persistencia del merchant; el redirect no está aislado entre middleware, dashboard y router cliente. La hipótesis de caché de la bitácora no tiene prueba de causalidad. `revalidatePath` introducido en este SHA no resolvió el test.

### Próxima verificación discriminante

Sin publicar datos personales: registrar solo status y pathname de redirects de `/merchant/dashboard`, y comparar respuesta autenticada sin seguir redirects con la navegación real `router.push`/ `router.refresh`.

No sustituir el flujo del botón por un `page.goto` para forzar GREEN.

### P3

Sin visto bueno explícito en comments/reviews. H04 y H10 siguen abiertos.

## Ronda 14 — D05-A: RED navegación previo, GREEN completo real

```text
HEAD       56b3c70d66740210de29d1183aa16fed1487eae1
develop    d2ad3315ae9403194a35726b25f84996110a9216
ahead      50
behind     0
```

### Delta funcional respecto de ronda 13

```text
docs/tasks/T-313.md
docs/tasks/log/T-313.md
src/features/merchants/components/onboarding-form.tsx
```

- La ficha permite explícitamente D05-A.
- Solo después de éxito real de action: `window.location.assign(result.data.redirectTo)`.
- Sin modificación de guardas, migrations, pgTAP, ni assertions E2E.

### RED funcional previo

Run `37747382851` sobre `5c5adfb`: **51 passed / 1 failed**, solo onboarding. Sonda: merchantUpdated=true, RSC /merchant/dashboard -> 307 /merchant/onboarding, GET directo 200.

### GREEN real posterior

Run `37803965180`, job `113403336124`: explicit checkout `56b3c70d66740210de29d1183aa16fed1487eae1`.

```text
✓ DoD: Alta completa y panel visible con la versión de consentimiento registrada
✓ DoD: Un courier no entra a (merchant)
✓ DoD: Sin consentimiento guardado el comercio no llega al panel
52 passed (12.2m)
3 passed (1.1m)
```

Los 52 corresponden a Chromium; los 3, a global-settings.

### CI y statuses del HEAD

```text
CI                 37752334333   success
approval-policy    37753362975   success
Vercel                            success
e2e-preview        37803965180   success
```

Unit, db-tests, lint, typecheck, build, audit y bundle-budget GREEN.

### Restricción residual H04

El RED del run 37747382851 fue **de navegación**. No se debe presentarlo como RED de la guarda que rechaza courier: no hubo una mutación discriminante de esa guarda. T-347 solo permite mutaciones catalogadas sobre develop; falta decisión de secuencia segura.

### H10

Body sigue describiendo Vercel rate-limited y Preview viejo RED, con caracteres con tildes degradados a `?`; debe actualizarse a run 37803965180 y status SUCCESS, sin falsificar el RED courier.

## Ronda 15 — D06-C y H10 verificado

```text
HEAD        77d430b2d252e1fc814c924647ad9848206078a6
develop     24aad21f800f0d13fdeb082f9807b8eaf1f10fba
ahead       51
behind      4
CI          37870792954 success
Vercel      success
approval    success
e2e-preview 37870885019 success
```

El run E2E `37870885019` hizo checkout exacto de `77d430b2`, pasó los tres casos T-313 y registró 52 Chromium + 3 global-settings GREEN. El body actual de #251 contiene tildes correctas, evidencia terminal y mantiene la casilla RED courier abierta; H10 cerrado en el SHA documental.

**Decisión Lautaro073 D06-C:** preparar PR de catálogo antes de #251, ejecutar mutación solo postmerge. Catálogo abierto en [PR #315](https://github.com/cadeApp/cadeApp/pull/315), head `56feab2afa1db30e56d5e2e01e3a691d7c1e2034`, draft, sin merge.

**Aún no hubo RED courier**: el catálogo solo contiene un patch a aplicar sobre un checkout efímero con build en 127.0.0.1. El spec de T-313 no está en develop hasta mergear #251; prohibido despachar la mutación antes.
