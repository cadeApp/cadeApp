# Revisión PR #178 — CC-014

- **PR:** #178
- **Rama:** `cc/CC-014-map-picker-hardening`
- **SHA funcional R1:** `de6e475b3167a72c80d2688712b6e1a74928b55a`
- **develop:** `1457072a7cac1ae9e2a8a92abe9253d45b745082`
- **Ronda:** 1
- **Resultado:** **CON BLOQUEANTES (3)**

## Estado

| ID | Severidad | Estado |
|---|---|---|
| PR178-H01 | alto | abierto |
| PR178-H02 | medio | abierto |
| PR178-H03 | medio | abierto |
| PR178-H04 | bajo | abierto |

## Resumen

CC-014 está bien encuadrado como `contract-change`, parte de `develop`, toca únicamente los tres archivos previstos y el CI exact-head está verde.

Quedan tres bloqueantes antes del merge:

1. `MapCameraSynchronizer` recibe `activeCoords`, por lo que drag y click también terminan ejecutando `panTo()`, contradiciendo el contrato que reserva esa sincronización para cambios externos/GPS/teclado.
2. La evidencia RED inicial no es diagnóstica: la suite final llama un helper nuevo en `beforeEach` que no existe en `develop`, por lo que al portar la suite sola puede caer antes de ejecutar las aserciones de cámara/drag/click.
3. `src/ui/map.tsx` exporta `resetAuthFailureBridgeForTesting`, agregando API pública pese a que CC-014 declara que la API pública se preserva sin cambios.

Mejora de coordinación: T-323 (#171) sigue etiquetada `en-curso` y no `bloqueada`, aunque la skill de `contract-change` exige marcar las tareas afectadas como bloqueadas mientras el CC está abierto.
