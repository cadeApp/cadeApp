# PR #738 — T-436 · CSP completa a enforce (ficha documental)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/738 |
| Issue | #669; deuda CSP estricta: #739 (urgencia alta) |
| Autor | @Lautaro073 |
| Rama | `feat/T-436-csp-enforce` → `develop` |
| Base | `3c4d26b6f34bc7a909b328bddcbd37f4fc0993bc` |
| SHA ronda 1 | `5dce13a4d632fbb32dd79c66a7907ca4693c82eb` |
| SHA ronda 2 | `865eb34622252153475097c4c05894fa62e971b2` |
| SHA ronda 3 | `3d890c1526e44e09acc93fbe78d90bd6053ed3d1` |
| Alcance actual | Ficha T-436, fila del plan y bitácora T-436; sin código de producción |
| Estado | **Ronda 3: SIN BLOQUEANTES documentales.** H01–H05 corregidos y verificados por inspección de ficha. No aprobar / no mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `5dce13a4d632fbb32dd79c66a7907ca4693c82eb` | H01–H04 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `865eb34622252153475097c4c05894fa62e971b2` | H01–H04 corregidos; H05 nuevo | [revisiones/ronda-2.md](revisiones/ronda-2.md) |
| 3 | `3d890c1526e44e09acc93fbe78d90bd6053ed3d1` | H05 corregido; sin bloqueantes documentales | [revisiones/ronda-3.md](revisiones/ronda-3.md) |

## Hallazgos

| ID | Tipo | Severidad | Estado |
|---|---|---|---|
| PR738-H01 | REST/Storage/Realtime desde el navegador en DoD | alto | arreglado-verificado (doc) |
| PR738-H02 | Altas/bajas de orígenes separadas | medio | arreglado-verificado (doc) |
| PR738-H03 | Host interceptado y control positivo para bypass | medio | arreglado-verificado (doc) |
| PR738-H04 | Evento CSP y espera de carga | medio | arreglado-verificado (doc) |
| **PR738-H05** | Catálogo autorizado y e2e-mutation solo sobre develop post-merge | **alto** | **arreglado-verificado (doc, R3)** |

## Decisiones

**D1-C:** pasar a enforce en T-436 conservando temporalmente `'unsafe-inline'`, y hacer la CSP estricta en **otra tarea de prioridad alta: [#739](https://github.com/cadeApp/cadeApp/issues/739)**. No declarar mitigado el XSS inline. **D2-A:** sin endpoint. **D3-A:** solo cabecera enforce (sin Report-Only paralela). **D4-A:** dos patches de `connect-src` y `manifest.json` en la implementación; `RED_CONFIRMED` únicamente sobre develop después del merge. Las cuatro decisiones están registradas como **selección automática del agente con la opción recomendada**, **sin** aprobación explícita personal de Lautaro073.

El autor completó la corrección de H05 en `3d890c15`: catálogo autorizado y gates pre/post-merge separados sin abrir el workflow a PR. **SIN BLOQUEANTES documentales** por inspección independiente. Observación editorial no bloqueante: `T-436.md:39` conserva «Las tres» pese a que ahora hay cuatro decisiones; D4-A consta en bitácora y PR. Esta carpeta es exclusiva del revisor.

## Trazabilidad y comprobación

- [hallazgos.jsonl](hallazgos.jsonl)
- [evidencia/comandos.md](evidencia/comandos.md)
- [lecciones.md](lecciones.md)
- Ronda 2: inspección de fuentes exactas del SHA `865eb346` y guardas estáticas de H01–H04; ronda 3: inspección `3d890c15`, catálogo/gates DoD, igualdad ficha–plan y mutaciones documentales independientes. **No hubo checkout de repo ni ejecución de Vitest/Playwright/CI** por este revisor; CI de `3d890c15` estaba `in_progress` al consultarlo. No se declaran pruebas verdes de aplicación propias.
- Los commits de revisión mueven el HEAD documental; `verificado_en_sha` refleja el SHA del autor (H01–H04 en R2, H05 en R3), no los commits del revisor. El autor hace `git pull` antes de cambios futuros; no se exige nuevo CI exclusivamente por documentación.
