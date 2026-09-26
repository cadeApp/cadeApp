# PR #103 · CC-008 — Ronda 1

- **SHA revisado:** `4703cc2f71e7609e302c5cc79da563f2d58f0605`
- **Resultado:** **CON BLOQUEANTES (3)**
- **CI:** no consultado por bloqueantes.
- **DB local:** no levantada por decisión operativa; este SHA no trae migración ni pgTAP todavía.

## Lo correcto

- El CC no propone abrir `profiles` ni `couriers` completos.
- La salida se limita al viaje y participantes post-match.
- Conserva D04: el código visual se deriva del UUID.
- Reconoce que necesita migración, fake y tests.

## H01 · El CC es solo documental y no desbloquea T-115 · BLOQUEANTE

El propio documento declara:

- migración necesaria;
- fake de dominio a actualizar;
- tests de RPC a actualizar.

Pero el diff contiene únicamente `docs/contracts/CC-008.md`.

La skill `contract-change` exige que el PR del CC se mergee **antes** de retomar la tarea bloqueada. Mergear solo el papel dejaría T-115 exactamente igual: no existiría `get_trip_details`, ni contrato tipado, ni wrapper server-only, ni pruebas.

**Corrección:** implementar el contrato en este PR. Como mínimo:

- migración CC-008 con la RPC;
- pgTAP específico;
- `src/domain/rpc-contracts.ts`;
- `src/domain/testing/rpc-fake.ts`;
- wrapper server-only y tests;
- tipos generados si la RPC los afecta;
- actualizar el documento con la forma final.

## H02 · `SECURITY DEFINER` puede saltarse CC-007 si no exige actor operativo activo · BLOQUEANTE

La propuesta valida dueño/asignado y estado post-match, pero no exige que el actor siga habilitado por el invariante de consentimiento.

Una función `SECURITY DEFINER` no hereda la protección RLS como frontera suficiente. Si omite el gate, una identidad con consentimiento `pending` o `reconsent_required` podría invocar la RPC y obtener datos post-match aunque CC-007 la bloquee en las tablas normales.

**Decisión D01 — 1-A:** mantener RPC `SECURITY DEFINER`, pero endurecida.

Debe incluir explícitamente:

- `auth.uid()` no nulo;
- `app_private.is_active_operational_actor()`;
- comercio dueño **o** cadete de `accepted_offer_id`;
- estado `matched|in_transit|delivered`;
- `SET search_path = public, pg_temp`;
- `REVOKE ALL` a `public/anon` y `GRANT EXECUTE` solo a `authenticated`.

**pgTAP mínimo:** owner activo ✅, courier aceptado activo ✅, tercero ❌, pre-match ❌, `pending` ❌, `reconsent_required` ❌.

## H03 · `avatar_url` no existe y no debe resolverse haciendo público `courier-docs` · BLOQUEANTE

El contrato propone devolver `avatar_url`, pero el esquema no tiene ese campo. El avatar vive como documento `kind='avatar'` con `storage_path` dentro del bucket privado `courier-docs`, que además contiene documentación sensible.

**Decisión D02 — 2-A:** el bucket permanece privado.

La frontera recomendada queda:

1. RPC valida actor/viaje y devuelve los datos relacionales mínimos; no hace público Storage.
2. Wrapper **server-only** obtiene únicamente el documento avatar vigente del cadete.
3. El servidor genera una URL firmada de vida corta.
4. El browser recibe `avatarUrl`, nunca una apertura general del bucket ni service role.

Agregar pruebas que demuestren que un DNI/selfie/otro `kind` jamás puede ser usado como avatar y que un actor no autorizado no obtiene URL firmada.

## 🔵 DECISIONES — RESUELTAS

- D01: 1-A, RPC `SECURITY DEFINER` endurecida.
- D02: 2-A, avatar por signed URL server-side; bucket privado.

No quedan decisiones pendientes.
