# Lecciones — PR #582, ronda 1 (T-400)

No se asignan números AG nuevos: los dos hallazgos son aplicaciones de principios ya conocidos y no hay verificación runtime independiente en este entorno.

- **H01 / literalidad probatoria:** un helper genérico de texto que hace `.trim()` es correcto para nombres visibles pero no para copiar un campo de auditoría «completo». Separar display normalizado de copia literal en la misma frontera del servidor. El control debe incluir espacios y saltos en ambos extremos, no solo dentro.
- **H02 / P08 y AG-58:** con dominios dinámicos, el catálogo no se vuelve exhaustivo por escribir una lista y comprobar que cada elemento sigue presente en algún lugar del SQL. Exigir conjuntos en dos direcciones y relacionar cada uso dinámico con su archivo/función. La mutación que agrega un valor nuevo es el caso que más importa: la clase nueva no puede quedar invisible.

**Limitación:** estas lecciones son hallazgos por inspección y mutación textual en memoria, no resultados de RED→GREEN del Vitest completo. No modificar `AGENTS.md` todavía.
