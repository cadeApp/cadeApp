# PR #432 — T-375 · Restauración de pilot_active tras timeout de E2E

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/432 |
| Tarea | T-375 · estabilidad E2E |
| Autor | @Lautaro073 |
| Rama | feat/T-375-pilot-restore → develop |
| Base revisada | d9b49647f484b5f1b5a502225e9f3b6f95d7402a |
| HEAD de código revisado | 35b2792ba68eaff8c33d4e7851e056098e8ac87a |
| Tamaño | 5 archivos, +214/-89 líneas |
| Estado | Ronda 1: sin bloqueantes técnicos; 1 riesgo separado aceptado |

## Rondas

| Ronda | SHA del código revisado | Resultado | Informe |
|---|---|---|---|
| 1 | 35b2792ba68eaff8c33d4e7851e056098e8ac87a | SIN BLOQUEANTES · D01 aceptada | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Seguimiento

- PR432-H01 / D01: una escritura false pendiente puede aplicarse después de restore; reproducido únicamente en memoria, no demostrado en Supabase. Decisión Lautaro073: opción A, no bloquear T-375; issue https://github.com/cadeApp/cadeApp/issues/433.
- 0 hallazgos bloqueantes del alcance T-375 y 0 mejoras obligatorias.
- Código sin modificaciones por la revisión. El commit que añade esta carpeta mueve HEAD y no altera las ejecuciones verificadas del SHA previo.
- La PR sigue Draft: Lautaro073 decide cuándo marcarla Ready y mergear; la revisión no aprueba ni mergea.

Registro [hallazgos.jsonl](hallazgos.jsonl) · [Evidencia y harness](evidencia/comandos.md) · [Lecciones](lecciones.md).
