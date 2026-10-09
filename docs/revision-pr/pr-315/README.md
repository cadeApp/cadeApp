# PR #315 — T-347 / T-313 · catálogo de mutación courier (D06-C)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/315 |
| Tarea principal | T-347, complemento de T-313 |
| Autor | Lautaro073 |
| Rama | `test/T-347-t313-courier-guard-mutation` → `develop` |
| HEAD funcional revisado | `c6220ba587ffaab7c27fe83f2746600d60e0cbb7` |
| Base al inicio | `24aad21f800f0d13fdeb082f9807b8eaf1f10fba` |
| Develop después de #314 | `92cd258545f25e162ada062c0c22c02ff17840b8` |
| Alcance | 4 archivos, +185/-8 (antes de la revisión) |
| Estado | **Ronda 1: CON BLOQUEANTES (1)**; PR continúa draft; no aprobada ni mergeada |

## Rondas

| Ronda | SHA funcional revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `c6220ba587ffaab7c27fe83f2746600d60e0cbb7` | 1 bloqueante | [ronda-1](revisiones/ronda-1.md) |

## Hallazgos

| ID | Título | Severidad | Estado |
|---|---|---|---|
| PR315-H01 | El test estructural no vincula el oráculo `toHaveURL` al caso courier | alto | abierto |

[Datos estructurados](hallazgos.jsonl) · [Evidencia y harness](evidencia/comandos.md) · [Lecciones](lecciones.md)

## Qué falta

1. Corregir PR315-H01 en `.github/workflows/verify-workflows.test.mjs` y demostrar el control GREEN + mutantes RED (no solo inspección).
2. Actualizar únicamente la bitácora `docs/tasks/log/T-347.md`, commit y push de agy. Prohibido que agy escriba en `docs/revision-pr/**`.
3. Incorporar `origin/develop` (ya incluye el merge de PR #314) mediante **merge**, sin rebase, para reejecutar el E2E Preview y comprobar que el arreglo T-339 está presente en el HEAD del PR. No atribuir el verde de otra rama a este HEAD.
4. Nueva revisión independiente del nuevo SHA; cada corrección requiere mutaciones adicionales del revisor. No ejecutar `repository_dispatch` hasta que #251 esté mergeada en develop.
5. Posteriormente: merge de #315 solo por Lautaro073, integración de develop en #251, merge de #251 decidido por Lautaro073 y recién entonces mutación `t313-courier-merchant-guard` con `RED_CONFIRMED` y artifact minimizado.

**Decisiones de Lautaro073 (2026-10-09):** 1-A validación del helper/caso concreto; 2-A mergear #314 primero. #314 se mergeó como `92cd258545f25e162ada062c0c22c02ff17840b8`.

## Nota de alcance

Se inspeccionó el código de la PR, el spec de #251 y la bitácora; el predicado estructural se contrastó independientemente en memoria con tres mutaciones. **No se ejecutaron pnpm, git apply ni Playwright localmente en esta sesión** porque no hubo clon accesible en el entorno. CI previo sobre `c6220ba587ffaab7c27fe83f2746600d60e0cbb7` se leyó desde GitHub; no constituye GREEN del HEAD de revisión ni de develop actualizado.
