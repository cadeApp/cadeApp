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
