# Lecciones — PR #122 (T-205)

La revisión descartada original sigue fuera de vigencia. Esta actualización corresponde a la **Ronda 6, corrección del reviewer**.

## Lecciones válidas

- **H01 / P06:** una pasada visual exige enumerar la clase completa.
- **H02 / P08:** un control debe observar la propiedad real, no un proxy.
- **H03 / P03:** no cerrar criterios runtime sin evidencia reproducible.
- **R01 / P10:** no reescribir el DoD para acomodar una limitación operativa.
- **R02 / P03:** las reglas de AGENTS también cuentan aunque ESLint no las imponga.
- **R03 / P08:** `scrollWidth` no demuestra por sí solo ausencia de clipping.

## Corrección de proceso del reviewer

El reviewer incumplió una regla expresa del prompt obligatorio al pedir en Ronda 4 que se versionara un harness de browser dentro de la rama.

La regla correcta era:

- **no crear archivos nuevos** en el prompt de arreglo;
- **scripts auxiliares en `/tmp`**.

Por eso las exigencias posteriores sobre ese harness (`R04–R07`) no deben considerarse hallazgos vigentes ni generar otra ronda de trabajo para el autor.

Regla reforzada para futuras revisiones:

1. cualquier harness de mutación/reproducción pertenece al reviewer;
2. se guarda completo en `docs/revision-pr/.../evidencia/comandos.md`;
3. cuando haya que ejecutarlo, se copia a `/tmp`;
4. no se modifica la API de producción ni se agregan scripts al PR solo para facilitar la revisión;
5. si el reviewer da una instrucción incompatible con el protocolo, debe corregirla explícitamente y retirar los hallazgos derivados.
