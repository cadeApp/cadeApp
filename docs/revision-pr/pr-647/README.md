# PR #647 — T-406 · Incidentes y parámetros según A05/A04

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/647 |
| **Tarea** | T-406 (Fase 4) · issue #487 |
| **Autor** | @Lautaro073 |
| **Rama** | `feat/T-406-incidentes-pestanas` → `develop` |
| **Base al revisar** | `1fc95aa57da2f8c68a1be68e3f0322a4acc0e948` |
| **SHA revisado** | `abf3f63873f4c8a9a1288d604735c7689708b0de` |
| **Tamaño del diff revisado** | 15 archivos, +523 / -79 líneas |
| **Estado de la revisión** | CON BLOQUEANTES (1); D01=C acordada, implementación pendiente |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `abf3f63873f4c8a9a1288d604735c7689708b0de` | H01 (bloqueante) y D01 (decisión resuelta, pendiente implementar) | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR647-H01 | Dos factores TOTP en el mismo E2E | alto | abierto / por inspección |
| D01 | Contador de abiertos periódico cada 60 s y al recuperar foco | decisión de Lautaro073 | C aprobada, pendiente implementar y probar |

La D01 está registrada como **decisión de alcance**, no como defecto reparado ni como verificación independiente. Por eso no se registra como H02 en `hallazgos.jsonl`. No hay hallazgos marcados `arreglado-verificado`.

[Datos estructurados](hallazgos.jsonl) · [Evidencia y comandos](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Qué falta

1. Corregir H01 con un único factor verificado reutilizado en el login de navegador.
2. Implementar D01=C: mantener el conteo inicial del layout; después leer **solo el conteo de abiertos** en un endpoint `/api/live` protegido por rol admin+AAL2; usar TanStack Query con período de 60 s mientras el panel esté visible y refetch al recuperar foco, sin Realtime.
3. Lautaro073 **autorizó** ampliar la ficha T-406 y su lista de archivos permitidos para esa solución dentro de la misma PR. Registrar la ampliación en ficha, bitácora y cuerpo de PR antes de dar por terminado el alcance. No modificar otros contratos sin CC.
4. Correr pruebas RED→GREEN auténticas; guardar salidas y verificar el E2E oficial del nuevo SHA. Pedir ronda 2 al terminar. No mergear desde la revisión.

Este commit de revisión mueve el head de la PR y puede disparar nuevos checks: no confundirlos con evidencia del SHA de implementación ya revisado.
