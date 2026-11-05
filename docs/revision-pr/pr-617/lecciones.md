# Lecciones — PR #617 / T-407

**Fuente:** H01 y H02, ambos por inspección. No se ejecutaron mutaciones del revisor.

## Patrón

- **H01, P06:** enumerar estados reales de una RPC, no inferir el resultado positivo a partir del verbo del nombre. La función `admin_resolve_incident` también puede desestimar. Refuerza `pr-56/AG-37`.
- **H02, P08:** probar los estados límite de la navegación: una página vacía sin cursor no reemplaza al caso con cursor obsoleto. El control debe fallar si desaparece el fallback. Refuerza `pr-82/AG-76`.
- **Proceso:** las mutaciones que registra el autor no sustituyen una batería independiente del revisor; ver `pr-68/AG-75`.

## Acciones

1. Añadir matriz `resolved/dismissed/ausente`, mutar la rama específica.
2. Añadir caso de cursor vacío con todos los filtros preservados; mutar la guarda.
3. Repetir los tests del autor y cotejar CI/E2E tras arreglar bloqueantes.

No se crea un número `AG-xx` nuevo en esta ronda, porque los patrones refuerzan lecciones existentes; la numeración global remota se exige solo para lecciones nuevas.

## Ronda 2 — verificación y omisión descubierta

- H01 refuerza `pr-56/AG-37`: para clasificar una acción enumerar sus estados de dominio, no inferirlos de su nombre.
- H02 refuerza `pr-82/AG-76`: un control debe cubrir página sin filas **y con cursor**, distinto del vacío inicial; reutilizar serializador de URL evita perder filtros.
- H03 es una omisión previa de la propia revisión: el mapa de valores A06 no incluye estados de incidentes que sí están traducidos en A05. Para auditar una interfaz, enumerar no solo las variantes de color sino también los textos de cada transición.
- La batería en Code Mode ejecutó los cuerpos reales de funciones recuperadas por GitHub pero no sustituye un Vitest/React/E2E completo. Los RED informados por el autor se mantienen separados.

No se asignan números AG nuevos: los patrones refuerzan reglas existentes y las ramas paralelas pueden colisionar.

## Ronda 3 — H03 solucionado

- Los estados administrativos de A06 se agregaron con los **mismos cuatro textos** que A05. La batería aislada de revisión tuvo 4/4 casos correctos y detectó tres mutaciones en memoria, incluidas una de localización y otra por clave omitida.
- El test nuevo del autor cubre dos transiciones diferentes, no solo la mera existencia de las claves. La bitácora deja RED previo, GREEN y la mutación `Desestimado` restaurada.
- Ya no hay hallazgos abiertos de código en esta PR; no se confunda esto con el estado de CI/E2E, que requiere logs oficiales del SHA con cambios de aplicación.

No se asigna un AG nuevo por el arreglo de una sola PR.
