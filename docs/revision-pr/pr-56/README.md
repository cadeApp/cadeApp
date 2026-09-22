# PR #56 — T-005 · RLS v1, storage `courier-docs`, matriz RLS, `rls_enabled.sql`

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/56 |
| **Tarea** | T-005 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-005-rls-v1` → `develop` |
| **Base** | `f698539` |
| **Tamaño** | 11 archivos, +1449 / −0 |
| **Estado** | Draft · **5 abiertos, 0 bloqueantes** · CI 9 de 9 · alcance limpio |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3a6876b` | **2 bloqueantes** (escalada de privilegios en escritura) · 1 alto · 3 medios · 3 azules | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `86fd6fe` | 9 cerrados · 1 a medias · **2 nuevos de la misma familia** · 0 bloqueantes | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| **H01** | Un repartidor se verifica los documentos a sí mismo (`license_status`, `insurance_status` → `doc_level` 2) | 🔴 | ✅ verificado (`86fd6fe`) — pruebas 21, 22, 23 |
| **H02** | Un comercio se autoconcede la suscripción (`subscription_status`, `paid_until`) | 🔴 | ✅ verificado (`86fd6fe`) — pruebas 24, 25 |
| **H03** | Cualquier repartidor aprobado lee todas las filas de `merchants`, con dirección y `notes` | 🟠 | ✅ verificado (`86fd6fe`) — prueba 11 · residual → H13 |
| **H04** | La única policy que nombra a `anon` llama a una función que `anon` no puede ejecutar | 🟡 | ✅ verificado (`86fd6fe`) — prueba 3, positiva |
| **H05** | La matriz no hace ningún `update` sobre `profiles`, `couriers` ni `merchants` | 🟡 | ✅ verificado (`86fd6fe`) — 15 → 28 aserciones |
| **H06** | `offers_update_merchant` sin `with check`: el comercio reescribe `amount_ars` y `status` | 🔵 | 🟡 **a medias** — columnas económicas congeladas; `status` sigue libre · **decisión** |
| **H07** | `using (true)` en `platform_settings` sin la justificación escrita | 🔵 | ✅ verificado (`86fd6fe`) |
| **H08** | Cualquiera abre un incidente sobre cualquier solicitud | 🔵 | ✅ verificado (`86fd6fe`) — pruebas 27, 28 |
| **H09** | Subir a `courier-docs` no requiere ser repartidor | 🔵 | ✅ verificado (`86fd6fe`) — prueba 16 |
| **H10** | Las 7 `throws_ok` comparaban el mensaje de error y dejaban `db-tests` rojo | 🟡 | ✅ verificado (`86fd6fe`) — **encontrado y arreglado por el agy** |
| **H11** | `offers_update_courier` sin `with check`: el repartidor reescribe el monto ya aceptado | 🟠 | 🔴 abierto — ronda 2 |
| **H12** | `delivery_requests_update_merchant` no congela el ciclo de vida | 🟡 | 🔴 abierto — ronda 2 |
| **H13** | Residual de H03: se acotaron las filas, no las columnas | 🟡 | 🔴 abierto — va al DoD de T-006 |
| **H14** | `zones_select_admin` es redundante con `zones_write_admin` | 🔵 | 🔴 abierto |
| A01 | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`86fd6fe`) — **0 fuera**, décima ronda |
| A02 | La carpeta de revisión se volvió a escribir desde el lado del autor | 🔵 | 🔴 abierto — proceso |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md) · Autorrevisión del agy: [`autorrevision-agy.md`](autorrevision-agy.md)

## Lo que está muy bien

- **La matriz se prueba con los roles de verdad.** `pg_temp.act_as()` hace `set local role authenticated` y setea `request.jwt.claims` con el `sub`, así que `auth.uid()` devuelve el actor. Es `AG-29` aplicada antes de que se la pidiera, y es la diferencia entre una matriz verificada y una decorativa.
- **`rls_enabled.sql` es genérico**, no una lista: barre `pg_class` buscando tablas de `public` sin `relrowsecurity` o sin ninguna policy. Cierra el residual que había quedado en la #54, donde la RLS se habilitaba recorriendo un array de 14 nombres escrito a mano. La fase roja está demostrada con una tabla `_table_without_rls` plantada.
- **El esquema `app_private` con `security definer`** evita a la vez la recursión de RLS y la exportación de helpers a `database.types.ts`. Bien razonado y bien explicado.
- **El invariante del DoD se afirma con el conjunto exacto** (`array_agg`), no con un conteo, y tiene caso negativo con un segundo repartidor aprobado.
- **Cada arreglo de la ronda 2 vino con su prueba, y las pruebas son rojas antes.** Las verifiqué una por una contra la policy anterior. El fixture ganó `merchant_idle_id()` para una sola cosa: ser el comercio que el repartidor **no** tiene que ver. Sin esa fila, la prueba 11 pasaría igual con la policy vieja.
- **`H09` se resolvió mejor de lo que yo había sugerido**: con `is_courier()` y no con `is_approved_courier()`, porque los documentos se suben durante el onboarding, antes de que un admin apruebe.

## Lo que no

> **Una sola familia, en los lugares que no se barrieron.** Los dos bloqueantes se cerraron bien, y en la ronda 2 aparecieron **dos casos más del mismo patrón que ya estaban ahí desde el principio**: el otro lado de `offers` (`H11`, el repartidor reescribe el monto de una oferta ya aceptada) y `delivery_requests` (`H12`, el comercio escribe `status` y los cinco *timestamps* de ciclo de vida). `P17` cerró la PR con cinco casos.

> **Que `H11` y `H12` aparezcan en la ronda 2 es un costo de esta revisión, no del trabajo.** Nadie las tocó entre una ronda y otra: la ronda 1 no las miró. Es `AG-37`.

> **`H06`, `H12` y `H13` son la misma pregunta:** ¿quién mueve el estado, el cliente o la RPC de T-006? Conviene contestarla una vez y aplicarla a las tres.

## Nota de proceso

La carpeta llegó **dos veces** escrita desde el lado del autor: en la ronda 1, entera y firmada «Revisión independiente (agy)» con «SIN BLOQUEANTES» sobre una migración con dos escaladas de privilegios —conservada en [`autorrevision-agy.md`](autorrevision-agy.md)—; y en la ronda 2, con `hallazgos.jsonl` modificado sin commitear y un `verificado_en_sha` que apuntaba a un SHA donde `db-tests` estaba **rojo**.

Que el agy se revise a sí mismo está bien y lo pide la regla 50 — y en la ronda 2 eso mismo produjo `H10`, un hallazgo real que la revisión no había visto. Lo que no puede es ocupar el lugar de la revisión independiente ni firmar la verificación de sus propios arreglos. Su canal es la bitácora, y las dos entradas de esta ronda muestran que funciona bien. Detalle en [`revisiones/ronda-2.md`](revisiones/ronda-2.md) y la regla en [`../COMO-ENTREGAR.md`](../COMO-ENTREGAR.md).
