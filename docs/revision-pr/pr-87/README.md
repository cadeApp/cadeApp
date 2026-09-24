# PR #87 — T-118 · Integración visual Stitch, shells y navegación canónica

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/87 |
| **Tarea** | T-118 |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-118-integracion-visual-stitch → develop |
| **SHA R3 revisado** | `6c321d01ad717bddc691a46c921303e092914d39` |
| **develop** | `b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121` |
| **Tamaño actual** | 92 archivos, +5038 / -789 |
| **Estado** | bloqueada |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | `027f39e` | 12 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | `225cd08` | 13 bloqueantes · 0 decisiones pendientes | [ronda-2.md](revisiones/ronda-2.md) |
| 3 | `6c321d0` | 8 bloqueantes | [ronda-3.md](revisiones/ronda-3.md) |

## Estado resumido después de R3

| Estado | IDs |
|---|---|
| Parciales/abiertos | H01, H09, H10, H16, H17, H18, R03, H19 |
| Arreglados-verificados | H02, H03, H04, H05, H06, H07, H08, H11, H12, R01, R02, H13, H14, H15 |
| Aceptados por decisión P1 | A01, A02 |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [evidencia/comandos.md](evidencia/comandos.md)

## Qué queda por hacer

1. Cerrar la clase completa de destinos internos: ningún post-login/href/redirect puede terminar en una ruta inexistente y el control debe matar una ruta arbitraria, no sólo cuatro strings conocidos.
2. Adjuntar al PR real las capturas side-by-side exigidas a 390 px y control 360 px.
3. Tratar `paid_until` como fecha civil `YYYY-MM-DD`, sin corrimiento por timezone.
4. Terminar C07: `Todas` sólo sobre historial terminal y cada fila con cadete + monto reales.
5. Corregir C02 para métricas acotadas/escalables y con día civil de Aguilares; Tarifa promedio debe respetar la semántica de “métricas del día”.
6. Recién sin bloqueantes: batería independiente + inspección de CI del SHA exacto.

## Nota de entorno

La revisión operó sobre el árbol remoto por GitHub API. No se atribuye verde independiente a typecheck/lint/test/build. Sí se ejecutaron probes locales aislados de JavaScript para reproducir las fallas de fecha civil y timezone. CI no se abrió con bloqueantes presentes.

## Decisiones de alcance vigentes

A01/A02 siguen aceptadas: Lautaro/P1 autorizó explícitamente los cambios compartidos en `src/ui/**` ya registrados y `src/features/requests/index.ts` para el barrel de History. No deben revertirse.
