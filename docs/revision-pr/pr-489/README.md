# PR #489 — T-400 a T-407 · Fichas Fase 4 admin

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/489 |
| Autor | @Lautaro073 |
| Rama | `docs/T-400-407-fichas` → `develop` |
| Base leída | `824c4fdb8a4277220e14b575eaf6a15e40df8406` |
| HEAD revisado | `25ad3cf36cf580bdc632448ad88d926220b1dec6` |
| Tamaño | 9 archivos, +911/−0, solo documentación |
| Estado | **CON BLOQUEANTES**, sin aprobación ni merge |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `25ad3cf36cf580bdc632448ad88d926220b1dec6` | 7 altos, 3 medios, 2 bajos | [ronda-1.md](revisiones/ronda-1.md) |

## Decisiones de Lautaro073 (21/10/2026)
- D01=C: búsqueda normalizada en PostgreSQL → [CC propuesto #498](https://github.com/cadeApp/cadeApp/issues/498).
- D02=C: fecha de envío transaccional → [CC propuesto #499](https://github.com/cadeApp/cadeApp/issues/499).
- D03=C: separar Abiertos / Resueltos / Desestimados sin cambiar esquema.

## Hallazgos
| ID | Severidad | Tarea | Estado |
|---|---|---|---|
| PR489-H01 | alto | T-400–T-407 | abierto |
| PR489-H02 | alto | T-403 | abierto |
| PR489-H03 | alto | T-403/T-404 | abierto |
| PR489-H04 | alto | T-404 | abierto |
| PR489-H05 | alto | T-405/T-407 | abierto |
| PR489-H06 | alto | T-406 | abierto |
| PR489-H07 | alto | T-407 | abierto |
| PR489-H08 | medio | T-400 | abierto |
| PR489-H09 | medio | T-402/T-403 | abierto |
| PR489-H10 | medio | T-400 | abierto |
| PR489-H11 | bajo | T-404 | abierto |
| PR489-H12 | bajo | T-405 | abierto |

## Qué queda por hacer
1. Agy corrige **solo los 9 archivos de documentación originalmente modificados** en esta PR, con el prompt del comentario de ronda y el informe completo.
2. No alterar `docs/revision-pr/pr-489/**` ni `tools/verify-fichas.test.ts`.
3. Revalidar al mismo SHA de código/plan, incluyendo `pnpm exec vitest run tools/verify-fichas.test.ts`; el CI original falló justo allí. 
4. D01/D02 son dependencias de CC posteriores, **no desplegar SQL en esta PR**.
5. Pedir nueva ronda al terminar. No mergear sin revisión sin bloqueantes.
