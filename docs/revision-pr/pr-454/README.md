# PR #454 — T-384 / CC-033 · Revisión independiente

| Campo | Dato |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/454 |
| Tarea | T-384 · CC-033 |
| Rama | `feat/T-384-cc033-optional-document` → `develop` |
| Base de ronda 2 | `fee28dbdf2cf358aa8d36198d81b3cb04f81e61b` |
| HEAD revisado en ronda 2 | `cb32fdce9986ed133db68def0d1a2017122b90a7` |
| Estado | **Draft · CON BLOQUEANTES (3) · NO MERGEAR** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `cc87a902e30c5c2f452e80edb34ca78dac396ab3` | 6 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `cb32fdce9986ed133db68def0d1a2017122b90a7` | 3 bloqueantes (H01, H03, H04), 1 observación de proceso | [ronda-2.md](revisiones/ronda-2.md) |

## Estado actualizado

- **Pendientes:** H01 (falta matriz pgTAP de consentimiento/pendiente licencia y SQLSTATE), H03 (fake admite `.PNG`), H04 (fake carece de escenarios observables exigidos).
- **Resueltos según inspección + CI:** H02 (4 carreras y mutación de locks), H05 (wrapper/argumentos), H06 (drift de tipos generado).
- **Observación de proceso:** H07 (autor del código tocó espacios finales del informe independiente previo, sin cambiar el contenido).
- **Decisiones 🔵 pendientes:** ninguna; CC-033 ya está aprobado.

Detalle reproducible: [hallazgos.jsonl](hallazgos.jsonl), [evidencia/comandos.md](evidencia/comandos.md), [lecciones.md](lecciones.md). No se ejecutó PostgreSQL local ni se alteraron tests para pasarlos en verde.
