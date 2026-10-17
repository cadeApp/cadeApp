# Lecciones — PR #389, ronda 1

No se asigna un AG nuevo porque las deficiencias corresponden a patrones existentes; no se presume el máximo de AG de ramas remotas sin git fetch.

- **AG-37 / P06:** enumerar toda la matriz actor × estado antes de creer que una única prueba positiva representa ambos roles. T-362 tenía merchant matched sin viaje E2E.
- **AG-60 / P08:** un resultado esperado como "not visible" no demuestra que la aplicación llegó a la ruta autorizada. Agregar oráculos positivos del estado previo.
- **AG-75 / P08:** la batería del autor no reemplaza las mutaciones de revisión. Una mutación que introduce ReferenceError no prueba validación semántica; usar un cambio compilable y observar qué aserción funcional falla.
- **P03:** marcar DoD requiere evidencia del SHA y del entorno; "test escrito" y "test ejecutado" son estados distintos.

No modificar AGENTS.md por una sola ronda. Revalidar estos criterios después de los arreglos en un SHA nuevo.


## Ronda 2 — lecciones nuevas

- P03: el E2E puede añadir texto plausible pero inexistente; comparar exactamente con el componente existente antes de escribir una expectativa.
- P08: para demostrar una denegación por actor, el recurso debe estar en un estado elegible; si falla antes por estado, el negativo es un falso positivo.
- P15: ERROR MÍO en el instrumento de ronda 1. M1 coincidía tres veces pero el harness exigía exactamente una. Se detectó en R2 por conteo directo, antes de concluir que el autor falseó resultados. Se requiere variante real y logs para corroborar ejecución.
- La evidencia pnpm test y E2E Preview debe pertenecer al SHA posterior a los arreglos, no al commit anterior.

No asignar AG nuevo ni alterar AGENTS.md sin validar máximo de todas las ramas y reincidencia.
