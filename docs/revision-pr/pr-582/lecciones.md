# Lecciones — PR #582, ronda 1 (T-400)

No se asignan números AG nuevos: los dos hallazgos son aplicaciones de principios ya conocidos y no hay verificación runtime independiente en este entorno.

- **H01 / literalidad probatoria:** un helper genérico de texto que hace `.trim()` es correcto para nombres visibles pero no para copiar un campo de auditoría «completo». Separar display normalizado de copia literal en la misma frontera del servidor. El control debe incluir espacios y saltos en ambos extremos, no solo dentro.
- **H02 / P08 y AG-58:** con dominios dinámicos, el catálogo no se vuelve exhaustivo por escribir una lista y comprobar que cada elemento sigue presente en algún lugar del SQL. Exigir conjuntos en dos direcciones y relacionar cada uso dinámico con su archivo/función. La mutación que agrega un valor nuevo es el caso que más importa: la clase nueva no puede quedar invisible.

**Limitación:** estas lecciones son hallazgos por inspección y mutación textual en memoria, no resultados de RED→GREEN del Vitest completo. No modificar `AGENTS.md` todavía.

## Ronda 2 — H03 · Refuerzo de pr-62/AG-60 y pr-68/AG-75

La batería del autor había mutado `return` a `perform` y el test cayó. Eso mide solo desaparición de la palabra. La revisión añadió tres mutaciones independientes que **preservan el token `return` como texto inerte** (comentario `--`, comentario `/* */`, string de `raise notice`); el nuevo guard sigue devolviendo verdadero. Una regex que reconoce una palabra no verifica una sentencia SQL ejecutable. Antes de confiar en un control textual, separar SQL real de comentarios y cadenas; agregar mutaciones que prueben los límites de tokenización, no solo borrar tokens. No se asigna AG nuevo: reitera AG-60 (instrumentos) y AG-75 (baterías independientes).

## Ronda 3 — PR582-H04 (P08 / pr-68/AG-75)

La batería nueva del autor neutraliza `return` en comentarios comunes y literales, pero el revisor demostró dos subclases adicionales de falsos positivos del mismo guard: `RETURN` dentro de un `IF false` (token ejecutable pero **no salida incondicional**) y `return` oculto dentro de un comentario de bloque **anidado** que el escáner corta en el primer `*/`. El control sigue GREEN bajo mutaciones donde `report_incident` puede alcanzar `audit_log`. Un test de alcanzabilidad no debe confundirse con búsqueda de tokens. Una guarda de exclusión crítica tiene que fallar cerrado si no reconoce un cambio en la estructura de control; los comentarios deben tratarse según la gramática PostgreSQL real (incluida anidación). No se asigna AG nuevo para este único PR.
