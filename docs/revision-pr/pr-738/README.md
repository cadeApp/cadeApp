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
| Alcance actual | Ficha T-436, fila del plan y bitácora T-436; sin código de producción |
| Estado | **Ronda 2: 1 bloqueante nuevo H05**; H01–H04 verificados en lo documental. No aprobar / no mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `5dce13a4d632fbb32dd79c66a7907ca4693c82eb` | H01–H04 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |
| 2 | `865eb34622252153475097c4c05894fa62e971b2` | H01–H04 corregidos; H05 nuevo | [revisiones/ronda-2.md](revisiones/ronda-2.md) |

## Hallazgos

| ID | Tipo | Severidad | Estado |
|---|---|---|---|
| PR738-H01 | REST/Storage/Realtime desde el navegador en DoD | alto | arreglado-verificado (doc) |
| PR738-H02 | Altas/bajas de orígenes separadas | medio | arreglado-verificado (doc) |
| PR738-H03 | Host interceptado y control positivo para bypass | medio | arreglado-verificado (doc) |
| PR738-H04 | Evento CSP y espera de carga | medio | arreglado-verificado (doc) |
| **PR738-H05** | **BLOQUEANTE nuevo: e2e-mutation solo usa develop y faltan catálogo/alcance** | **alto** | **abierto** |

## Decisiones

**D1-C:** pasar a enforce en T-436 conservando temporalmente `'unsafe-inline'`, y hacer la CSP estricta en **otra tarea de prioridad alta: [#739](https://github.com/cadeApp/cadeApp/issues/739)**. No declarar mitigado el XSS inline. **D2-A:** sin endpoint. **D3-A:** solo cabecera enforce (sin Report-Only paralela). Las tres son **selecciones automáticas del agente con la opción recomendada**, **no** aprobación explícita personal de Lautaro073.

El autor actualizó ficha, bitácora, fila del plan y descripción de PR en `865eb346`; H01–H04 están comprobados a nivel **documental**. Queda H05: definir cómo versionar dos patches y su manifest, y el orden de comprobación **pre-merge vs post-merge** sin abrir el workflow a PR. Esta carpeta es exclusiva del revisor.

## Trazabilidad y comprobación

- [hallazgos.jsonl](hallazgos.jsonl)
- [evidencia/comandos.md](evidencia/comandos.md)
- [lecciones.md](lecciones.md)
- Ronda 2: inspección de fuentes exactas del SHA `865eb346` y guardas estáticas independientes de H01–H04; el selftest del guard pasó. **No hubo checkout de repo ni ejecución de Vitest/Playwright/CI**. No se declaran pruebas verdes propias de aplicación.
- Los commits de la revisión mueven el HEAD documental; `verificado_en_sha` de H01–H04 se refiere al SHA del autor, **no** a commits de la revisión. El autor debe hacer `git pull`; no pedir nuevo CI verde solo por documentación.
