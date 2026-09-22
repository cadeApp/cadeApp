# PR #54 — T-004 · Esquema v1, trigger de alta y tipos

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/54 |
| **Tarea** | T-004 (Fase 0 — Fundaciones y contratos) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-004-schema-v1` → `develop` |
| **Base** | `82d6521` |
| **Tamaño** | 12 archivos, +1585 / −18 |
| **Estado** | Abierta · **6 abiertos, ningún bloqueante de código** · CI **8 de 9**, y el rojo es el informe que falta en el cuerpo |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `85d3f6a` | 6 abiertos (3 medios, 3 azules) · alcance limpio · `db-tests` verde con 37/37 pgTAP | [`revisiones/ronda-1.md`](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| **H01** | El borrado de una cuenta no cascadea: falla por violación de FK | 🟡 | 🔴 abierto — parte 1 dentro de la ficha, parte 2 es **decisión tuya** |
| **H02** | El caché de `supabase` no guarda nada y `db-tests` depende de pulls anónimos a Docker Hub | 🟡 | 🔴 abierto — **fuera de la ficha**, es de `ci.yml` |
| **H03** | Ningún `auth.users` nace fuera del alta de la app, y ningún `admin` puede existir | 🟡 | 🔴 abierto — **decisión tuya** |
| **H04** | `grant execute` de una función `security definer` a `authenticated` | 🔵 | 🔴 abierto |
| **H05** | `updated_at` en tres tablas sin trigger que lo mantenga | 🔵 | 🔴 abierto |
| **H06** | `accepted_offer_id` no está atado a una oferta de la misma solicitud | 🔵 | 🔴 abierto |
| A01 | Archivos fuera de los «Archivos permitidos» | 🔵 | ✅ verificado (`85d3f6a`) — **0 fuera**, séptima ronda |

Datos estructurados: [`hallazgos.jsonl`](hallazgos.jsonl) · Comandos: [`evidencia/comandos.md`](evidencia/comandos.md) · Lecciones: [`lecciones.md`](lecciones.md)

## Lo que está bien, y es la mayor parte

Es la mejor primera ronda de las cinco PRs revisadas. Lo que más vale:

- **Las pruebas de pgTAP son de conducta, no de forma.** `pg_temp.signup_role()` inserta de verdad en `auth.users` con `raw_user_meta_data` y devuelve el rol del perfil que salió, o el error. Cinco casos —`merchant`, `courier`, `admin`, `visitor`, `null`— más una sexta que confirma que el alta de `admin` no dejó un perfil colgado. El ítem más delicado del DoD está demostrado dos veces.
- **`db-tests` verde es la verificación más fuerte posible acá:** levanta el stack, corre el pgTAP (**37/37**) y **regenera los tipos comparándolos con los commiteados**. Que pase significa que `database.types.ts` es exactamente la salida de `db:types --local`, no una edición a mano.
- **Hay una prueba de privacidad estructural:** `delivery_requests` no puede tener `recipient_name`, `recipient_phone` ni coordenadas exactas — eso vive aparte en `delivery_request_contacts`. Un invariante de diseño convertido en control que falla si mañana alguien agrega la columna.
- **Los índices únicos parciales se afirman por su predicado**, no por su nombre: `indisunique`, `indpred is not null` y el contenido del predicado. Es `AG-25` aplicada sin que nadie la recordara.
- **RLS habilitada con deny explícito en las 14 tablas**, `using (false) with check (false)`. Nada de `using (true)`.
- **La obligación diferida tiene dueño y criterio demostrable:** `rls_enabled.sql` no existe, y no es un hueco — la ficha de T-005 lo nombra, lo tiene en «Archivos permitidos» y su DoD dice *«falla con una tabla sin RLS (demostrado)»*. `AG-21` cumplida, al revés de lo que pasó con el drift en la #49.
- **`dni_hmac` en vez del DNI**, con `unique` y `check (~ '^[0-9a-f]{64}$')`.
- **El seed es idempotente y cita la fuente** del centroide en vez de inventar una coordenada.
- **El `--schema public` quedó en `cliArgs`**, antes de la bifurcación de argumentos, así que lo reciben los dos caminos. Es exactamente lo que `PR51-H12` pedía.

## Lo que queda

> **Ninguno de los seis hallazgos es bloqueante de código.** Cuatro se arreglan dentro de la ficha; dos son decisiones tuyas y uno vive en `ci.yml`.

> **El único check rojo es `approval-policy`, y es mío:** falta el bloque literal del informe en el cuerpo. El bloque está en [`revisiones/ronda-1.md`](revisiones/ronda-1.md), comprobado ejecutando el módulo contra el cuerpo real. Es la primera PR que pasa por el control nuevo de la #55 y está funcionando como debe.

> **H01 es el más útil de los seis.** `profiles.id` promete `on delete cascade` desde `auth.users` y la promesa no se puede cumplir: con una solicitud publicada, una oferta, un incidente o una fila de auditoría, el borrado choca con una FK sin acción y **falla entero**. No falta un `cascade` en todos lados —retener el historial es lo correcto—, falta decidir entre borrar y anonimizar. La mitad barata (`on delete set null` en dos columnas que ya son nullable) entra en esta tarea.
