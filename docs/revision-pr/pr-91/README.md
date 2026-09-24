# PR #91 — T-203 · Emisor de push

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/91 |
| **Tarea / issue** | `T-203` · #30 |
| **Autor** | @Lautaro073 · P1 |
| **Rama** | `feat/T-203-emisor-push` → `develop` |
| **develop al revisar** | `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121` |
| **SHA revisado** | `038faab20a32fe5d468eede1310d45eb8a570c61` |
| **Tamaño** | 12 archivos · +1277 / -7 |
| **Estado** | ❌ bloqueada · 8 bloqueantes |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `038faab` | 8 bloqueantes | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Resumen | Sev. | Estado |
|---|---|---:|---|
| A01 | La rama autoamplía la ficha para `package.json`/lockfile/`web-push` | alto | abierto |
| H01 | El fallo del Juez queda sin cableado de transiciones/ciclo de vida completo | alto | abierto |
| H02 | El test post-commit pasa si `safeNotifyPostTransition` no hace nada | alto | abierto |
| H03 | El 410 real de `web-push` queda fuera de los tests | alto | abierto |
| H04 | Privacidad: 2/5 variantes de payload cubiertas | alto | abierto |
| H05 | Matrices HTTP anunciadas pero no enumeradas | medio | abierto |
| H06 | `test:db` marcado n.a. pese a tocar `src/server/**` | medio | abierto |
| H07 | Rojo de import/setup usado como prueba del DoD | medio | abierto |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [evidencia/comandos.md](evidencia/comandos.md) · Lecciones: [lecciones.md](lecciones.md)

## Lo que sí está bien en `038faab`

- Los cinco payloads actuales se construyen con Zod y, tal como están escritos hoy, solo exponen tipo de evento e IDs.
- La ruta interna de envío usa runtime Node y comparación constante de `CRON_SECRET`.
- La ruta de suscripciones toma `user_id` de la sesión, y el delete filtra además por el usuario autenticado.
- La política del emisor distingue 2xx, 404/410 y errores transitorios, y el código actual borra solo 404/410.
- El commit `aa89372` sí puso el archivo de tests antes de `sender.ts`; el problema de H07 no es el orden, sino que ese rojo era de import/setup y no una mutación de cada propiedad.

## Bloqueo de especificación antes de arreglar código

La ficha oficial de T-203 en `develop` no permite `package.json`/`pnpm-lock.yaml` y dice `Dependencias nuevas permitidas: ninguna`, aunque la regla 25 ya reserva `web-push` para T-203. Además, el fallo `push-notification-implementation-scope` exige call sites post-commit y ciclo de vida que la lista de archivos permitidos no deja tocar. La rama no puede resolver esa contradicción reescribiendo su propia ficha.

Antes de una ronda de arreglo completa, Lautaro073 debe alinear la ficha oficial en `develop` con el fallo del Juez (o dividir explícitamente los ítems faltantes en tareas dependientes). Recién después corresponde traer `develop` por merge y arreglar el producto dentro del alcance resultante.

## Ejecución de esta ronda

- Branch/head: confirmado remoto en `038faab`; PR mergeable y 0 commits detrás de `develop` al iniciar la ronda.
- Comentarios de PR: ninguno antes del cierre de esta ronda.
- Carpeta `docs/revision-pr/pr-91/`: no existía en el SHA revisado; el autor no la había tocado.
- Checkout local: **no disponible**; `git clone` falló por DNS (`Could not resolve host: github.com`).
- `pnpm typecheck/lint/test`: no ejecutados independientemente por falta de checkout.
- `pnpm test:db`: no ejecutado por la revisión; además el autor lo marcó incorrectamente `n.a.` aunque toca `src/server/**`.
- CI: **no inspeccionado** porque la ronda ya tiene bloqueantes, conforme al procedimiento. Tampoco se levantó Supabase/Docker local.
- Mutaciones: se dejó un arnés completo y reproducible en `evidencia/comandos.md`; en esta sesión se validó su sintaxis, pero no se atribuye un verde/rojo de Vitest que no pudo ejecutarse.

No se aprueba ni se mergea esta PR.
