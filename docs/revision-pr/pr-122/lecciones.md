# Lecciones — PR #122 (T-205)

Ronda 1 no agrega número AG nuevo.

- **PR122-H01** refuerza `P08-control-no-cubre-lo-que-dice` y `AG-92`: en presupuestos cuantitativos importa el valor canónico medido, no que exista un test rojo ni el color del job.
- **PR122-H02** repite la lección de enumerar la clase completa antes de cerrar: un blacklist de clases sobre una sola pantalla permite que otros targets sub-48 sobrevivan y que la prueba quede verde.
- **PR122-H03** es una variante de `P15`: una ruta dentro de `node_modules/.pnpm` puede existir hoy pero no es una dependencia ni un contrato ejecutable del proyecto.
- **D01 = 1-A:** no se agregan dependencias nuevas solo para automatizar axe. La suite persistente protege regresiones concretas; la auditoría integral pertenece al navegador/Lighthouse exigido por el DoD. Si no se puede producir evidencia real, se declara pendiente en vez de sustituirla por una prueba de otro significado.
