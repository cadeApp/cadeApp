# PR #56 — T-005 · RLS v1, storage `courier-docs`, matriz RLS, `rls_enabled.sql`

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/56 |
| **Tarea** | T-005 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-005-rls-v1` → `develop` |
| **Base** | `f698539` |
| **Tamaño** | 15 archivos, +2590 / −1 |
| **Estado** | ✅ **Lista para mergear** · 21 de 24 cerrados · 0 bloqueantes · CI 9 de 9 · alcance limpio |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3a6876b` | **2 bloqueantes** (escalada de privilegios en escritura) · 1 alto · 3 medios · 3 azules | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `86fd6fe` | 9 cerrados · 1 a medias · **2 nuevos de la misma familia** · 0 bloqueantes | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |
| 3 | `aad5031` | 4 cerrados con **fase roja en el histórico** · **5 nuevos del barrido de `insert`** · 0 bloqueantes | [`revisiones/ronda-3.md`](revisiones/ronda-3.md) |
| 4 | `f48c95b` | **7 cerrados** · 2 azules cosméticos · 0 bloqueantes · **cerrada** | [`revisiones/ronda-4.md`](revisiones/ronda-4.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| **H01** | Un repartidor se verifica los documentos a sí mismo (`license_status`, `insurance_status` → `doc_level` 2) | 🔴 | ✅ verificado (`86fd6fe`) — pruebas 21, 22, 23 |
| **H02** | Un comercio se autoconcede la suscripción (`subscription_status`, `paid_until`) | 🔴 | ✅ verificado (`86fd6fe`) — pruebas 24, 25 |
| **H03** | Cualquier repartidor aprobado lee todas las filas de `merchants`, con dirección y `notes` | 🟠 | ✅ verificado (`86fd6fe`) — prueba 11 · residual → H13 |
| **H04** | La única policy que nombra a `anon` llama a una función que `anon` no puede ejecutar | 🟡 | ✅ verificado (`86fd6fe`) — prueba 3, positiva |
| **H05** | La matriz no hace ningún `update` sobre `profiles`, `couriers` ni `merchants` | 🟡 | ✅ verificado (`86fd6fe`) — 15 → 28 aserciones |
| **H06** | `offers_update_merchant` sin `with check`: el comercio reescribe `amount_ars` y `status` | 🟡 | ✅ verificado (`f48c95b`) — **decisión (a)**: el estado lo mueve la RPC · prueba 47 |
| **H07** | `using (true)` en `platform_settings` sin la justificación escrita | 🔵 | ✅ verificado (`86fd6fe`) |
| **H08** | Cualquiera abre un incidente sobre cualquier solicitud | 🔵 | ✅ verificado (`86fd6fe`) — pruebas 27, 28 |
| **H09** | Subir a `courier-docs` no requiere ser repartidor | 🔵 | ✅ verificado (`86fd6fe`) — prueba 16 |
| **H10** | Las 7 `throws_ok` comparaban el mensaje de error y dejaban `db-tests` rojo | 🟡 | ✅ verificado (`86fd6fe`) — **encontrado y arreglado por el agy** |
| **H11** | `offers_update_courier` sin `with check`: el repartidor reescribe el monto ya aceptado | 🟠 | ✅ verificado (`aad5031`) — prueba 29, **roja en `73ab5f1`** · residual → H15 |
| **H12** | `delivery_requests_update_merchant` no congela el ciclo de vida | 🟡 | ✅ verificado (`aad5031`) — prueba 30, roja y después verde · residual → H16 |
| **H13** | Residual de H03: se acotaron las filas, no las columnas | 🟡 | 🔴 abierto — **va a T-106**, no a T-006 (corregido en la ronda 4) |
| **H14** | `zones_select_admin` es redundante con `zones_write_admin` | 🔵 | ✅ verificado (`aad5031`) — eliminada |
| **H15** | Una oferta puede **nacer** en `accepted` y tomar el cupo del índice único | 🟠 | ✅ verificado (`f48c95b`) — pruebas 31, 32, 51 |
| **H16** | Una solicitud puede **nacer** en `delivered` con los *timestamps* fabricados | 🟡 | ✅ verificado (`f48c95b`) — pruebas 33–39, 52 |
| **H17** | Un documento de repartidor puede **nacer** en `verified` | 🟡 | ✅ verificado (`f48c95b`) — pruebas 40–42, 53 |
| **H18** | Un incidente puede **nacer** `resolved` con su `resolution` escrita | 🔵 | ✅ verificado (`f48c95b`) — pruebas 43, 44, 54 |
| **H19** | El cliente elige `accepted_at` de su propio consentimiento | 🔵 | ✅ verificado (`f48c95b`) — pruebas 45, 55 |
| **H20** | Falta la aserción positiva de H11, y no hay ninguna de `delete` | 🟡 | ✅ verificado (`f48c95b`) — pruebas 46, 48, 49 **y 50** (persistencia) |
| **H21** | `offers_update_merchant` quedó vestigial: solo deja escribir `created_at` | 🔵 | 🔴 abierto — cosmético, ronda 4 |
| **H22** | `profiles_update_self` no congela `created_at` | 🔵 | 🔴 abierto — cosmético, ronda 4 |
| A01 | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`f48c95b`) — **0 fuera**, duodécima ronda |
| A02 | La carpeta de revisión se volvió a escribir desde el lado del autor | 🔵 | ✅ verificado (`aad5031`) — **no volvió a pasar** |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md) · Autorrevisión del agy: [`autorrevision-agy.md`](autorrevision-agy.md)

## Lo que está muy bien

- **La matriz se prueba con los roles de verdad.** `pg_temp.act_as()` hace `set local role authenticated` y setea `request.jwt.claims` con el `sub`, así que `auth.uid()` devuelve el actor. Es `AG-29` aplicada antes de que se la pidiera, y es la diferencia entre una matriz verificada y una decorativa.
- **`rls_enabled.sql` es genérico**, no una lista: barre `pg_class` buscando tablas de `public` sin `relrowsecurity` o sin ninguna policy. Cierra el residual que había quedado en la #54, donde la RLS se habilitaba recorriendo un array de 14 nombres escrito a mano. La fase roja está demostrada con una tabla `_table_without_rls` plantada.
- **El esquema `app_private` con `security definer`** evita a la vez la recursión de RLS y la exportación de helpers a `database.types.ts`. Bien razonado y bien explicado.
- **El invariante del DoD se afirma con el conjunto exacto** (`array_agg`), no con un conteo, y tiene caso negativo con un segundo repartidor aprobado.
- **Cada arreglo de la ronda 2 vino con su prueba, y las pruebas son rojas antes.** Las verifiqué una por una contra la policy anterior. El fixture ganó `merchant_idle_id()` para una sola cosa: ser el comercio que el repartidor **no** tiene que ver. Sin esa fila, la prueba 11 pasaría igual con la policy vieja.
- **`H09` se resolvió mejor de lo que yo había sugerido**: con `is_courier()` y no con `is_approved_courier()`, porque los documentos se suben durante el onboarding, antes de que un admin apruebe.
- **La ronda 3 demostró la fase roja en el histórico, no en un informe.** Las pruebas 29 y 30 se commitearon solas en `73ab5f1` y CI las tiró en rojo (`Tests: 30 Failed: 2`, `Result: FAIL`); el arreglo llegó en `e75093f`. Es la mejor disciplina de toda la PR y la primera vez que queda como commit separado.

## Lo que no

> **Una sola familia, cuatro rondas, tres barridos.** La ronda 1 miró `select`, la 2 y la 3 `update`, y la 3 fue la primera que miró `insert`. `P17` cerró con doce casos. **Siete de los veintidós hallazgos ya estaban en el primer commit** y salieron tarde porque esta revisión revisó por capas en vez de enumerar la clase completa de entrada. Es `AG-37` y `AG-38`, y la tabla de las 53 policies por operación quedó en [`ronda-3.md`](revisiones/ronda-3.md#la-enumeración-completa-para-que-no-haya-ronda-4) para que T-106 arranque desde ahí.

> **Una corrección de la revisión:** en la ronda 3 escribí que las transiciones serían «RPC de T-006». Está mal. T-006 es de P2 y es la capa de contrato (`src/domain/**`); las RPC SQL son **T-101** (`submit_offer`, `withdraw_offer`), **T-102** (`accept_offer`), **T-103** (ciclo de solicitud) y **T-105** (`admin_*`). El agy lo corrigió por su cuenta en la bitácora.

> **Queda abierto y no es de esta PR:** `H13` → **T-106**, cuyo DoD ya cubre las coordenadas y solo necesita sumar `notes`, `paid_until` y `subscription_status`. `H21` y `H22` son cosméticos.

## Nota de proceso

La carpeta llegó **dos veces** escrita desde el lado del autor: en la ronda 1, entera y firmada «Revisión independiente (agy)» con «SIN BLOQUEANTES» sobre una migración con dos escaladas de privilegios —conservada en [`autorrevision-agy.md`](autorrevision-agy.md)—; y en la ronda 2, con `hallazgos.jsonl` modificado sin commitear y un `verificado_en_sha` que apuntaba a un SHA donde `db-tests` estaba **rojo**.

Que el agy se revise a sí mismo está bien y lo pide la regla 50 — y en la ronda 2 eso mismo produjo `H10`, un hallazgo real que la revisión no había visto. Lo que no puede es ocupar el lugar de la revisión independiente ni firmar la verificación de sus propios arreglos. Su canal es la bitácora. Detalle en [`revisiones/ronda-2.md`](revisiones/ronda-2.md) y la regla en [`../COMO-ENTREGAR.md`](../COMO-ENTREGAR.md).

**En la ronda 3 no volvió a pasar** (`A02` cerrado): árbol limpio, ningún comentario nuevo firmado como revisión, `docs/revision-pr/**` sin tocar en los tres commits, y todo lo que tenía para decir en la bitácora. La regla funcionó a la primera.
