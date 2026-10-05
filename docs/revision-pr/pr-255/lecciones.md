# Lecciones de la PR #255 para `AGENTS.md` y las reglas

**Fuente:** 1 hallazgo estructurado. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

La ficha convirtió un detalle interno del framework en una garantía más fuerte de la que React ofrece: «props internas presentes» se tomó como sinónimo de «Fiber committed/mounted».

Esto cae directamente en **P01 — contrato de framework no verificado**.

## Lecciones propuestas

No se propone una AG nueva.

Ya existe la regla general que obliga a demostrar el comportamiento del control y el catálogo ya tiene P01. La ronda 2 confirmó la lección concreta: cuando una espera depende de internals de framework, el control debe imitar la condición que usa el propio framework para considerar el objeto operativo, y la prueba tiene que construir explícitamente el estado intermedio que diferencia ambas señales.

## Qué se cambió

1. `waitForFormHydration` dejó de usar `onSubmit` como señal suficiente.
2. La ficha documenta `onSubmit + Fiber mounted`.
3. Se conservó el E2E con chunks retenidos.
4. Se sumó un test dirigido a «props presentes + Fiber Hydrating».
5. La ronda independiente atacó además ancestro Hydrating, Placement, árbol detached, falta de Fiber y ciclo.

## Advertencias

- T-337 se apoya deliberadamente en internals de React 18.3.1; si React cambia de versión, las keys, flags y criterio deben revalidarse.
- Un solo caso no crítico no alcanza para sumar otra regla a `AGENTS.md`.
