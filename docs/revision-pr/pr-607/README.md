# PR #607 — T-404 · Detalle del postulante según A02

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/607 |
| **Tarea** | T-404 (Fase 4, #485) |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-404-detalle-postulante-a02` → `develop` |
| **Base de comparación** | `7d07fdf80d94bce49580ec84cc39722b5bff4756` |
| **SHA revisado** | `1d4fcc2900c8c6720cb486bb9bb8d9436bf3c5fc` |
| **Tamaño** | 16 archivos, +1101/-115 líneas |
| **Estado** | **SIN BLOQUEANTES de código por inspección (0)**; CI parcial verde, `db-tests` y `e2e-preview` pendientes a la fecha de la ronda 2; Draft |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `e5ca27ad4040` | 2 bloqueantes + 1 ajuste de proceso | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `1d4fcc2900c8` | 0 bloqueantes detectados; CI/E2E con gates pendientes | [ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR607-H01 | Recorte elimina eventos de registro/envío | alto | arreglado-sin-verificar (inspección + CI unit verde) |
| PR607-H02 | «Ver todo» no trae auditoría completa de ese repartidor | alto | arreglado-sin-verificar (E2E pendiente) |
| PR607-H03 | Ficha/PR necesitan reflejar traslado del DoD a CC separado | medio | aceptado (D01=C y ficha reconciliada) |

**Decisión D01=C:** mensaje seguro para repartidor en un CC + tarea aparte, sin ampliar contratos en T-404. Issue abierto y asignado: [#609](https://github.com/cadeApp/cadeApp/issues/609). **D02=C:** filtro `?courier=<uuid>` para repartidor y documentos; la ficha puede incorporar los archivos de auditoría acordados. **D03=C:** 50 filas reales de auditoría + hasta 2 hitos, máximo 52.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia y procedimientos: [evidencia/comandos.md](evidencia/comandos.md) · [Lecciones](lecciones.md).

## Qué queda por hacer

1. **Gates del SHA de código `1d4fcc2900c8...`:** `unit` **PASS: 193/193 · 3568/3568**; `typecheck`, `lint`, `build`, `audit`, `bundle-budget` con conclusión success (el presupuesto muestra **advertencia**: admin/applicants/[id] y admin/audit **267 kB frente a 180 kB**, igual que en el SHA de la ronda 1; no es una regresión de la ronda 2). `db-tests` en progreso y `e2e-preview` en progreso al redactar la ronda 2.
2. **E2E:** el [run #41947878934](https://github.com/cadeApp/cadeApp/actions/runs/41947878934) se resolvió a la PR #607 y comprobó Preview/Supabase Develop; el job Playwright sigue en progreso. **No confundir el head SHA del workflow de dispatch en develop con el SHA destino publicado en `e2e-preview`: el workflow hace checkout de `needs.resolve.outputs.sha`.**
3. **Si E2E/DB no cierran en verde:** revisar logs del job y registrar R03 solo si hay fallo real/regresión, o corregir por el agente con un informe claro. No mergear por el check verde de unidades solamente. `approval-policy` falla mientras no existe un informe independiente «SIN BLOQUEANTES»; eso no es un error de código.
4. No repetir CI GREEN **solo por este commit documental** de la revisión (regla décima). `docs/revision-pr/` sigue exclusivamente a cargo del revisor; la bitácora sigue a cargo del agente.

**Alcance R02:** diff exacto `7cc21d39..1d4fcc29` revisado con GitHub; entorno local sin DNS para GitHub ni `pnpm`, por lo que no se corrieron tests ni mutaciones de autor/independientes en worktree local. Evidencia de **CI ejecutado por GitHub** inspeccionada contra el SHA exacto; se distinguen los verdes de lo que falta comprobar.
