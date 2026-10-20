# Lecciones de PR #448

**Alcance:** exclusivamente redacción de fichas QA y contratos, sin aplicación implementada. **No se asigna nuevo AG-xx**: no se verificó el máximo de todas las ramas remotas y un caso documental aislado no justifica reescribir `AGENTS.md`.

## Patrones concretos

- **P06-enumeracion-incompleta (H01):** cuando una tarea clasifica por dos ejes (estado de oferta × estado de solicitud), es obligatorio explicitar un destino para cada combinación relevante, incluyendo `null`.
- **P08-control-no-cubre-lo-que-dice (H02/H05):** «estado real por usuario» o «se actualiza al volver» son promesas comprobables. Las pruebas propuestas deben atacar un cambio de cuenta y una navegación interna sin focus, respectivamente; tests de indicadores aproximados no bastan.
- **P11-api-publica-inconsistente (H03):** el ejemplo de respuesta de una RPC debe incluir todos los valores que su propio camino idempotente emite.
- **P03-comentario-contradice-codigo (H04, adaptado al documento):** «mergeadas» es un estado objetivo, no una intención; antes de preparar fichas se consulta la PR dependiente.

## Protección para rondas futuras

Las fichas no se arreglan debilitando tests ni fabricando logs o GREEN. Cada control RED→GREEN que se exija después debe entrar por el camino real de ejecución, usar mocks solo en fronteras adecuadas y demostrar una mutación adversarial independiente. El autor nunca puede completar `verificado_en_sha`; esa comprobación corresponde a la revisión.

Si el patrón reaparece en otras PRs, considerar incorporar controles automatizados de dependencias reales y matrices de estados al proceso de creación de fichas. Mantener esta lección documental sin tocar reglas globales ahora.

## Ronda 2 — fallo del instrumento de revisión

**Error propio de esta revisión:** H02 no mutaba la propiedad que pretendía romper. Reemplazar una ruta por una versión con el sufijo `_REMOVED` y luego buscar con `includes(rutaOriginal)` es una mutación vacua. El autor la reportó sin tocar el harness; la revisión la corrigió y volvió a correr los cinco mutantes. No atribuir este error al autor ni abrir una ronda de trabajo de producto por él.

**Regla operacional:** una mutación negativa debe destruir el match semántico completo y probarse por separado. Cuando el control utiliza `includes`, el valor mutado **no** debe contener la cadena original ni como subcadena, no basta con concatenar un sufijo. En los informes, distinguir verificaciones documentales por texto de pruebas funcionales.

**Integración:** para mergear una PR documental con un plan compartido, conservar las filas nuevas de `develop` y las de la PR en una sola tabla; mirar estado `dirty` real antes de afirmar que es mergeable. La reconciliación se hizo sin rebase, force-push ni cambios de app.
