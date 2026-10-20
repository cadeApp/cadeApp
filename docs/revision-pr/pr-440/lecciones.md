# Lecciones — PR #440 / T-378

**Fuente:** PR440-H01, análisis estático (no se ejecutaron mutaciones independientes). Datos en [hallazgos.jsonl](hallazgos.jsonl).

## Patrón recurrente (P08)
Al probar UI con Testing Library, obtener el enlace por nombre y comprobar `href` cubre accesibilidad básica y destino, pero no cubre un requisito explícito de icono visible y tamaño táctil. Un control tiene que fallar al quitar cada propiedad que promete proteger.

## Recomendación
Reforzar los dos tests de navegación con aserciones del SVG y del área de 48 px, demostrando RED mediante mutaciones temporales con restauración desde contenido original en memoria. La verificación no debe inventarse a partir de la lectura de código.

**AG:** no se asigna un número nuevo ni se propone alterar `AGENTS.md` en esta ronda sin ejecutar la batería en un clon real.

## Otras observaciones
Un fallo de `next/font` en el SHA anterior no volvió a aparecer en el SHA revisado, cuyo build pasó. Registrar ambos resultados y no adjudicar causalidad sin prueba.

## Ronda 2 — cierre del P08

El helper `expectAccessibleBackArrow` agrega asserts sobre el SVG, cinco tokens (tamaño/foco) y se usa en ambas vistas. Se verificó independientemente con lectura y mutaciones sintéticas en memoria contra código fuente; al retirar icono, dimensiones o foco, la propiedad evaluada cambia de `true` a `false`. CI oficial confirmó el GREEN. El autor aportó RED reales con Vitest, pero no se hicieron correr por el revisor por falta de un clon/dependencias accesibles.
