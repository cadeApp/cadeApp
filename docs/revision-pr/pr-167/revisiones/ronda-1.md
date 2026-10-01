# Ronda 1 — PR #167 / T-322

**Fecha:** 2026-10-01  
**SHA funcional:** `6c7ace01cbb0ee7151271cceab10f51fbbdff78d`  
**Base:** `develop@f0238c3fd3c8c8dbfcb8b35e63ed45451c0e845c`  
**Resultado:** **CON BLOQUEANTES (4)**

## Alcance y CI

Los 14 archivos modificados están dentro de los archivos permitidos de T-322. No hay dependencias nuevas, cambios de contratos en `src/domain/**`, cambios de tipos generados ni modificaciones de policies/migraciones.

CI exact-head `36829069927` terminó verde:

```text
typecheck       success
lint            success
unit            success — 110 files / 1565 tests
build           success
bundle-budget   success
audit           success
db-tests        success — 13 files / 1614 tests
```

Los checks verdes no cubren los cuatro defectos de abajo.

## PR167-H01 — ALTO — nombre y teléfono siguen siendo opcionales en la frontera servidor

**Archivo:** `src/features/auth/schemas.ts:17-18`  
**Patrón:** P08-control-no-cubre-lo-que-dice

La UI marca ambos inputs como `required`, pero `registerSchema` conserva:

```ts
displayName: z.string().trim().max(100).optional(),
phone: z.string().trim().max(30).optional(),
```

Por lo tanto, la Server Action acepta:
- propiedad omitida;
- `displayName: ''` / `phone: ''`;
- valores formados solo por espacios, que tras `trim()` quedan vacíos.

Eso contradice el DoD de T-322 y deja posible crear perfiles con `display_name = ''` o `phone = null`. El helper de anti-enumeración incluso sigue enviando el formulario sin llenar los dos campos porque usa `fireEvent.submit`, por lo que el hueco queda demostrado por la propia suite.

**Arreglo requerido:** hacer ambos campos obligatorios en Zod con mínimo no vacío después de trim, no solo con HTML `required`. Agregar batería para ambos campos y las variantes omitido/vacío/solo espacios, verificando que `signUp` no se invoque.

## PR167-H02 — ALTO — después de confirmar el email el flujo todavía salta el onboarding

**Archivo principal:** `src/app/auth/confirm/route.ts:88-95`  
**Relacionados:** `src/features/auth/guards.ts:18-23,137-140`; `supabase/migrations/20260925170000_cc007_consent_enforcement.sql:365-368`  
**Patrón:** P08-control-no-cubre-lo-que-dice

T-322 corrigió la navegación **antes** del email, pero no la segunda mitad del flujo.

Una alta nueva ejecuta `activate_account_consents` antes de confirmar el correo; esa RPC deja `consent_status='active'`. Luego, al abrir el enlace, `/auth/confirm` llama:

```ts
resolvePostLoginRedirect(null, role, consentStatus)
```

Para un actor no-admin activo, el destino por defecto es:
- merchant → `/merchant/dashboard`;
- courier → `/courier/feed`.

Por tanto, el flujo real sigue siendo:

`registro → Revisá tu email → confirmar → dashboard/feed`

y **no** el flujo exigido por T-322:

`registro → Revisá tu email → confirmar → onboarding`.

Esto afecta ambas formas de confirmación aceptadas por T-320: PKCE `code` y `token_hash + type=signup`, y ambos roles.

**Arreglo requerido:** primero agregar una prueba RED que ejecute el retorno de confirmación y demuestre el defecto para merchant/courier y para las formas de signup relevantes; recién entonces usar la excepción explícita de la ficha para ajustar `/auth/confirm`. Mantener recovery → `/reset-password`, `type=email` y la defensa contra open redirects sin regresiones. No hardcodear un redirect que rompa cuentas que ya completaron onboarding.

## PR167-H03 — MEDIO — la pantalla llamada “neutral” afirma que se envió un email aunque puede no haberse enviado

**Archivo:** `src/features/auth/copy.ts:37-41`  
**Patrón:** P05-semantica-invertida-vs-dod

La anti-enumeración hace que `identities: []`, `user_already_exists` y `email_exists` terminen en la misma pantalla, pero el copy dice:

> “Te enviamos un enlace de confirmación.”

En esas señales, la app deliberadamente no puede garantizar que haya salido un email de confirmación. La UI es indistinguible, pero no es neutral y puede dejar al usuario esperando un correo que nunca llegará.

**Arreglo requerido:** usar copy condicional que no confirme existencia ni envío, por ejemplo “Si pudimos procesar el registro, vas a recibir un email con los próximos pasos”. Agregar un test que cubra todas las señales de cuenta existente y prohíba una afirmación definitiva de envío/existencia.

## PR167-H04 — MEDIO — el test que dice proteger contra `temp-courier-id` no puede detectar que vuelva el fallback

**Archivo:** `src/features/courier-onboarding/components.test.tsx:285-293`  
**Patrón:** P04-test-tautologico

El test llamado “no utilizan fallbacks a temp-courier ni temp-courier-id” siempre renderiza:

```tsx
<IdentityForm courierId="usr-real-123" />
<VehicleForm courierId="usr-real-123" ... />
```

Si se reintroduce:

```ts
courierId = 'temp-courier-id'
```

en cualquiera de los componentes, el test sigue verde porque nunca ejerce la ausencia del prop ni observa el valor usado por uploads. La mutación documentada en la bitácora solo reintrodujo `temp-courier` en la **página**, no el fallback de los **componentes** que el DoD también enumera.

**Arreglo requerido:** agregar un control que realmente falle al reintroducir cualquiera de los fallbacks de producción. Debe demostrar sensibilidad con mutación y no limitarse a renombrar el test o buscar el resultado esperado dentro del propio test.

## Follow-up fuera de alcance de esta PR

Se observó además el problema ya reportado por Lautaro en el onboarding merchant: hoy el barrio se presenta con un `<select>` nativo y la tabla `zones` no contiene la lista de barrios. **No debe corregirse dentro de T-322**, porque sería un desvío de alcance.

La tarea posterior debe conservar estas decisiones:
- usar el `Select` existente de `src/ui/select.tsx`;
- barrios de Aguilares por nombre;
- no inventar centroides;
- adaptar el modelo/flujo para que una zona sin centroide no fuerce coordenadas ficticias y la ubicación exacta siga saliendo del pin/geolocalización.

## No revisado / residual

- No se ejecutó staging real desde la revisión; queda para después del arreglo y promoción.
- No se aprobará ni mergeará desde esta revisión.
