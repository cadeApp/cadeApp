# PR #735 — T-435 · CC-051 / SEC-12: captura real de Realtime

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/735 |
| Tarea / issue | T-435 · SEC-12 #668 |
| Autor | @Lautaro073 (agy) |
| Rama | `feat/T-435-sec12-realtime-capture` → `develop` |
| Base revisada | `2cd76f246f9c7644e659e2ec4d0177802e0cde50` |
| Head revisado | `ab697f5dded24c2c966d2bf77837f6bae14776ea` |
| Tamaño | PR documental: CC-051, ficha T-435, plan §8 y bitácora; más histórico del revisor |
| Estado | **Ronda 3 cerrada: SIN BLOQUEANTES (7/7 verificados documentalmente), CI del SHA revisado en verde. Sin aprobación ni merge** |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 · 2026-11-12 | `603fa9a0d6d9d930361b93282a88b6853bef6a5d` | **6 bloqueantes, 1 mejora** | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 · 2026-11-12 | `b48fe8be3a80f7e0a4d879602a7a192c7ddb2bd5` | **6 verificados; H05 parcial (1 bloqueante)** | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 · 2026-11-12 | `ab697f5dded24c2c966d2bf77837f6bae14776ea` | **SIN BLOQUEANTES; 7/7 verificados** | [revisiones/ronda-3.md](revisiones/ronda-3.md) |

## Estado por hallazgo

| ID | Síntesis | Severidad | Estado |
|---|---|---|---|
| H01 | INSERT obligatorio al courier incompatible con flujo draft→publicación | alto | arreglado-verificado |
| H02 | INSERT sin control positivo con marcador | alto | arreglado-verificado |
| H03 | Negativos sin ventana causal independiente | alto | arreglado-verificado |
| H04 | Árbol de cierre/fuga contradictorio | medio | arreglado-verificado |
| H05 | Positivo service_role imposible tras allowlist de publicación | alto | arreglado-verificado |
| H06 | Rollback reabre exposición | alto | arreglado-verificado |
| H07 | Correlación y limpieza robustas | bajo · mejora | arreglado-verificado |

Datos: [hallazgos.jsonl](hallazgos.jsonl) · Reproducción: [evidencia/comandos.md](evidencia/comandos.md) · [lecciones.md](lecciones.md).

## Decisiones cerradas

- **D1 (expresa de Lautaro073, 2026-11-12):** en Develop con usuarios E2E sembrados en el arnés; sin credenciales manuales.
- **D2-A (selección automática):** sin CHECK de null si no hay fuga; alternativa CC-023 §5 si se comprueba fuga.
- **D3-A (selección automática por autorización permanente, no decisión expresa de Lautaro073):** matriz por flujo real y evento; RPC de publicación con UPDATE al courier e inspección de INSERT adicional, INSERT de draft sintético posterior a suscripciones con merchant y service_role positivos y courier negativo; negativos con barrera/ventana y autorización independiente.

**No quedan decisiones abiertas** para esta ronda. Los hallazgos son correcciones técnicas de documentación antes de implementar.

## Qué sigue

**La revisión independiente de esta PR documental quedó cerrada sin bloqueantes.** Lautaro073 conserva la decisión humana de mergear; **el revisor no aprobó ni mergeó**. La implementación de `e2e/specs/courier-private-columns.spec.ts` y cualquier alternativa de publicación/migración ocurrirá en **otra PR después del merge de CC-051** bajo `e2e-preview` autorizado, según D1/D2-A/D3-A. Ninguna captura nueva fue ejecutada aquí.

La revisión agregó un commit en esta rama: ejecutar `git pull` antes de cualquier acción, sin rebase/force/amend. **No exigir un nuevo CI green únicamente por el commit documental de revisión o la bitácora:** el run CI [43256758218](https://github.com/cadeApp/cadeApp/actions/runs/43256758218) del SHA **`ab697f5dded24c2c966d2bf77837f6bae14776ea`** finalizó success y fue leído por dentro (unit 209 archivos/3961 tests; db pgTAP 47 archivos/3958 tests PASS; typecheck, lint, build y demás jobs green). El chequeo global `format:check` es advisory y avisó sobre 355 archivos ajenos al diff de corrección.

## Alcance y limitaciones

Revisión semántica y de mutaciones **documentales** usando contenido GitHub del SHA revisado. GitHub indica mergeable=true y develop en `2cd76f24`; no se ejecutó `git merge-tree` en clon local, ni `node docs/revision-pr/analizar.mjs verificacion` (no hay clon disponible en contenedor). La integridad de los 7 registros JSONL se validó en memoria. No se ejecutó `pnpm` local ni E2E en Develop, ni Docker, ni SQL remoto, ni se consultaron secretos. Los `123/123` tools anotados en la bitácora son dato declarado por el autor, no ejecución independiente. El CI del SHA del autor prueba la integración existente, **no** la captura que recién se implementará en una PR posterior.
