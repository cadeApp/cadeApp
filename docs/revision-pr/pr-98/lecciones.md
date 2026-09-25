# Lecciones de la PR #98 para `AGENTS.md` y las reglas

**Fuente:** 11 registros en Ronda 1 (1 decisión aceptada, 9 bloqueantes y 1 hallazgo de proceso). Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

No aparece una clase nueva que justifique otro número AG. La ronda vuelve a mostrar dos patrones ya conocidos:

1. **P08-control-no-cubre-lo-que-dice:** existe un buen helper de versión y un test del helper, pero las tres Server Actions que deben usarlo no tienen un caso negativo propio. Es la misma diferencia entre “la pieza existe” y “cada consumidor está protegido”.
2. **AG-36:** el implementador volvió a escribir `docs/revision-pr/**`. El material puede ser útil, pero no puede convertirse en verificación independiente por estar en esa carpeta.

## Refuerzos, no reglas nuevas

### AG-36 · Quien implementa no escribe la carpeta de revisión

**Origen:** H10.

El archivo de fuentes legales es valioso como evidencia del autor. El problema es el canal. Se preserva con sufijo `-autor`; a partir de Ronda 1, el implementador usa la bitácora y el cuerpo/comentarios del PR.

### P08 / AG-61–AG-63 · El guard se prueba en cada frontera que depende de él

**Origen:** H05, reforzado por H04.

`legal-red.test.ts` prueba que el helper sabe distinguir 1.0 de 0.9. Eso no prueba que auth, merchant y courier no puedan dejar de invocarlo. Las mutaciones M1–M3 deben vivir como criterio de revisión: quitar el guard en cualquiera de las tres Actions tiene que romper su test específico.

## Qué cambiar, en orden de impacto

1. Cerrar H05 y H06: son los que pueden dejar aceptaciones ausentes o versiones viejas.
2. Cerrar H02/H03/H04: contenido legal y autoridad de versión.
3. Cerrar H07/H08: accesibilidad y evidencia visual real.
4. Cerrar H01/H09: sincronía documental y trazabilidad.

## Advertencias

- Esta tarea es atípica por mezclar UI, evidencia electrónica y contenido jurídico; no extrapolar H02/H03 como regla general de frontend.
- No se propone `AG-78`: los dos mecanismos de proceso/testing ya tienen reglas previas.
