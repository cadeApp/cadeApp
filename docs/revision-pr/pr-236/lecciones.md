# Lecciones de la PR #236 para `AGENTS.md` y las reglas

**Fuente:** 3 hallazgos, 5 rondas. Datos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Lección principal: reproducir también la concurrencia

H01 confirmó que no alcanza reproducir los mismos eventos. Un test de reconnect que espera a que la query quede idle puede borrar exactamente la carrera que existe en navegador.

Refuerza **`pr-82/AG-77`**:

> el control debe reproducir estado inicial, transición y estado concurrente relevante.

## Generación de trabajo ≠ contador de resultados

R01 agregó una segunda lección:

- `dataUpdateCount/errorUpdateCount` dice que algo terminó;
- no identifica qué operación empezó;
- si varias fuentes pueden refetchear la misma query, el arreglo debe distinguir generaciones.

La solución final incrementa la generación al entrar realmente al `queryFn`, que es el punto correcto para saber que un fetch nuevo empezó.

## Probar interacción entre mecanismos

T-333 combina:

1. reconnect de TanStack;
2. catch-up de Realtime mediante invalidación.

Los controles A-E muestran que una corrección local no basta: también hay que probar que ambos mecanismos juntos no duplican trabajo.

Esto refuerza el criterio de revisión de buscar **interacciones entre fixes de la misma tarea**, no solo cada fix aislado.

## Mutaciones discriminantes

Las mutaciones útiles fueron las que quitaban una sola propiedad:

- M1: reconnect nativo;
- M2: catch-up `SUBSCRIBED`;
- M5: latch in-flight;
- M6: detección de generación posterior.

Una mutación que neutraliza un bloque entero puede demostrar necesidad del paquete, pero no identifica qué parte protege la propiedad.

## Correcciones de la propia revisión

- R1 sobreprescribió un bridge global.
- R2 demostró que el bridge no era causal y lo descartó.
- R3 identificó la carrera real mediante el trace.
- R4 verificó H01 y encontró el refetch competidor.
- R5 verificó el modelo por generaciones y cerró sin bloqueantes.

No se agrega AG nuevo: las lecciones quedan suficientemente cubiertas por `pr-82/AG-77` y los patrones P01/P08 existentes.
