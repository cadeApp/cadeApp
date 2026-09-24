# PR #87 — T-118 · Integración visual Stitch, shells y navegación canónica

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/87 |
| **Tarea** | T-118 |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-118-integracion-visual-stitch → develop |
| **Base de la PR** | f695f20 |
| **SHA revisado** | 027f39e0ca5f010710142abc9d6ec5e189684ecf |
| **develop al revisar** | b6bdac6cfe4c5ac9227e87692b8572e1f6bc2121 |
| **Tamaño** | 44 archivos, +1742 / -176 |
| **Estado** | bloqueada |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | 027f39e | 12 bloqueantes | [revisiones/ronda-1.md](revisiones/ronda-1.md) |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---:|---|
| H01 | Destinos internos inexistentes (/admin, /terms, /privacy) | alto | abierto |
| H02 | C08 muestra piloto activo sin leer la suscripción real | alto | abierto |
| H03 | R08 inventa aprobación/verificaciones y defaults operativos | alto | abierto |
| H04 | C07 inventa distancia y zonas cuando faltan datos | alto | abierto |
| H05 | C07 carga todo el historial sin paginación | medio | abierto |
| H06 | Rutas canónicas con datos perdieron loading/error boundaries | alto | abierto |
| H07 | Piso tipográfico y objetivos táctiles incumplidos | medio | abierto |
| H08 | CSS/colores arbitrarios evitan el contract-change requerido | medio | abierto |
| H09 | route-integrity no cubre lo que declara | alto | abierto |
| H10 | Falta evidencia visual/browser obligatoria | alto | abierto |
| H11 | El cuerpo del PR no sigue la plantilla obligatoria | medio | abierto |
| H12 | La bitácora termina en un SHA inexistente en remoto | medio | abierto |

Datos estructurados: [hallazgos.jsonl](hallazgos.jsonl) · Evidencia: [evidencia/comandos.md](evidencia/comandos.md)

## Qué queda por hacer

1. Hacer git pull de esta ronda y mergear origin/develop sin rebase: la rama está 2 commits detrás y T-118 recibió la directiva visual obligatoria.
2. Resolver H01–H12 y demostrar los controles en rojo/verde.
3. H08 requiere contract-change separado para BrandLogo inverse/token compartido; T-118 no puede tocar src/ui.
4. Adjuntar comparativas Stitch/implementación a 390 px por familia y control 360 px, con evidencia de foco, teclado, contraste, loading/error y targets.
5. Recién sin bloqueantes, ejecutar checks locales completos y abrir CI por dentro.

## Nota de entorno

La revisión tuvo acceso al repositorio mediante el conector de GitHub, pero no a un checkout ejecutable: el runtime no pudo resolver GitHub por DNS. Por eso no se atribuye verde independiente a typecheck/lint/test/build. Conforme a la regla de revisión, tampoco se inspeccionó CI mientras hay bloqueantes. La evidencia de esta ronda es inspección del SHA remoto más controles y mutaciones independientes sobre su árbol.

## Para el análisis posterior

No se propone AG nueva: los fallos repiten AG-37, AG-58, AG-61, AG-36 y los patrones P08/P13/P19.
