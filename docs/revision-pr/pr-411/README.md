# PR #411 — T-369 paso 3/3 (E2E y acta de staging)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/411 |
| Código revisado (ronda 1) | `672de34db9602ccb0c97b3ee8d780acbd0d52f08` |
| Base | `develop` en `15c68d9` |
| Estado | **Ronda 1 CON BLOQUEANTES (1)**; E2E global-settings sin ejecutar por un fixture anterior T-302 |

## Rondas

- [Ronda 1](revisiones/ronda-1.md): **PR411-H01** — T-302 usa DNI fijo que colisiona con Develop, aborta Chromium y deja sin ejecutar los tres E2E `global-settings` de T-369. Caso piloto activo sí PASS.

## Hallazgos

- `PR411-H01`: `abierto`, origen de bloqueo **preexistente fuera del diff #411**. No inferir que la implementación de T-369 está defectuosa, ni que los tres escenarios sin correr pasaron.

[Evidencia](evidencia/comandos.md) · [Hallazgos JSONL](hallazgos.jsonl) · [Lecciones](lecciones.md).

No se aprobó ni mergeó. Paso 3 y acta de staging sin terminar; la issue #356 sigue abierta.