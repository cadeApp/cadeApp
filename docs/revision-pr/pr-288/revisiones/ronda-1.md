# Informe de revisión — PR #288 / T-345 — ronda 1

**PR:** https://github.com/cadeApp/cadeApp/pull/288  
**Head SHA revisado:** `d653a64d8b944ec07f5beec5fdfacec048b4776c`  
**SHA funcional:** `015b2414273541b844d30f79afeb6718b37395ab`  
**Base:** `develop` @ `6e2da8fb02d4797b9add222206342e6055f1d81c`  
**Fecha:** 2026-10-06

## Resultado

**SIN BLOQUEANTES.**

No hay decisiones 🔵 pendientes ni mejoras necesarias para este paso.

La implementación coincide con el **PR 2/3** definido por T-345 y CC-023: agrega contrato/fake/wrapper, migra los lectores del comercio fuera de las columnas privadas y conserva la UI. No adelanta los revokes/grants del PR 3.

## Checkpoint del PR 1

Se comprobó el requisito previo:

- PR #287 mergeado en `develop` como `6e2da8fb02d4797b9add222206342e6055f1d81c`;
- workflow `migrate` run `37544715605`;
- job `migrate-develop`: **GREEN**.

Por lo tanto el paso 2 podía comenzar.

## Alcance e integración

- `develop` actual sigue en `6e2da8fb02d4797b9add222206342e6055f1d81c`, igual a la base del PR.
- Compare `develop...HEAD`: `ahead_by=2`, `behind_by=0`.
- El segundo commit del PR, `d653a64`, solo agrega evidencia a `docs/tasks/log/T-345.md`; el código funcional quedó en `015b241`.
- Los 11 archivos están dentro de «Archivos permitidos».
- No hay cambios en `supabase/**` ni en `src/types/database.types.ts`.
- `docs/revision-pr/pr-288/**` no tenía historial antes de esta ronda.
- El PR usa `Refs #281`; el issue #281 sigue abierto y etiquetado `en-review`.

## Contrato y fake

`RPC_CONTRACTS.get_merchant_request_private_fields` cumple CC-023:

- entrada `{ requestId: uuid }`;
- salida estricta `{ requestId, notes, cashChangeAmount }`;
- `notes` nullable;
- `cashChangeAmount` entero positivo o `null`;
- errores: `UNAUTHENTICATED`, `UNAUTHORIZED_ACTOR`, `NOT_FOUND`, `VALIDATION_ERROR`, `INTERNAL_ERROR`;
- el nombre está incluido en `ALL_RPC_NAMES`.

El fake reproduce la precedencia de la función SQL:

1. sin sesión → `UNAUTHENTICATED`;
2. para esta RPC, input inválido → `VALIDATION_ERROR` antes del rol;
3. rol distinto de `merchant` → `UNAUTHORIZED_ACTOR`;
4. consentimiento no activo → `UNAUTHORIZED_ACTOR`;
5. solicitud inexistente o ajena → `NOT_FOUND`;
6. solicitud propia → devuelve exactamente los dos campos privados.

La prueba de dominio cubre también el contraste entre solicitud ajena e inexistente y la precedencia específica; esto evita el patrón histórico AG-59 (mismos códigos, distinto orden).

## Wrapper server

`src/server/rpc/request-private-fields.ts` replica el patrón ya aprobado de CC-016:

- comienza con `import 'server-only'`;
- no usa service role;
- valida input con el schema canónico;
- llama exactamente `get_merchant_request_private_fields` con `p_request_id`;
- mapea `P0001` solo si el mensaje es un código permitido;
- `42501` / `28000` → `UNAUTHORIZED_ACTOR`;
- cualquier error desconocido o excepción → `INTERNAL_ERROR`;
- valida salida con Zod y exige que el `requestId` devuelto coincida con el pedido.

No se registran `notes` ni `cashChangeAmount` en logs o URLs.

## Lectores del comercio

Se revisó la clase completa que CC-023 inventarió:

- `getMerchantHistoryRequests`: ya no selecciona `cash_change_amount`;
- `getMerchantRequests`: ya no selecciona `cash_change_amount`;
- `getMerchantRequestWithOffers`: ya no selecciona `cash_change_amount` ni `notes`;
- `MerchantRequestSummary.cashChangeAmount` se elimina porque era un dato muerto;
- el detalle conserva `MerchantRequestDetail.cashChangeAmount` y `notes`, ahora hidratados desde la RPC;
- los escritores de creación no se cambian: CC-023 permite seguir insertando ambos campos;
- `get_trip_details` permanece como frontera RPC del viaje y pertenece al enforcement/pgTAP del paso 3.

El detalle primero confirma la solicitud propia con RLS/merchant_id y solo después llama a la RPC. La RPC y la lectura de ofertas se ejecutan en paralelo con `Promise.all`; si la RPC falla, el detalle lanza y no inventa valores.

## Regresión de UI

La UI no cambia:

- con `cashChangeAmount = 7300`, `RequestOffersList` conserva «Paga con $ 7.300» en encabezado y confirmación;
- con `cashChangeAmount = null`, no inventa «Paga con».

El test de UI no importa `@/server/**`; la conexión RPC → `MerchantRequestDetail` se verifica en `queries.test.ts`, respetando la regla de arquitectura para features.

## RED del autor

La bitácora declara:

- contrato/fake: 7 tests rojos antes de la implementación;
- wrapper: fallo de resolución de módulo antes de crear el archivo;
- readers: 4 tests rojos con el `queries.ts` anterior;
- mutación de precedencia del fake: `VALIDATION_ERROR` esperado vs `UNAUTHORIZED_ACTOR`.

La revisión comparó esos tests contra el árbol base `6e2da8f` y confirmó por inspección que las propiedades faltaban exactamente donde se declara: el contrato/método no existían, el wrapper no existía y los tres lectores seguían seleccionando las columnas privadas. La mutación descrita ataca directamente el branch especial que hoy valida el input antes del rol.

**Limitación del entorno de esta revisión:** no fue posible re-ejecutar localmente esos RED porque el runtime de revisión no tiene acceso de red para clonar el repositorio; el intento de `git clone` falló por resolución DNS. No se presenta esa evidencia como runtime independiente. El GREEN sí se verificó en CI exact-head y el comportamiento relevante además quedó cubierto por E2E.

## GREEN exact-head

Sobre `d653a64d8b944ec07f5beec5fdfacec048b4776c`, CI run `37547526858`:

| Check | Resultado | Evidencia |
|---|---|---|
| typecheck | ✅ | job success |
| lint | ✅ | job success |
| unit | ✅ | 123/123 archivos, 1941/1941 tests |
| workflows | ✅ | 57/57 |
| ADR | ✅ | 6/6 |
| build | ✅ | `Compiled successfully in 26.5s` |
| audit | ✅ | 1 moderate + 1 high ya ignorado |
| db-tests | ✅ | 19 archivos / 1827 tests; tipos sin drift |
| bundle-budget | ✅ advisory | sin regresión relevante; ver nota |
| Vercel | ✅ | deployment success |
| e2e-preview | ✅ | run `37547628600`, exact-head |

### E2E obligatorio del paso 2

El resolver identificó:

```text
PR interna #288 contra develop.
Preview listo para E2E.
```

El job hizo checkout de:

```text
d653a64d8b944ec07f5beec5fdfacec048b4776c
```

y ejecutó el preview de la PR:

```text
Running 37 tests using 1 worker
37 passed
Running 3 tests using 1 worker
3 passed
```

El report final publicó:

```text
TARGET_SHA: d653a64d8b944ec07f5beec5fdfacec048b4776c
trusted E2E gate GREEN contra el Preview
```

Esto satisface la fila obligatoria de T-345 para PR 2.

### Bundle budget

El advisory conserva la deuda preexistente de rutas admin y `/login/mfa` en 235 kB. Las rutas relevantes de comercio/repartidor siguen bajo el presupuesto:

- `/courier/feed`: 159 kB;
- `/merchant/requests`: 103 kB;
- `/merchant/requests/[id]`: 163 kB;
- `/merchant/requests/new`: 163 kB;
- `/design-system`: 178 kB.

No hay regresión atribuible a este PR.

## approval-policy

Antes del informe independiente, `approval-policy` falla únicamente con:

```text
Falta el informe completo de revisar-pr sin bloqueantes.
```

No es un fallo técnico del PR. La sección estructurada del body se completa al cerrar esta ronda.

## NO TOCAR — falsos positivos descartados

| Supuesto problema | Por qué no lo es |
|---|---|
| El PR no revoca las columnas | Correcto: el enforcement pertenece exclusivamente al PR 3. |
| `cashChangeAmount` desaparece de `MerchantRequestSummary` | Era dato muerto en listados; el detalle conserva su propio campo y la UI lo sigue mostrando. |
| El test de UI no llama directamente a la RPC | Correcto: un componente no puede importar `src/server`; `queries.test.ts` cubre RPC → detalle y el test de UI cubre detalle → vista. |
| El wrapper no usa service role | Correcto: debe usar la sesión del comercio para que la RPC autorice actor y ownership. |
| El E2E workflow tiene `head_sha` de `develop` por `repository_dispatch` | El job interno hizo checkout explícito de `d653a64` y el status final se publicó sobre ese SHA. |

## Metodología

Se revisaron ficha T-345 desde `develop`, CC-023, patrón CC-016, reglas de arquitectura/stack, comentarios, bitácora, diff completo y lecciones históricas obligatorias (incluyendo AG-37, AG-59, AG-68/70, AG-75 y AG-92).

Se inspeccionó el CI por dentro y el E2E exact-head; no se confió solo en colores.

No se formuló ningún hallazgo, por lo que no hay una propiedad defectuosa que requiera una batería independiente de mutaciones.

La revisión independiente no aprobó ni mergeó la PR.
