# PR #87 — T-118 · Integración visual Stitch, shells y navegación canónica

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/87 |
| **Tarea** | T-118 |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-118-integracion-visual-stitch → develop |
| **SHA R4 revisado** | `cf6fa22299b4df28982b0babb0ba7bc0aa146526` |
| **develop** | `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121` |
| **Tamaño actual** | 94 archivos, +5911 / -797 |
| **Estado** | bloqueada |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `027f39e` | 12 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `225cd08` | 13 bloqueantes · 0 decisiones pendientes | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `6c321d0` | 8 bloqueantes | [ronda-3.md](revisiones/ronda-3.md) |
| 4 | `cf6fa22` | 4 bloqueantes | [ronda-4.md](revisiones/ronda-4.md) |

## Estado resumido después de R4

| Estado | IDs |
|---|---|
| Parciales/abiertos | H09, H10, R04, H20 |
| Arreglados-verificados | H01–H08, H11–H19, R01–R03 |
| Aceptados por decisión P1 | A01, A02 |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [evidencia/comandos.md](evidencia/comandos.md)

## Qué queda por hacer

1. H09: hacer que el control de rutas detecte también template literals/destinos dinámicos reales, con mutación del prefijo.
2. H10: completar C05, R02 y R05; corregir P04 legal ≠ forgot-password y documentar reduced-motion.
3. R04: conservar lotes <=50 sin techo global de 500/50; métricas exactas para 501 solicitudes y 51+ ofertas aceptadas.
4. H20: C02 debe filtrar estados activos en DB antes de paginar/renderizar.
5. Recién con cero bloqueantes: batería independiente + inspección de CI del SHA exacto.

## Nota de entorno

La revisión operó sobre el árbol remoto por GitHub API. No se atribuye verde independiente a typecheck/lint/test/build. Se ejecutaron probes locales aislados de Node para H09 y R04. CI no se abrió con bloqueantes presentes.

## Decisiones de alcance vigentes

A01/A02 siguen aceptadas por decisión explícita de Lautaro/P1.
