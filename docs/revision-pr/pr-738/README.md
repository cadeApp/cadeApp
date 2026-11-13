# PR #738 — T-436 · CSP completa a enforce (ficha documental)

| Campo | Valor |
|---|---|
| PR | https://github.com/cadeApp/cadeApp/pull/738 |
| Issue | #669; deuda CSP estricta: #739 (urgencia alta) |
| Autor | @Lautaro073 |
| Rama | `feat/T-436-csp-enforce` → `develop` |
| Base | `3c4d26b6f34bc7a909b328bddcbd37f4fc0993bc` |
| Head de **contenido revisado** | `5dce13a4d632fbb32dd79c66a7907ca4693c82eb` |
| Alcance | 2 archivos documentales: `docs/tasks/T-436.md` (nuevo) y fila T-436 del plan |
| Estado | **Ronda 1 con 2 bloqueantes + 2 mejoras a tomar**. No aprobar / no mergear |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | `5dce13a4d632fbb32dd79c66a7907ca4693c82eb` | H01–H04 | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Hallazgos

| ID | Tipo | Severidad | Estado |
|---|---|---|---|
| PR738-H01 | BLOQUEANTE — REST/Storage/Realtime sin prueba browser real | alto | abierto |
| PR738-H02 | BLOQUEANTE — retiro de orígenes sin evidencia válida | medio | abierto |
| PR738-H03 | MEJORA acordada — negativo CSP confundible con DNS/CORS | medio | abierto |
| PR738-H04 | MEJORA acordada — cobertura de eventos/tiempos CSP | medio | abierto |

## Decisiones

**D1-C:** pasar a enforce en T-436 conservando temporalmente `'unsafe-inline'`, y hacer la CSP estricta en **otra tarea de prioridad alta: [#739](https://github.com/cadeApp/cadeApp/issues/739)**. No declarar mitigado el XSS inline. **D2-A:** sin endpoint. **D3-A:** solo cabecera enforce (sin Report-Only paralela). Las tres son **selecciones automáticas del agente con la opción recomendada**, **no** aprobación explícita personal de Lautaro073.

La ficha y la bitácora de T-436, junto con el cuerpo de la PR, deben actualizarse **por el autor** siguiendo el prompt de cierre. Esta carpeta es exclusiva de la revisión.

## Trazabilidad y comprobación

- [hallazgos.jsonl](hallazgos.jsonl)
- [evidencia/comandos.md](evidencia/comandos.md)
- [lecciones.md](lecciones.md)
- La inspección se hizo mediante GitHub a las fuentes del SHA citado; **no hubo checkout local ni ejecución de Vitest/Playwright/CI**. No se declaran pruebas verdes propias.
- El commit que incorpora este informe mueve el HEAD documental, pero **los hallazgos refieren al SHA anterior**. El autor debe hacer `git pull`; no pedir nuevo CI verde solo por esta carpeta de revisión.
