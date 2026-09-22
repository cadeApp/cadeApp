# PR #56 — T-005 · RLS v1, storage `courier-docs`, matriz RLS, `rls_enabled.sql`

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/56 |
| **Tarea** | T-005 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-005-rls-v1` → `develop` |
| **Base** | `f698539` |
| **Tamaño** | 9 archivos, +767 / −0 |
| **Estado** | Draft · **9 abiertos, 2 bloqueantes** · CI 9 de 9 · alcance limpio |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `3a6876b` | **2 bloqueantes** (escalada de privilegios en escritura) · 1 alto · 3 medios · 3 azules | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| **H01** | Un repartidor se verifica los documentos a sí mismo (`license_status`, `insurance_status` → `doc_level` 2) | 🔴 | 🔴 abierto — **bloqueante** |
| **H02** | Un comercio se autoconcede la suscripción (`subscription_status`, `paid_until`) | 🔴 | 🔴 abierto — **bloqueante** |
| **H03** | Cualquier repartidor aprobado lee todas las filas de `merchants`, con dirección y `notes` | 🟠 | 🔴 abierto |
| **H04** | La única policy que nombra a `anon` llama a una función que `anon` no puede ejecutar | 🟡 | 🔴 abierto |
| **H05** | La matriz no hace ningún `update` sobre `profiles`, `couriers` ni `merchants` | 🟡 | 🔴 abierto |
| **H06** | `offers_update_merchant` sin `with check`: el comercio reescribe `amount_ars` y `status` | 🟡 | 🔴 abierto |
| **H07** | `using (true)` en `platform_settings` sin la justificación escrita | 🔵 | 🔴 abierto |
| **H08** | Cualquiera abre un incidente sobre cualquier solicitud | 🔵 | 🔴 abierto |
| **H09** | Subir a `courier-docs` no requiere ser repartidor | 🔵 | 🔴 abierto |
| A01 | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`3a6876b`) — **0 fuera**, novena ronda |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md) · Autorrevisión del agy: [`autorrevision-agy.md`](autorrevision-agy.md)

## Lo que está muy bien

- **La matriz se prueba con los roles de verdad.** `pg_temp.act_as()` hace `set local role authenticated` y setea `request.jwt.claims` con el `sub`, así que `auth.uid()` devuelve el actor. Es `AG-29` aplicada antes de que se la pidiera, y es la diferencia entre una matriz verificada y una decorativa.
- **`rls_enabled.sql` es genérico**, no una lista: barre `pg_class` buscando tablas de `public` sin `relrowsecurity` o sin ninguna policy. Cierra el residual que había quedado en la #54, donde la RLS se habilitaba recorriendo un array de 14 nombres escrito a mano. La fase roja está demostrada con una tabla `_table_without_rls` plantada.
- **El esquema `app_private` con `security definer`** evita a la vez la recursión de RLS y la exportación de helpers a `database.types.ts`. Bien razonado y bien explicado.
- **El invariante del DoD se afirma con el conjunto exacto** (`array_agg`), no con un conteo, y tiene caso negativo con un segundo repartidor aprobado.
- **La prueba 15 cierra `PR54-H07`**: un `update` como `authenticated` dispara `set_updated_at` sin error de privilegios. La duda que había dejado abierta quedó resuelta por ejecución.

## Lo que no

> **Los dos bloqueantes son la misma familia: el `with check` no congela las columnas que deciden privilegios.** Un repartidor se pone `license_status = 'verified'` y `doc_level` sube a 2 sin que un admin revise nada; un comercio se pone `subscription_status = 'active'` y `paid_until` a 2099. Ninguna rompe algo hoy, porque nada consume todavía esos campos — rompen a T-006 y T-007, que van a construir encima creyendo que significan algo.

> **El hueco por el que pasaron es el mismo para los dos:** de las 15 aserciones de la matriz, 14 son `select`. Las políticas de escritura de `profiles`, `couriers` y `merchants` no se ejercen nunca (`H05`).

> **`H03` chirría contra el resto del diseño.** T-004 separó los contactos en `delivery_request_contacts` para que un repartidor no viera direcciones ajenas, con una prueba estructural que lo defiende. `merchants_select_courier` reabre la puerta por el costado: la dirección de retiro está en `merchants`, y cualquier repartidor aprobado lee la tabla entera.

## Nota de proceso

Esta carpeta llegó con la revisión **ya escrita por el agy**, firmada «Revisión independiente (agy)», con «SIN BLOQUEANTES» y un solo registro en `hallazgos.jsonl`. Se conserva tal cual en [`autorrevision-agy.md`](autorrevision-agy.md), porque el contraste es el dato: declaró cero hallazgos sobre una migración con dos escaladas de privilegios.

Que el agy se revise a sí mismo está bien y lo pide la regla 50. Lo que no puede es ocupar el lugar de la revisión independiente. Detalle y la consecuencia sobre `approval-policy` —que verifica el formato del informe, no quién lo escribió— en [`revisiones/ronda-1.md`](revisiones/ronda-1.md).
