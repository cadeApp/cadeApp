# PR #251 · T-313 — Ronda 8

- **SHA funcional revisado:** `b62331f5c96b2c79da5fac2960bf7e9baa815210`
- **Commit previo de revisión:** `d8085beb7b2a0fe54db5d32382c765990811aa64`
- **Fecha:** 2026-10-07
- **Resultado:** CON BLOQUEANTES (2)
- **Hallazgos nuevos:** 1 · H10
- **Hallazgos cerrados en esta ronda:** H09
- **Decisiones nuevas:** 0

## Alcance y sincronización

La rama contiene el arreglo de H09 y una actualización de bitácora después de la ronda 7. No hubo edición del autor dentro de `docs/revision-pr/pr-251/**` después del commit de revisión anterior.

Comparación contra `develop` vigente:

```text
HEAD    b62331f5c96b2c79da5fac2960bf7e9baa815210
develop 64dfdf653219c6cf08a223c0df829353d9d9d8f1
ahead   27
behind  1
```

El único commit pendiente de `develop` es el merge de T-345 / CC-023 sobre columnas privadas de `delivery_requests`; no toca T-313, auth ni merchant onboarding. Aun así, la regla de sincronización exige mergearlo antes del cierre final.

GitHub informa actualmente `mergeable=true`; la rama solo necesita quedar al día.

## H09 — CERRADO Y VERIFICADO

La corrección quedó en el spec:

```ts
const registrationError = page.locator('form').getByRole('alert');
await expect(registrationError).toHaveCount(0);
await expect(page.getByRole('heading', { name: /revisá tu email/i })).toBeVisible();
```

El trusted `e2e-preview` `37567338127` hizo checkout explícito de:

```text
b62331f5c96b2c79da5fac2960bf7e9baa815210
```

y el caso positivo ya no falla en el `role=alert`: avanza por el alta, inicia sesión y llega a `/merchant/onboarding`.

Estado H09: **arreglado-verificado** en `b62331f5c96b2c79da5fac2960bf7e9baa815210`.

## H04 — SIGUE ABIERTO: el baseline falla más adelante

Run oficial:

```text
e2e-preview 37567338127
44 passed
1 failed
```

T-313:

```text
DoD: Un courier no entra a (merchant)                           GREEN
DoD: Sin consentimiento guardado el comercio no llega al panel GREEN
DoD: Alta completa y panel visible...                           RED
```

El caso positivo falla después de enviar el formulario de onboarding:

```text
Expected: /\/merchant\/dashboard/
Received: /merchant/onboarding
merchant-registration.spec.ts:228
```

El artifact muestra el mensaje de UI:

```text
Ocurrió un error al guardar los datos. Por favor reintentá.
```

El trace del mismo run muestra que el POST a `/merchant/onboarding` responde con el resultado de Server Action:

```text
{ ok: false, code: "INTERNAL_ERROR" }
```

No se registran emails, cookies, tokens ni payloads sensibles en esta evidencia.

### Enumeración completa del origen posible

`merchantOnboardingAction` puede devolver `INTERNAL_ERROR` en esta parte del flujo por cuatro clases relevantes:

1. `platform_settings.pilot_terms_version`: ausencia, valor inválido o desalineado con el documento publicado;
2. upsert de consentimiento `pilot_terms` con `adminClient`;
3. update de `profiles` con la sesión autenticada;
4. upsert de `merchants` con la sesión autenticada.

Se revisaron también las precondiciones estáticas:

- `pilot_terms` publicado está en versión `1.0`;
- la migración T-321 siembra `pilot_terms_version = "v1"`, que la acción normaliza a `1.0`, pero usa `ON CONFLICT DO NOTHING`, por lo que el valor real de Develop no puede inferirse solo del repositorio;
- `platform_settings` tiene SELECT para `authenticated`;
- CC-007 permite updates de `profiles`/`merchants` a actores `active`;
- el E2E ya verifica que el perfil quedó `active` antes del onboarding;
- `merchants.subscription_status` nace por defecto en `pilot`, compatible con la policy que congela ese campo.

Por lo tanto, **no hay evidencia suficiente para elegir una causa raíz entre los cuatro puntos**. Los unit tests de `merchantOnboardingAction` mockean estas operaciones y por eso no contradicen el fallo real de integración.

El conector Supabase disponible en esta sesión no expone el proyecto cadeApp Develop, y Vercel no registra un error de runtime para ese Server Action porque el action traduce los errores internos al código de dominio `INTERNAL_ERROR` sin loguear la rama concreta.

No se abre un hallazgo de producto especulativo. H04 permanece como bloqueo E2E hasta obtener el diagnóstico discriminante y luego un baseline normal GREEN.

**D02-A sigue prohibido** hasta ese GREEN completo.

## H10 — NUEVO · BLOQUEANTE DE EVIDENCIA

El body actual conserva evidencia anterior y ya no describe el HEAD revisado. Entre otras cosas todavía afirma:

- `pnpm test` ❌ por contención local antigua;
- CI `37356183332`;
- Preview `37356334501 / 37359531243`;
- “DoD 1 ... pendiente por error de Auth en Supabase Develop”.

Pero para el HEAD revisado la evidencia vigente es:

```text
CI 37567209715                              GREEN
approval-policy 37567207925                 GREEN
e2e-preview 37567338127                     44 passed / 1 failed
fallo T-313                                 merchant onboarding -> INTERNAL_ERROR
```

El body mantiene la estructura obligatoria de la plantilla, así que H08 no reabre. H10 es una regresión del patrón P15: el entregable de evidencia quedó obsoleto y atribuye el bloqueo al diagnóstico anterior.

Debe actualizarse **después del próximo sync/diagnóstico**, usando los runs del nuevo HEAD y sin marcar DoD/RED globales como cumplidos mientras H04 continúe abierto.

## CI

El CI del SHA revisado está GREEN (`37567209715`) y `approval-policy` también (`37567207925`). El status combinado conserva `e2e-preview` en failure por `37567338127`.

No se toma CI verde como cierre porque el DoD E2E sigue rojo.

## P3

La solicitud de visto bueno existe en el comentario `5999858656`, pero las reviews actuales solo contienen CodeRabbit y la aprobación de Lautaro073. Sigue faltando una respuesta explícita P3 sobre `e2e/specs/merchant-registration.spec.ts`.

## Veredicto

**CON BLOQUEANTES (2): H04 + H10.**

Condiciones adicionales antes del cierre:

1. mergear el `develop` vigente;
2. diagnosticar el punto exacto del `INTERNAL_ERROR` sin debilitar el spec;
3. obtener baseline T-313 completo GREEN;
4. recién entonces ejecutar D02-A → RED courier → revert → GREEN final;
5. actualizar body/bitácora con evidencia vigente;
6. obtener visto bueno explícito P3.

No apruebo ni mergeo.
