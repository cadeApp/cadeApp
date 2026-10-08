# Lecciones — PR #305 / T-350

**Fuente:** tres hallazgos de especificación (`H01`, `H02`, `H03`) en la ronda 1. No se introduce un identificador `AG-xx` nuevo: dos casos son variantes de `P08 / AG-37` (el control debe cubrir todas las instancias y el estado real) y otro de `P15`.

## Patrón observado

Un DoD documental puede prometer accesibilidad en una ruta compartida por roles y un GREEN de axe, pero **el test debe visitar cada rol** y **verificar que la superficie vulnerada se renderizó**. Un error del SDK puede esconder el nodo y conseguir un falso GREEN. A su vez, cuando un spec aún está en otra rama, la receta de integración debe describir exactamente la procedencia de sus dependencias.

## Qué reutilizar en tareas futuras

1. Toda auditoría cross-role enumera precondiciones reales por rol, sin inferir cobertura de un único path.
2. Ante componentes con fallback, el test feliz debe demostrar explícitamente el camino principal; el fallback se prueba aparte.
3. Un E2E de validación combinado con una PR no mergeada debe integrar **spec y dependencias completas**, sin tocar la PR real.
4. La batería de mutaciones de quien revisa debe probar rol equivocado, ausencia de dependencia y SDK en fallback; los tests no se maquillan para verde.

No tocar `AGENTS.md` por un único caso documental. Validar la cobertura propuesta en la PR posterior de implementación.

## Ronda 2 — corrección de una falla del revisor

La primera versión del harness de la ronda 1 tenía un selector que buscaba requisitos en un segmento equivocado y dependía de un archivo de otra rama. Su salida esperada era incorrecta para T-350. Al depurarlo, un chequeo `includes('Repartidor asignado')` ignoraba que la frase podía seguir en una explicación sin existir la aserción positiva. Es un caso de **AG-60** sobre los scripts propios: una prueba de documentación debe apuntar al **locator concreto**, no a un texto mencionado en comentarios. El nuevo verificador de ronda 2 validó las tres propiedades escritas y mató 11/11 mutaciones en memoria. No atribuimos este error al autor.
