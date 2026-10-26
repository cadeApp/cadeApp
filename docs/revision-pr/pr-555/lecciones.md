# Lecciones de la PR #555 — T-416

**Fuente:** tres hallazgos, de los cuales dos son bloqueantes de cierre y uno mejora. Ver [hallazgos.jsonl](hallazgos.jsonl).

## Aprendizaje principal

Una migración mayor puede conservar tests verdes sin fijar el caso de compatibilidad que **el propietario decidió modificar**. `PR555-H01` no afirma que Zod 4 acepte `+0300`; precisamente se acepta que lo rechace. La omisión es la ausencia de aserción negativa, lo que permitiría que un futuro refactor restaure silenciosamente el comportamiento viejo. Es la misma familia de `P08-control-no-cubre-lo-que-dice` y de `pr-64/AG-61`: no confundir presencia de pruebas con cobertura del invariante.

## Reutilizar lecciones existentes

- **`pr-64/AG-61`:** mutar el comportamiento exacto que el test promete detectar y comprobar el rojo atribuible a la aserción. Para H01: admitir `+0300` temporalmente (mutante) y exigir que el nuevo test caiga.
- **`pr-68/AG-75`:** la batería de mutación debe diseñarla y verificarla la revisión, no apropiarse de la del autor.
- **`pr-82/AG-92`:** el verde del job de budget no acredita cumplimiento; comparar cada valor y delta reales.
- **`pr-56/AG-37`:** ante un patrón, enumerar la clase entera. En esta ronda se recorrieron los validadores Zod afectados por el diff, sin observar otro cambio deliberado de formato que necesitara decisión de producto.

## Observabilidad de validación

Las dos pruebas E2E con retry del autor son señal de posible inestabilidad, no prueba de regresión de Zod. Cancelar el gate elimina la evidencia remota de ese SHA y deja `e2e-preview=error`. Conservar ambas observaciones separadas impide adjudicar un fallo inexistente a la migración.

## Alcance y límites

Los esquemas `z.array(...).min(1)` sin máximo explícito siguen mereciendo inventario y límites previos a parseo donde haya datos no confiables, especialmente por el aviso GHSA. Esto se aisló en issue #560. El aumento de bundle se aisló en issue #561.

No se asigna **AG nuevo** en esta ronda: no fue posible enumerar el máximo de todas las ramas remotas con `git fetch/git grep`. Tampoco se atribuyen pruebas ejecutadas al revisor cuando solo hay evidencia del autor/CI.

## Ronda 2 — cierre de los gates

El test ISO positivo y negativo ahora protege explícitamente D01=A. Un RED informado por el autor es evidencia útil pero no se debe convertir en «mutación independiente» sin ejecución propia. Por eso R2 registra por separado inspección de aserciones y CI remoto, con la limitación del harness no ejecutado.

El gate E2E debe acreditarse con el estado GitHub y las líneas exactas de Playwright del SHA funcional; no es necesario repetir el gate por un cambio exclusivo de bitácora. La mejora de bundle permanece separada de la corrección de la vulnerabilidad.

No se introduce AG nuevo sin enumeración global de ramas; sin nuevos patrones demostrados en R2.
