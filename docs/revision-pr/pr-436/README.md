# PR #436 — CC-033 / T-376 · Alta posterior de documentos opcionales

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/436 |
| Contrato | CC-033, issue #434 |
| Tarea futura | T-376, issue #435 |
| Autor | @Lautaro073 |
| Rama | `cc/CC-033-courier-optional-documents` → `develop` |
| Base de la ronda 2 | `54bbdcd7b079fa208e970725efa66832a8fac724` |
| SHA de autor revisado en ronda 2 | `79389ea830cc1c63636ffd06c35cefeafabdad6e` |
| Alcance | PR documental: contrato, ficha y fila del plan; carpeta de revisión escrita solo por el revisor |
| Estado de revisión | **SIN BLOQUEANTES DOCUMENTALES** (ronda 2), sin aprobación ni merge automático |

## Rondas

| Ronda | SHA de autor revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `639ea6dc74ad87a27fb533dfd460d21e72f7dcc8` | 3 bloqueantes documentales (H01–H03) | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `79389ea830cc1c63636ffd06c35cefeafabdad6e` | **0 bloqueantes. H01–H03 corregidos y comprobados por inspección documental independiente** | [ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Título resumido | Severidad original | Estado tras ronda 2 |
|---|---|---|---|
| PR436-H01 | Guard `vehicle_type IS NOT NULL` y elegibilidad bajo lock | alto | **arreglado-verificado** (documentación) |
| PR436-H02 | Concurrencia multisesión futura exigida | medio | **arreglado-verificado** (documentación) |
| PR436-H03 | Rollback UI antes de RPC | medio | **arreglado-verificado** (documentación) |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl). Evidencia y arnés: [evidencia/comandos.md](evidencia/comandos.md). Lecciones: [lecciones.md](lecciones.md).

## Alcance y limitaciones

- La ronda 2 contrastó exclusivamente los cambios del commit `79389ea830cc1c63636ffd06c35cefeafabdad6e` con la base de revisión anterior `6191721a`, que afectan solo `docs/contracts/CC-033.md`, `docs/tasks/T-376.md` y la **fila T-376** de `docs/implementation-plan.md`. No hubo escrituras del autor en `docs/revision-pr/pr-436/`.
- 16/16 aserciones de **estructura documental** pasaron en un verificador independiente ejecutado sobre los textos del SHA especificado, con contraste semántico por lectura. La verificación no prueba que una RPC futura funcione.
- El autor declaró `verify-fichas 7/7` y `git diff --check` limpio. El revisor no reprodujo esas dos ejecuciones en checkout local. No se exigieron ni ejecutaron E2E, DB tests ni Supabase/Docker local por esta PR únicamente documental.
- Al momento de la lectura, `develop` no había avanzado frente al ancestro de la PR (compare remoto: ahead 3, behind 0). No se verificó merge-tree local.
- La PR de implementación de CC-033 deberá ejecutar sus propias pruebas de RPC, seguridad e integración; T-376 permanece **bloqueada** hasta que esa implementación esté mergeada y aplicada en Develop, como marca su ficha.
- No se exige una nueva corrida de CI verde únicamente por agregar esta carpeta de revisión; cualquier requisito de rama propio de GitHub es independiente de la evaluación documental.

**Conclusión:** sin bloqueantes en la revisión independiente de documentación; Lautaro073 decide si marca Ready y mergea, sujeto a los gates que establezca el repositorio.
