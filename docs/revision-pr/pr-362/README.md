# PR #362 — T-353 · Validación semántica integral de entradas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/362 |
| **Tarea** | T-353, issue #340, fase 3 |
| **Autor** | @asako669 (P2) |
| **Rama** | `feat/T-353-validacion-formularios` → `develop` |
| **Base revisada** | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| **SHA R1** | `1a433728edcd8e7d6a5e89f27e07763fe330083a` |
| **SHA R2** | `5dfb57b33f32f4fb4d20f3a824db7bd9cfc5b754` |
| **SHA R3** | `55fa228e8d8b37b3d06426d02e816ce776398419` |
| **SHA R4** | `aa191cbc039f3600cfc46abe79edc090c72a8f5f` |
| **Estado** | **CON BLOQUEANTES**: H06 (falta gate E2E real) y H07 (mutación H05 inválida y reproducción incompleta) |
| **Verificación** | Inspección GitHub + estado CI parcial; sin ejecución local Vitest, E2E ni mutaciones de producción |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `1a433728` | 7 hallazgos | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `5dfb57b` | 5 arreglados por inspección sin verificar runtime; H06/H07 parciales, H08 nuevo | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `55fa228` | H08 arreglado por inspección; H06/H07 pendientes | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `aa191cbc` | H06: implementación E2E mejorada, sin run; H07: mutación H05 inválida | [ronda-4.md](revisiones/ronda-4.md) |

## Estado de hallazgos
- **PR362-H01** · Límite monetario contrario a decisión 1B · `arreglado-sin-verificar`
- **PR362-H02** · Teléfonos aceptados sin persistencia normalizada y sintaxis permisiva · `arreglado-sin-verificar`
- **PR362-H03** · Prueba walk/bike da verde aunque el onboarding rechace la operación · `arreglado-sin-verificar`
- **PR362-H04** · El filtro de controles rechaza saltos de línea legítimos en notas · `arreglado-sin-verificar`
- **PR362-H05** · Faltan pruebas en la frontera real de Server Actions · `arreglado-sin-verificar`
- **PR362-H06** · E2E Preview y validación de UI por campo pendientes · `parcial`
- **PR362-H07** · La bitácora declara RED→GREEN sin salida roja reproducible · `parcial`
- **PR362-H08** · E2E multi-drop pasa sin ejecutar aserciones si falta el teléfono · `arreglado-sin-verificar`

## Decisiones de Lautaro073
- 2026-10-15: **1B** límite `integer` de PostgreSQL 1…2_147_483_647 ARS; **2A** patente a `null` para `walk/bike`.
- Las dos se reflejan en el código de R2/R3/R4. No nuevas decisiones abiertas.
- No aprobar ni mergear con bloqueantes.

[hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).
