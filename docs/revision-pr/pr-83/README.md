# PR #83 — T-115 · Vista de viaje

> ❌ **Ronda 1: CON BLOQUEANTES · 5 bloqueantes · 1 mejora · 1 decisión resuelta**
> Revisión independiente sobre `4b4f18b0676cd5c5afb8ab5bb7f4328e28050621`. CI no se consultó porque hay bloqueantes.

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/83 |
| **Tarea / issue** | `T-115` · #21 |
| **Autor** | @asako669 · P2 |
| **Rama** | `feat/T-115-vista-de-viaje` → `develop` |
| **Base** | `720e2d4f39ab5b4d5d09a55016072eb8fe940855` |
| **SHA revisado** | `4b4f18b0676cd5c5afb8ab5bb7f4328e28050621` |
| **Tamaño al revisar** | 3 archivos · +393 |
| **Estado** | Draft · fase roja inicial |

## Rondas

| Ronda | SHA | Resultado | Informe |
|---|---|---|---|
| 1 | `4b4f18b` | ❌ 5 bloqueantes · 1 mejora · D01 aceptada | [ronda-1.md](revisiones/ronda-1.md) |

## Estado

| ID | Resumen | Sev. | Estado |
|---|---|---:|---|
| PR83-H01 | Actions no prueban RPC/input invocados | alto | abierto |
| PR83-H02 | Matriz sesión/rol incompleta | alto | abierto |
| PR83-H03 | no-show omite default y `false → cancelled` | alto | abierto |
| PR83-H04 | “sin datos de más” usa blacklist | alto | abierto |
| PR83-H05 | rojo declarado es fallo de import, no mutación | medio | abierto |
| PR83-H06 | bitácora contradictoria | bajo | abierto |
| PR83-D01 | `wa.me/<recipient_phone>` para actor autorizado | decisión | aceptado |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [comandos.md](evidencia/comandos.md) · Lecciones: [lecciones.md](lecciones.md)

## Verificado como correcto en este SHA

- Los 3 archivos del diff están dentro de “Archivos permitidos” de la ficha T-115 leída desde `develop`.
- La PR no modifica su ficha.
- Head comprobado al inicio y antes de cerrar la ronda: `4b4f18b`; 2 commits adelante y 0 detrás de la base revisada.
- No había comentarios ni threads previos.
- La lista funcional de actions coincide con el ciclo definido: retirado, entregado, cancelación por repartidor, no-show, cancelación por comercio y republicación.
- El rojo inicial por módulos aún no implementados es válido como comienzo de TDD; H05 solo corrige la afirmación de que eso ya demuestra cada control por mutación.

## Ejecución

- CI: no consultado, por tener bloqueantes.
- `pnpm typecheck/lint/test`: no ejecutados independientemente; el entorno no pudo resolver `github.com` al intentar clonar. Se continuó con los blobs exactos del SHA y mutaciones aisladas reproducidas con Node.
- `test:db`: n.a.; el diff no toca `supabase/` ni `src/server/`.

## Qué sigue

Corregir H01–H05, actualizar la bitácora por H06 y volver a revisar en un SHA nuevo. D01 queda resuelta: T-115 puede usar el teléfono en `wa.me` si el actor ya está autorizado por RLS; `AGENTS.md` se corrige fuera de esta tarea.
