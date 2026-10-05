# CC-nnn — <título del cambio de contrato>

- **Issue:** #<n> (label `contract-change`) · **Abre:** <persona> · **Fecha:** YYYY-MM-DD
- **Contrato afectado:** `src/domain/...` | RPC `...` | tabla `...` | `src/ui/...` | `platform_settings.<clave>`
- **Tareas bloqueadas:** T-..., T-...
- **Depende de:** CC-... (si aplica)

## Actual
<firma, tipo, código de error o comportamiento vigente, verificado contra el repo (archivo:línea)>

## Propuesto
<firma nueva y ejemplos>

## Seguridad y permisos
<!-- Obligatoria si toca esquema, RPC o helpers de base. Si no aplica, decirlo con el motivo. -->
- **RLS:** policies nuevas o cambiadas, y qué columnas quedan congeladas y en qué estados.
- **Grants y revokes:** por tabla y por columna; quién tiene `execute` en cada función.
- **`security definer` / `invoker`** de cada función, y su `set search_path = public, pg_temp`.
- **Helpers internos (`app_private.*`):** `revoke all … from public, anon, authenticated`, sin `grant` a clientes,
  validaciones defensivas internas y qué RPC públicas los llaman.
- **Acceso directo frente a RPC:** qué campos solo cambian las RPC y qué barrera de PostgreSQL lo garantiza (grants
  por columna o `with check` contra el valor previo). Test de bypass por campo.

## Concurrencia e idempotencia
<!-- Obligatoria si toca una operación transaccional. -->
- **Locks** que toma cada operación y su **orden**, compatible con las RPC existentes para no generar deadlocks.
- **Reintentos:** qué devuelve una llamada repetida (por ejemplo `idempotent: true`) y si emite eventos.
- **Carreras relevantes** y su resultado: dos actores a la vez, cambio de elegibilidad concurrente, etc.

## Privacidad / matriz de exposición
<!-- Qué ve cada actor antes y después de cada transición (D3). -->
| Dato | Comercio dueño | Repartidor antes de aceptar | Repartidor aceptado | Admin |
|---|---|---|---|---|
| ... | | | | |

## Compatibilidad, rollout y rollback
- **Versión anterior de la UI contra el esquema nuevo:** qué pasa y cómo se soporta.
- **Esquema anterior contra la UI nueva,** cuando corresponda.
- **Backfill:** qué datos existentes se migran, de forma idempotente.
- **Rollout ordenado:** pasos desplegables por separado.
- **Condición para retirar la compatibilidad:** con otro CC, cuando ningún lector ni escritor la use.
- **Rollback:** hasta qué paso se puede volver atrás.

## Decisiones de producto
<!-- Todas resueltas, con quién y cuándo. Un CC con decisiones abiertas que cambien comportamiento observable NO se mergea. -->
- <decisión> — <quién>, <fecha>

## Motivo
<qué tarea lo necesita y por qué no alcanza el contrato actual>

## Impacto
- ¿Toca alguna decisión D1–D14 del master plan o algo que ve el usuario? **sí/no** → si es sí, decide Lautaro073.
- ¿Debilita un chequeo de seguridad (RPC, RLS, storage)? **Debe ser no.**
- Migración necesaria: sí/no · Fake de dominio a actualizar: sí/no

## Impacto exacto en la tarea
<!-- Lista que la ficha bloqueada tiene que autorizar en «Archivos permitidos» y cubrir en su DoD. -->
- **Archivos y capas:** `src/domain/**`, `src/lib/error-messages.ts`, `src/types/database.types.ts`, wrappers
  `src/server/rpc/...`, features, migración, ...
- **Suites:** `supabase/tests/...`, tests de contrato, fake, E2E ...
- **Pruebas exigidas:** <una por comportamiento nuevo, incluidas idempotencia, carreras, bypass y privacidad>

## Aprobaciones
- [ ] P2 (dueña de domain/ui)
- [ ] P1 (dueño de esquema/RPC)
- [ ] Lautaro073 (si toca D1–D14 o comportamiento visible)
- [ ] Fichas de las tareas bloqueadas reconciliadas con «Impacto exacto en la tarea»
