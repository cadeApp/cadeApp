# PR #54 — T-004 · Esquema v1, trigger de alta y tipos

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/54 |
| **Tarea** | T-004 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-004-schema-v1` → `develop` |
| **Base** | `82d6521` |
| **Tamaño** | 17 archivos |
| **Estado** | Abierta · **LISTA PARA ACEPTAR** · 5 de 7 cerrados y verificados en `6a640e4` + 1 resuelto por decisión · **CI 9 de 9** · los 2 abiertos no son de esta tarea |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `85d3f6a` | 6 abiertos (3 medios, 3 azules) · alcance limpio · `db-tests` verde con 37/37 pgTAP | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |
| 2 | `6a640e4` | **H01, H04, H05 y H06 cerrados con prueba de conducta** · H03 por decisión · 1 nuevo (H07) · **CI 9/9** | [`revisiones/ronda-2.md`](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| H01 | El borrado de una cuenta no cascadea: falla por violación de FK | 🟡 | ✅ verificado (`6a640e4`) — con prueba que borra de verdad |
| **H02** | El caché de `supabase` no guarda nada y `db-tests` depende de pulls anónimos a Docker Hub | 🟡 | 🔴 abierto — **fuera de la ficha**, es de `ci.yml` |
| H03 | Ningún `auth.users` nace fuera del alta de la app, y ningún `admin` puede existir | 🟡 | ✅ resuelto por decisión (`6a640e4`) — falta mudar la nota a `T-005.md` |
| H04 | `grant execute` de una función `security definer` a `authenticated` | 🔵 | ✅ verificado (`6a640e4`) — con aserción de privilegio |
| H05 | `updated_at` en tres tablas sin trigger que lo mantenga | 🔵 | ✅ verificado (`6a640e4`) |
| H06 | `accepted_offer_id` no está atado a una oferta de la misma solicitud | 🔵 | ✅ verificado (`6a640e4`) — con el caso negativo |
| **H07** | El `revoke` de `set_updated_at` no se puede verificar hasta T-005 | 🔵 | 🔴 abierto — va en el DoD de T-005 |
| A01 | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`6a640e4`) — **0 fuera**, octava ronda |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)

## Lo que está bien, y es la mayor parte

Es la mejor primera ronda de las cinco PRs revisadas, y la ronda 2 cerró los cuatro arreglos **con pruebas de conducta que fallan si alguien los deshace**. Lo que más vale:

- **Las pruebas de pgTAP son de conducta, no de forma.** `pg_temp.signup_role()` inserta de verdad en `auth.users` con `raw_user_meta_data` y devuelve el rol del perfil que salió, o el error. Cinco casos —`merchant`, `courier`, `admin`, `visitor`, `null`— más una sexta que confirma que el alta de `admin` no dejó un perfil colgado. El ítem más delicado del DoD está demostrado dos veces.
- **`db-tests` verde es la verificación más fuerte posible acá:** levanta el stack, corre el pgTAP (**37/37** en la ronda 1, **41/41** en la ronda 2) y **regenera los tipos comparándolos con los commiteados**. Que pase significa que `database.types.ts` es exactamente la salida de `db:types --local`, no una edición a mano.
- **Hay una prueba de privacidad estructural:** `delivery_requests` no puede tener `recipient_name`, `recipient_phone` ni coordenadas exactas — eso vive aparte en `delivery_request_contacts`. Un invariante de diseño convertido en control que falla si mañana alguien agrega la columna.
- **Los índices únicos parciales se afirman por su predicado**, no por su nombre: `indisunique`, `indpred is not null` y el contenido del predicado. Es `AG-25` aplicada sin que nadie la recordara.
- **RLS habilitada con deny explícito en las 14 tablas**, `using (false) with check (false)`. Nada de `using (true)`.
- **La obligación diferida tiene dueño y criterio demostrable:** `rls_enabled.sql` no existe, y no es un hueco — la ficha de T-005 lo nombra, lo tiene en «Archivos permitidos» y su DoD dice *«falla con una tabla sin RLS (demostrado)»*. `AG-21` cumplida, al revés de lo que pasó con el drift en la #49.
- **`dni_hmac` en vez del DNI**, con `unique` y `check (~ '^[0-9a-f]{64}$')`.
- **El seed es idempotente y cita la fuente** del centroide en vez de inventar una coordenada.
- **El `--schema public` quedó en `cliArgs`**, antes de la bifurcación de argumentos, así que lo reciben los dos caminos. Es exactamente lo que `PR51-H12` pedía.

## Lo que queda

> **Lista para aceptar.** CI **9 de 9** —primera PR del repo que cierra con todos los checks verdes, `approval-policy` incluido— y alcance limpio por octava ronda consecutiva. Los cuatro arreglos de la ronda 2 no se quedaron en el DDL: traen pruebas que ejercen el comportamiento, con el caso negativo incluido en la FK compuesta.

> **Los dos ítems abiertos no son de esta tarea.** `H02` vive en `ci.yml` y se reprodujo en las dos corridas —20 líneas de `toomanyrequests` cada vez, y el paso de caché que no guarda nada—. `H07` solo se puede verificar cuando existan las policies de T-005, y pide que su matriz incluya un `update` por rol, no solo un `select`.

> **Lo que conviene hacer antes de que T-005 arranque:** mudar la nota del arranque del `admin` de `T-004.md` a `T-005.md`. Es una PR de docs de tres líneas, y es exactamente el freno que nos costó T-003 — el agy lee la ficha de su tarea, no la de la anterior.

Detalle de proceso en [`revisiones/ronda-2.md`](revisiones/ronda-2.md): `hallazgos.jsonl` llegó con cinco hallazgos marcados como verificados por el propio autor. El contenido era cierto, pero quien arregla no es quien verifica; los registros se reescribieron con la verificación de la revisión sobre `6a640e4`.
