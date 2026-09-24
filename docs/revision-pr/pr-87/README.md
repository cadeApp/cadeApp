# PR #87 — T-118 · Integración visual Stitch, shells y navegación canónica

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/87 |
| **Tarea** | T-118 |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-118-integracion-visual-stitch → develop |
| **SHA R2 revisado** | \`225cd08f63d92dbaa9e6c5371b54c9ffa0c82e78\` |
| **develop** | \`b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121\` |
| **Tamaño actual** | 87 archivos, +3750 / -698 |
| **Estado** | bloqueada |

## Rondas

| Ronda | SHA revisado | Resultado | Informe |
|---|---|---|---|
| 1 | \`027f39e\` | 12 bloqueantes | [ronda-1.md](revisiones/ronda-1.md) |
| 2 | \`225cd08\` | 15 bloqueantes + 1 decisión | [ronda-2.md](revisiones/ronda-2.md) |

## Estado resumido

| ID | Estado R2 |
|---|---|
| H01 | parcial |
| H02 | parcial |
| H03 | parcial |
| H04 | arreglado-verificado |
| H05 | arreglado-verificado (regresiones R01/R02 separadas) |
| H06 | parcial |
| H07 | parcial |
| H08 | arreglado-verificado |
| H09 | parcial |
| H10 | abierto |
| H11 | abierto |
| H12 | arreglado-verificado |
| A01 | aceptado por decisión P1 |
| A02 | aceptado por decisión P1 |
| R01 | abierto |
| R02 | abierto |
| H13 | abierto |
| H14 | abierto |
| H15 | abierto |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [evidencia/comandos.md](evidencia/comandos.md)

## Qué queda por hacer

1. Resolver los bloqueantes de R2 sin tocar la carpeta de revisión.
2. Sacar \`src/ui/**\` de T-118 o completar CC separado antes.
3. Resolver 🔵 A02 para el barrel de requests.
4. Corregir contratos C08/R08, errores alcanzables, C07 filtro+paginación y C02.
5. Adjuntar evidencia visual real 390/360 y actualizar el body real del PR.
6. Sólo después, correr batería independiente + CI.

## Nota de entorno

Como en R1, esta revisión operó sobre el árbol remoto por GitHub API y no dispone de checkout ejecutable. No se atribuye verde independiente a typecheck/lint/test/build y no se abrió CI con bloqueantes presentes.


## Corrección de alcance de R2

Lautaro/P1 confirmó que los cambios visuales compartidos en `src/ui/**` y el barrel de History en `src/features/requests/index.ts` fueron pedidos/autorizados por él durante la implementación. No se consideran desvíos del agente. A01/A02 quedan aceptados y H08 cerrado. El resultado vigente de R2 es **13 bloqueantes y ninguna decisión pendiente**.
