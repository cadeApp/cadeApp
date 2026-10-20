# PR #452 — T-384 / T-385 / T-386 · Fichas de implementación CC-033/034/035

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/452 |
| Autor | @Lautaro073 |
| Rama | `docs/T-384-cc-impl-fichas` → `develop` |
| Base al revisar | `b35b0aef48608d0f3dd767460c65eccf56aed9f0` |
| SHA del autor revisado | `844f0c99f91184a5cc4bc069dc8512f0765c3adf` |
| Comparación PR #448 | `e06cb606651f0c94e4ae00eca12758eb9b2b8b53` (todavía abierta) |
| Alcance inicial | 4 documentos; +267/-0; sin código/SQL |
| Estado de revisión | **RONDA 1 CERRADA — CON BLOQUEANTES (2)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `844f0c99f91184a5cc4bc069dc8512f0765c3adf` | 2 bloqueantes documentales / coordinación | [ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Ubicación | Estado |
|---|---|---|
| PR452-H01 | `T-385.md`, `T-386.md`, filas del plan §8 | Abierto — explicitar BLOQUEADA hasta merge de #448 |
| PR452-H02 | `T-376.md` / `T-380.md` / `T-383.md` y plan §8 | Abierto — hacer explícitas T-384/385/386 como dependencias de UI |

El registro completo está en [hallazgos.jsonl](hallazgos.jsonl); [evidencia/comandos.md](evidencia/comandos.md) contiene el arnés reproducible y [lecciones.md](lecciones.md) las conclusiones.

## Decisiones ya tomadas

Lautaro073, 2026-10-20: **1-B** continuar con las tres fichas ahora; CC-033 ya mergeado, T-384 no depende de #448; T-385 y T-386 no se ejecutan hasta que CC-034 y CC-035 entren en develop desde #448. **2-A** T-376 depende de T-384, T-380 de T-385 y T-383 de T-386, tanto en fichas como en plan.

## Estado y limitaciones

- El autor todavía debe corregir H01 y H02. No hay hallazgos verificados como corregidos.
- `docs/tasks/T-380.md` y `T-383.md` existen en la rama de #448, no en `develop`. Se deben actualizar allí o, tras el merge de #448, sincronizar #452 sin copiar versiones pendientes.
- No se ejecutaron `pnpm`, DB tests ni E2E. Esta ronda es exclusivamente documental; el control independiente por lectura de los SHAs citados dio **9 conformidades y 10 condiciones faltantes**, agrupadas en dos hallazgos. Ver el arnés y límites de evidencia.
- `git merge-tree` no fue ejecutado en un clon; GitHub indicó que #452 estaba al día con `develop` al iniciar esta ronda. Un avance de #448 puede requerir un merge convencional de develop y resolución del plan.
- El CI de software se examinará cuando haya una PR de implementación. La revisión documental no exige otra corrida verde por su propio commit.
- **No aprobada ni mergeada.** Al publicar el commit de revisión, el HEAD deja de ser el SHA de autor auditado: es obligatorio ejecutar `git pull` antes de arreglar, sin rebase/force/amend.
