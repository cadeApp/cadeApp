# PR #735 — T-435 · CC-051 / SEC-12: captura real de Realtime

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/735 |
| Tarea / issue | T-435 · SEC-12 #668 |
| Autor | @Lautaro073 (agy) |
| Rama | `feat/T-435-sec12-realtime-capture` → `develop` |
| Base revisada | `2cd76f246f9c7644e659e2ec4d0177802e0cde50` |
| Head revisado | `603fa9a0d6d9d930361b93282a88b6853bef6a5d` |
| Tamaño | 4 archivos, +281/−0 líneas; exclusivamente documentación |
| Estado | **Ronda 2 cerrada: 1 bloqueante residual (H05). Sin aprobación ni merge** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 · 2026-11-12 | `603fa9a0d6d9d930361b93282a88b6853bef6a5d` | **6 bloqueantes, 1 mejora** | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 · 2026-11-12 | `b48fe8be3a80f7e0a4d879602a7a192c7ddb2bd5` | **6 verificados; H05 parcial (1 bloqueante)** | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Estado por hallazgo

| ID | Síntesis | Severidad | Estado |
|---|---|---|---|
| H01 | INSERT obligatorio al courier incompatible con flujo draft→publicación | alto | arreglado-verificado |
| H02 | INSERT sin control positivo con marcador | alto | arreglado-verificado |
| H03 | Negativos sin ventana causal independiente | alto | arreglado-verificado |
| H04 | Árbol de cierre/fuga contradictorio | medio | arreglado-verificado |
| H05 | Positivo service_role imposible tras allowlist de publicación | alto | parcial |
| H06 | Rollback reabre exposición | alto | arreglado-verificado |
| H07 | Correlación y limpieza robustas | bajo · mejora | arreglado-verificado |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Reproducción: [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Decisiones cerradas

- **D1 (expresa de Lautaro073, 2026-11-12):** en Develop con usuarios E2E sembrados en el arnés; sin credenciales manuales.
- **D2-A (selección automática):** sin CHECK de null si no hay fuga; alternativa CC-023 §5 si se comprueba fuga.
- **D3-A (selección automática por autorización permanente, no decisión expresa de Lautaro073):** matriz por flujo real y evento; RPC de publicación con UPDATE al courier e inspección de INSERT adicional, INSERT de draft sintético posterior a suscripciones con merchant y service_role positivos y courier negativo; negativos con barrera/ventana y autorización independiente.

**No quedan decisiones abiertas** para esta ronda. Los hallazgos son correcciones técnicas de documentación antes de implementar.

## Qué sigue

El autor corrige solo CC-051, T-435, fila T-435 del plan y bitácora en la rama; no debe tocar `docs/revision-pr/**`. Tras su push corresponde ronda 2 independiente sobre el nuevo SHA. **No implementar todavía E2E ni migración en esta PR documental**.

## Alcance y limitaciones

Se comprobó mediante el conector GitHub el diff, la cabeza del PR, las fuentes de SQL y los antecedentes. GitHub informa base igual a `develop` y PR mergeable; **no se ejecutó `git merge-tree` ni `pnpm` local** por no disponer de clon de la repo en este entorno. CI del SHA revisado figuraba cancelado; mientras haya bloqueantes no se toma su color como certificación. **No se ejecutó E2E en Develop, no se corrió SQL ni se mutó esquema.** El detector estático y sus mutantes en memoria están detallados en evidencia.

