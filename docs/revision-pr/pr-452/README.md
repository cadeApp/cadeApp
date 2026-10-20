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
| Estado de revisión | **RONDA 2 CERRADA — SIN BLOQUEANTES DOCUMENTALES (0)** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `844f0c99f91184a5cc4bc069dc8512f0765c3adf` | 2 bloqueantes documentales / coordinación | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `ff7b9d70c7a836b78430d16c7585204e0dbac1d1` | **0 bloqueantes: H01 y H02 verificadas** | [ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos

| ID | Ubicación | Estado |
|---|---|---|
| PR452-H01 | `T-385.md`, `T-386.md`, filas del plan §8 | **Arreglado-verificado** — #448 ya mergeada; CC-034/035 se declaran mergeados, sin bloqueo falso |
| PR452-H02 | `T-376.md` / `T-380.md` / `T-383.md` y plan §8 | **Arreglado-verificado** — dependencias T-384/385/386 en ficha y plan, con gate `migrate-develop` |

El registro completo está en [hallazgos.jsonl](hallazgos.jsonl); [evidencia/comandos.md](evidencia/comandos.md) contiene el arnés reproducible y [lecciones.md](lecciones.md) las conclusiones.

## Decisiones ya tomadas

Lautaro073, 2026-10-20: **1-B** continuar con las tres fichas ahora; CC-033 ya mergeado, T-384 no depende de #448; T-385 y T-386 no se ejecutan hasta que CC-034 y CC-035 entren en develop desde #448. **2-A** T-376 depende de T-384, T-380 de T-385 y T-383 de T-386, tanto en fichas como en plan.

## Estado y limitaciones (ronda 2)

- `develop` incorporó la PR #448 por merge `d672f885125db006565b8e665383d1db043fb508`. H01 **cambia de condición válida**: requerir BLOQUEADA por #448 después del merge sería falso. Se verificó que CC-034 y CC-035 están presentes en develop y que T-385/T-386 y sus filas indican «mergeado», con «Bloqueo: ninguno». No se deshabilitaron controles para fingir verde.
- H02: T-376→T-384, T-380→T-385, T-383→T-386 están en las fichas y filas respectivas, y preservan el gate de implementación mergeada + `migrate-develop` antes de las UI.
- **Control real del tablero:** detectamos que #442 y #447 no tenían T-id en su título, por lo que `extractTaskId(issue.title)` las ignoraría. La revisión corrigió solamente los títulos externos de las issues: `[T-380] [QA]...` y `[T-383] [QA]...`. #435 ya identifica T-376. No se disparó el workflow, por lo que el estado de las tarjetas del tablero aún se debe confirmar con su siguiente sincronización normal.
- Revisión documental independiente por lectura de textos del SHA y funciones de verificación: **27/27 comprobaciones**, **10/10 mutaciones RED sobre controles** (en memoria), más contraste de los títulos de issues. No son tests SQL, E2E, ni Vitest.
- El autor reportó `verify-fichas 7/7` y `git diff --check` limpio. No se ejecutaron independientemente en un clon; sin acceso de red para clonar desde el entorno local, se usó el conector GitHub. No se exige `db-tests` ni E2E para este PR documental, ni nuevos checks verdes únicamente por este commit de revisión.
- GitHub compara HEAD contra develop: 4 commits delante / 0 detrás, PR `mergeable: true`. Se verificó el merge normal por los dos padres de `d51c5e73`. No se ejecutó `git merge-tree` en un clon.
- **SIN BLOQUEANTES DOCUMENTALES:** puede considerarse lista para que Lautaro073 cambie Draft/mergee según los requisitos de GitHub. La revisión no aprobó, no cambió Draft ni mergeó.
