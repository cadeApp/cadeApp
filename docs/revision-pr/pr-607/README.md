# PR #607 — T-404 · Detalle del postulante según A02

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/607 |
| **Tarea** | T-404 (Fase 4, #485) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-404-detalle-postulante-a02` → `develop` |
| **Base de comparación** | `7d07fdf80d94bce49580ec84cc39722b5bff4756` |
| **SHA revisado** | `e5ca27ad40400283993752ac93d833912753ce95` |
| **Tamaño** | 16 archivos, +1101/-115 líneas |
| **Estado** | **CON BLOQUEANTES (2)**; ajustes documentales pendientes; Draft |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `e5ca27ad4040` | 2 bloqueantes + 1 ajuste de proceso | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR607-H01 | Recorte elimina eventos de registro/envío | alto | abierto |
| PR607-H02 | «Ver todo» no trae auditoría completa de ese repartidor | alto | abierto |
| PR607-H03 | Ficha/PR necesitan reflejar traslado del DoD a CC separado | medio | abierto (decisión resuelta) |

**Decisión D01=C:** mensaje seguro para repartidor en un CC + tarea aparte, sin ampliar contratos en T-404. Issue abierto y asignado: [#609](https://github.com/cadeApp/cadeApp/issues/609). **D02=C:** filtro `?courier=<uuid>` para repartidor y documentos; la ficha puede incorporar los archivos de auditoría acordados. **D03=C:** 50 filas reales de auditoría + hasta 2 hitos, máximo 52.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia y procedimientos: [evidencia/comandos.md](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Qué queda por hacer

1. Agente autor: ejecutar el prompt cerrado del informe/comentario, solucionar H01/H02, alinear ficha/bitácora/PR (H03), y anexar pruebas RED→GREEN **reales**.
2. Revisión independiente R02: comparar nuevo SHA, ejecutar harness + controles y comprobar auditoría, paginación y E2E Preview antes de declarar sin bloqueantes.
3. No aprobar ni mergear hasta resolver bloqueantes y validar CI/E2E conforme al DoD. El seguimiento de #609 **no bloquea este PR** si el traslado se formaliza.

**Alcance de esta ronda:** lectura independiente vía GitHub; el entorno local no pudo resolver `github.com` para clonar el repositorio, ni se ejecutó Vitest/CI/E2E. Ninguna prueba fue marcada como verificada.
