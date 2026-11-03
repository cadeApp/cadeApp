# PR #583 — T-401 · Comercios y postulantes sin datos inútiles

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/583 |
| Tarea | T-401 · Fase 4 |
| Autor | @Lautaro073 |
| Rama | `feat/T-401-admin-useless-data` → `develop` |
| Base revisada | `2ed5ef14e6b87efbdedb36e4da18ad8bf08f624a` |
| Último SHA funcional revisado | `887e280483e8f62d9a8b6cda3734ee08f7124772` |
| Estado | **Ronda 2: sin bloqueantes técnicos detectados; gates E2E/db pendientes al documentar; no aprobado ni mergeado.** |

## Rondas

| Ronda | SHA inspeccionado | Hallazgos nuevos | Informe |
|---|---|---|---|
| 1 | `b082fe414a3eb2507b5b08fa5d013499f8cf5586` | 0 | [Ronda 1](revisiones/ronda-1.md) |
| 2 | `887e280483e8f62d9a8b6cda3734ee08f7124772` | 0 | [Ronda 2](revisiones/ronda-2.md) |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) (vacío porque no se detectaron hallazgos).
Batería y evidencia: [comandos.md](evidencia/comandos.md).
Lecciones: [lecciones.md](lecciones.md).

## Estado para cierre

- Código de producción idéntico al de la ronda 1. El único cambio funcional posterior fue endurecer las aserciones unitarias de dos tests; la bitácora documenta M1–M9.
- CI del SHA funcional `887e2804`: `unit` 189 archivos / 3460 pruebas, `typecheck`, `lint`, `build`, `audit`, `bundle-budget` y `approval-policy` verdes al redactar.
- `db-tests` y `e2e-preview`: aún no concluidos al redactar; su verde es un **requisito externo de merge** que no se da por satisfecho.
- El E2E local `admin-courier-reinstate` (1 passed) está registrado por el autor en la bitácora para Preview del SHA `b082fe41`; no cubre todos los ejemplos de UI del DoD.
- Mutaciones M1–M9 con CONTROL→RED→GREEN: **reportadas por el autor** en la bitácora, sin log raw ni reproducción independiente en el runtime del revisor. La revisión confirmó por inspección que los tests cambiados no debilitan los asserts.
- Smoke autenticado del estado real de comercio sin nombre y ambos estados de DNI no observado por esta revisión.
- No exigir nuevo CI en verde exclusivamente por el commit de documentación de ronda 2: el SHA funcional que se verifica es `887e2804`.
