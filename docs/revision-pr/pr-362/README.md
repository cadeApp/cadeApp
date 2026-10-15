# PR #362 — T-353 · Validación semántica integral de entradas

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/362 |
| **Tarea** | T-353, issue #340, fase 3 |
| **Autor** | @asako669 (P2) |
| **Rama** | `feat/T-353-validacion-formularios` → `develop` |
| **Base revisada** | `14c28ed3c41cb2bde92705fc018c7dd0df73245b` |
| **HEAD revisado** | `1a433728edcd8e7d6a5e89f27e07763fe330083a` |
| **Estado** | **CON BLOQUEANTES (7)** — ronda 1 |
| **Tipo de comprobación** | Inspección del diff y fuentes de GitHub + control Node aislado; sin clon ni ejecución Vitest |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `1a433728edcd8e7d6a5e89f27e07763fe330083a` | 7 abiertos | [ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

- **PR362-H01** · Límite monetario contrario a decisión 1B · alto · abierto
- **PR362-H02** · Teléfonos aceptados sin persistencia normalizada y sintaxis permisiva · alto · abierto
- **PR362-H03** · Prueba walk/bike da verde aunque el onboarding rechace la operación · medio · abierto
- **PR362-H04** · El filtro de controles rechaza saltos de línea legítimos en notas · medio · abierto
- **PR362-H05** · Faltan pruebas en la frontera real de Server Actions · alto · abierto
- **PR362-H06** · E2E Preview y validación de UI por campo pendientes · alto · abierto
- **PR362-H07** · La bitácora declara RED→GREEN sin salida roja reproducible · medio · abierto

## Decisiones de Lautaro073 (2026-10-15)
- **1B:** conservar el rango positivo de PostgreSQL `integer` (1 … 2_147_483_647 ARS), sin límite comercial arbitrario de 10 millones.
- **2A:** `vehiclePlate: null` para `walk` y `bike`; comprobar aceptación del onboarding y ausencia de persistencia indebida.
- Estas decisiones se recogieron ANTES de cerrar la ronda. No se impone ahora un nuevo CC ni restricciones arbitrarias de placa por subtipo sin validación oficial.
- No aprobar ni mergear hasta nueva ronda independiente con evidencia exacta del nuevo SHA.

Datos: [hallazgos.jsonl](hallazgos.jsonl) · [Evidencia](evidencia/comandos.md) · [Lecciones](lecciones.md).
