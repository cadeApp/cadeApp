# PR #475 — T-388 + T-389 (fichas)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/475 |
| Autor | @Lautaro073 |
| Rama | `docs/T-388-389-fichas` → develop |
| Base | `33b18573ead16f34ebb07e9e0865c00ce52c0229` |
| Alcance | 3 archivos de documentación de tareas, sin código |
| Estado de revisión | **SIN BLOQUEANTES DE FICHA en bc12c251; CI de ese SHA aún no todo verde** |

## Rondas

| Ronda | HEAD del autor revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `967bf1ab02a1b079dd7b3873687b2c1fac6fe9e1` | 6 hallazgos (3 altos, 3 medios), decisiones 1-B y 2-B | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `bc12c2518b3dc29649529913f5d17b3107254c82` | 6 hallazgos corregidos en fichas; sin bloqueantes documentales | [ronda-2.md](revisiones/ronda-2.md) |

## Estado de los hallazgos

| ID | Descripción | Estado |
|---|---|---|
| H01 | Permitir todas las superficies y tests | corregido, controlado en ronda 2 |
| H02 | Prefijo ≈ en lista del comercio | corregido, controlado en ronda 2 |
| H03 | 0 m / formato único | corregido, controlado en ronda 2 |
| H04 | Tests de proyecciones SQL | corregido, controlado en ronda 2 |
| H05 | RLS invisible vs distancia NULL | corregido, controlado en ronda 2 |
| H06 | D05-A y elementFromPoint | corregido, controlado en ronda 2 |

**Decisiones de Lautaro073:** 1-B («Mis ofertas» y distinción por RLS); 2-B (0 m → «Menos de 0,5 km», sin modificar DB). Adoptadas en `bc12c2518b3dc29649529913f5d17b3107254c82`.

## Pendiente antes de merge

- CI: a la hora de consulta, checks unit, lint, typecheck, build, audit y bundle-budget estaban verdes; **db-tests en progreso, approval-policy en rojo por ausencia de revisión y e2e-preview error por corrida cancelada**, NO por una aserción Playwright reportada como fallida. Esos gates deben quedar satisfechos antes de merge. No se disparan workflows manualmente desde esta revisión.
- El commit de revisión que agrega esta carpeta moverá el HEAD automáticamente; no usar ese nuevo HEAD como si fuese el SHA de código revisado. No pedir un segundo CI verde exclusivamente por esta carpeta documental si no cambió código ni fichas.
- Issues #473/#474 siguen abiertos: las correcciones funcionales se hacen en PR de implementación separadas.

[hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).
