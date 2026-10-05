# Lecciones de la PR #255 para `AGENTS.md` y las reglas

**Fuente:** 1 hallazgo estructurado. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

La ficha convirtió un detalle interno del framework en una garantía más fuerte de la que React ofrece: «props internas presentes» se tomó como sinónimo de «Fiber committed/mounted».

Esto cae directamente en **P01 — contrato de framework no verificado**.

## Lecciones propuestas

No se propone una AG nueva en esta ronda.

Ya existe la regla general que obliga a demostrar el comportamiento del control y el catálogo ya tiene P01. El dato útil de esta PR es un ejemplo nuevo: al usar internals de un framework como señal de readiness, hay que comparar esa señal contra la condición que usa el propio framework para aceptar eventos, no contra una propiedad que aparece durante una fase anterior.

## Qué cambiar, en orden de impacto

1. Corregir H01 manteniendo la solución en E2E.
2. Dejar en la ficha la señal real que se verificó, no «`onSubmit` existe» como sinónimo de commit.
3. Conservar el test real de chunks y sumar un caso dirigido que haga fallar el falso positivo pre-commit.
4. No tocar `AGENTS.md` por un único caso no crítico.

## Advertencias

- T-337 es una tarea deliberadamente apoyada en internals de React 18.3.1; el patrón puede no generalizar a tareas de producto.
- Si React cambia de versión, los nombres/flags internos deben revalidarse antes de reutilizar el helper.
