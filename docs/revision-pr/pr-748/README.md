# PR #748 — T-438 / CC-053 · Suspensión con viajes activos

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/748 |
| Tarea / contrato | T-438 / CC-053, issue #671 (B-06) |
| Autor | @Lautaro073 |
| Rama | `cc/CC-053-suspension-active-trips` → `develop` |
| Base revisada | `4c85b8da207f9ac7f3ae53234f7a2bab55aa8e1a` |
| HEAD revisado | `93b34c056d039e0ec66785fb5d82221e5f566898` |
| Cambios del autor | 4 archivos, +367/-1; exclusivamente docs |
| Estado ronda 1 | **CON BLOQUEANTES**: 8; MEJORAS: 1 |
| Decisiones | D1-A y D2-A: Lautaro073, 2026-11-13. D3-C: Lautaro073, 2026-11-15; autorizó modificar CC-032 1-A. |
| CI de HEAD | `43660925817` cancelado; no se considera verde ni rojo |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `93b34c056d039e0ec66785fb5d82221e5f566898` | 8 bloqueantes, 1 mejora; 9 abiertos | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Tipo | Resumen | Estado |
|---|---|---|---|
| PR748-H01 | BLOQUEANTE | Nombre incorrecto de decisión en admin_resolve_incident | Abierto |
| PR748-H02 | BLOQUEANTE | Falta contrato SQL detallado del historial ampliado | Abierto |
| PR748-H03 | BLOQUEANTE | Acción pública filtra la suspensión; D3-C exige código neutro | Abierto |
| PR748-H04 | BLOQUEANTE | La ficha omite archivos/suites existentes indispensables | Abierto |
| PR748-H05 | BLOQUEANTE | Ocho funciones de locks, nueve redefiniciones funcionales | Abierto |
| PR748-H06 | BLOQUEANTE | Rollout viejo lector / nuevo esquema incompatible | Abierto |
| PR748-H07 | BLOQUEANTE | Enmienda de CC-032 1-A autorizada pero todavía no registrada | Abierto (decisión ya tomada) |
| PR748-H08 | MEJORA | 40P01 mapea a INTERNAL_ERROR, no DATABASE_ERROR | Abierto |
| PR748-H09 | BLOQUEANTE | Efectos completos D1-A / control RED insuficientemente enumerados | Abierto |

**Datos:** [hallazgos.jsonl](hallazgos.jsonl) · **Reproducción:** [evidencia/comandos.md](evidencia/comandos.md) · **Lecciones:** [lecciones.md](lecciones.md).

## Próximos pasos

1. El autor hace `git pull` y modifica únicamente los cinco archivos documentales autorizados en el prompt publicado en la PR, más la bitácora si corresponde. **Nunca** modifica `docs/revision-pr/pr-748/**`.
2. Actualiza CC-053 a D3-C (15/11/2026), enmienda CC-032 decisión 1-A con referencia a CC-053 y reconcilia plan, ficha, DoD y archivos permitidos.
3. Aporta sesión de bitácora, commit, push y SHA remoto. La revisión independiente abre **ronda 2**, no sobrescribe ronda 1, y verifica de nuevo.
4. La PR documental no se mergea hasta cerrar los bloqueantes. La implementación de T-438 se inicia después del merge del CC; los pgTAP, concurrencia y E2E pertenecen a esa implementación.

## Límites

No se corrió Supabase, Docker, pgTAP ni un E2E. Las constataciones son **inspección estática de GitHub sobre SHAs citados**, no resultados de ejecución. La metadata de GitHub indica mergeable=true y avance 1/0 respecto de la base; no se ejecutó `git merge-tree` local por ausencia de clon/red Git en el entorno de revisión. No se aprobaron ni mergearon ramas.
