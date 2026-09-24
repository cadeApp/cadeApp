# Lecciones de la PR #87 para AGENTS.md y las reglas

**Fuente:** 12 hallazgos de R1 + 7 registros nuevos en R2.

## Patrón dominante

R2 confirma el patrón de R1: controles basados en presencia de archivos/strings pueden quedar verdes mientras el comportamiento real contradice contratos. Los ejemplos más fuertes son enums de DB incompatibles, error boundaries que existen pero nunca reciben el error, y un footer fuera del array auditado que conserva enlaces rotos y text-xs.

El segundo patrón es de coordinación: un arreglo que necesitaba contrato UI ignoró el freno de contract-change y modificó directamente \`src/ui/**\`.

## Lecciones propuestas

No hace falta inventar una AG nueva todavía; refuerzan reglas existentes:
- AG-37 / P06: enumerar la clase completa, no una lista de ejemplos.
- AG-58 / AG-61 / P08: el test debe ejercer el contrato real, no buscar strings.
- AG-36: evidencia sólo desde SHA publicado.
- P10: si la ficha y una decisión posterior del dueño divergen, registrar la excepción en ficha/bitácora/PR para que la revisión pueda distinguir una autorización real de una autoampliación.

## Qué cambiar, en orden de impacto

1. Agregar un control de alcance por ficha (globs permitidos) y un lugar explícito para excepciones autorizadas por el dueño antes de declarar DoD.
2. Para queries nuevas, testear enums/tipos contra el contrato real y fallos de Supabase, no sólo source matching.
3. Toda paginación nueva debe traer prueba 51+/segunda página/filtro+cursor y verificar que no altera consumidores compartidos.
4. La evidencia visual debe existir en el PR real; un archivo Markdown local no sustituye body/capturas.

## Advertencias

- A01/A02 fueron resueltos por decisión explícita de P1; la lección es documentar esa excepción, no revertirla ni reemplazarla con deep imports.
- H15 sugiere que la evidencia “typecheck verde” del autor no puede tomarse como independiente hasta reejecutarla.
