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
| **SHA R5** | `c751cc8fd32b4d402670fbe637dac7d251f23f9b` |
| **SHA R6** | `20de71c1e5c9431cfb7ac8207a468879093d550d` |
| **Estado** | **CON BLOQUEANTES (1)**: H06 (gate ejecutado realmente, pero E2E T-353 falla en aserción de privacidad mal aplicada) |
| **Verificación** | Lectura independiente del log E2E real en GitHub #38688520658: 75 passed / 1 failed; CI 7/7 success; sin ejecución local ni mutaciones |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `1a433728` | 7 hallazgos | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `5dfb57b` | 5 arreglados por inspección sin verificar runtime; H06/H07 parciales, H08 nuevo | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `55fa228` | H08 arreglado por inspección; H06/H07 pendientes | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `aa191cbc` | H06: implementación E2E mejorada, sin run; H07: mutación H05 inválida | [ronda-4.md](revisiones/ronda-4.md) |
| 5 | `c751cc8` | H07 corregido por inspección; H06 pendiente de E2E Preview y verificación del dispatch | [ronda-5.md](revisiones/ronda-5.md) |
| 6 | `20de71c` | H06: E2E real RED, 75 passed / 1 failed, test aplica política de red a fila administrativa; corrección acotada pendiente | [ronda-6.md](revisiones/ronda-6.md) |

## Estado de hallazgos
- **PR362-H01** · Límite monetario contrario a decisión 1B · `arreglado-sin-verificar`
- **PR362-H02** · Teléfonos aceptados sin persistencia normalizada y sintaxis permisiva · `arreglado-sin-verificar`
- **PR362-H03** · Prueba walk/bike da verde aunque el onboarding rechace la operación · `arreglado-sin-verificar`
- **PR362-H04** · El filtro de controles rechaza saltos de línea legítimos en notas · `arreglado-sin-verificar`
- **PR362-H05** · Faltan pruebas en la frontera real de Server Actions · `arreglado-sin-verificar`
- **PR362-H06** · E2E real ejecutado pero el test T-353 falla en `multi-drop.spec.ts:1099` · `parcial`
- **PR362-H07** · La bitácora declara RED→GREEN sin salida roja reproducible · `arreglado-sin-verificar`
- **PR362-H08** · E2E multi-drop pasa sin ejecutar aserciones si falta el teléfono · `arreglado-sin-verificar`

## Decisiones de Lautaro073
- 2026-10-15: **1B** límite `integer` de PostgreSQL 1…2_147_483_647 ARS; **2A** patente a `null` para `walk/bike`.
- Las dos se reflejan en el código de R2/R3/R4/R5/R6. No nuevas decisiones abiertas.
- No aprobar ni mergear: gate E2E RED por aserción fallida de T-353; después de corregir, correr de nuevo en SHA exacto, con Playwright green, y completar aprobación vigente de Lautaro073.

[hallazgos.jsonl](hallazgos.jsonl) · [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).
