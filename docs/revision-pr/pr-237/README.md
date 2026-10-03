# PR #237 — T-325 · Unificar carga visual de licencia y seguro con documentos de identidad

| | |
|---|---|
| **PR** | https://github.com/cadeApp/cadeApp/pull/237 |
| **Tarea** | T-325 (Fase 3 · Calidad, operación y salida) |
| **Autor** | @Lautaro073 |
| **Rama** | feat/T-325-unified-document-upload → develop |
| **Base** | e39569b59fa8203df9893dbb824cbc4a317d4181 |
| **Tamaño** | 6 archivos, +480 / -188 líneas |
| **Estado** | abierta · Draft · bloqueada en Ronda 1 |

## Rondas

| Ronda | SHA revisado | Hallazgos | Informe |
|---|---|---|---|
| 1 | 7d65e8649302a788a8f9c2cdbf28d72295f6666d | 3 bloqueantes | revisiones/ronda-1.md |

## Estado por hallazgo

| ID | Título | Sev. | Estado |
|---|---|---|---|
| PR237-H01 | Un reemplazo fallido borra la ruta opcional ya cargada | alto | abierto |
| PR237-H02 | El control de archivo no muestra foco visible de teclado | medio | abierto |
| PR237-H03 | Falta la evidencia visual y de accesibilidad obligatoria | alto | abierto |

Datos estructurados: hallazgos.jsonl · Comandos: evidencia/comandos.md

## Qué queda por hacer

1. Preservar el último storagePath exitoso si un reemplazo de licencia/seguro falla y cubrir licencia/seguro × fallo de compresión/subida.
2. Dar foco visible a la tarjeta compartida cuando el input file sr-only recibe foco.
3. Completar navegador real, capturas 390/360 y revisión de Diseño, Frontend y Persona.
4. Revalidar un nuevo SHA; recién entonces auditar CI detallado.

## Para el análisis posterior

No se propone AG nueva. H01 aplica AG-37/P06; H02 ya está cubierta por P13 y la directiva visual; H03 incumple un entregable ya explícitamente exigido.
