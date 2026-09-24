# PR #91 — T-203 · Emisor de push

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/91 |
| **Tarea / issue** | `T-203` · #30 |
| **Autor** | @Lautaro073 · P1 |
| **Rama** | `feat/T-203-emisor-push` → `develop` |
| **develop al revisar** | `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121` |
| **SHA revisado (ronda 2)** | `6f867f115699d9c8df373aa3126b8f6e0910677c` |
| **SHA producto** | `038faab20a32fe5d468eede1310d45eb8a570c61` |
| **Estado** | ❌ bloqueada · 8 bloqueantes |

## Rondas

| Ronda | SHA revisado | Cambios desde ronda anterior | Resultado | Informe |
|---|---|---|---|---|
| 1 | `038faab` | implementación inicial | 8 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `6f867f1` | solo bitácora (+9 líneas), sin producto | mismos 8 bloqueantes | [ronda-2.md](revisiones/ronda-2.md) |

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

## Ronda 2: qué pasó realmente

El agente siguió correctamente el freno indicado en la ronda 1: al comprobar que `origin/develop` todavía conserva la ficha vieja de T-203, no volvió a tocar producto ni a ampliar la ficha desde la rama.

Entre `18f4749` y `6f867f1` solo cambió `docs/tasks/log/T-203.md` (+9 líneas). Por eso no hay ningún hallazgo técnico que pueda pasar a verificado en esta ronda.

## Bloqueo de especificación

La ficha oficial de T-203 en `develop` sigue sin permitir `package.json`/`pnpm-lock.yaml` y declara `Dependencias nuevas permitidas: ninguna`, aunque la regla 25 reserva `web-push` para T-203. Además, el fallo del Juez exige call sites post-commit y ciclo de vida fuera del conjunto actual de archivos permitidos.

Antes de volver a mandar al agente a corregir la PR, esa contradicción debe resolverse en `develop`: o T-203 absorbe explícitamente los archivos/dependencia necesarios, o se crean tareas dependientes claras para los ítems que queden fuera.

No se aprueba ni se mergea esta PR.
