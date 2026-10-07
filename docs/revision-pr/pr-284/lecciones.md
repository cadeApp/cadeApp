# Lecciones de la PR #284

**Fuente:** 0 hallazgos. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Resultado

No aparece un patrón nuevo atribuible al agente ni a la ficha.

T-346 es mantenimiento reactivo ante un advisory publicado sobre una dependencia transitiva de Next.js. El diseño reutiliza el mecanismo ya empleado en T-344: conservar el framework, fijar una versión transitiva parcheada que sigue dentro de su rango declarado y demostrar el resultado con `pnpm audit` + árbol de dependencias + build/runtime.

## Qué conservar

- El RED debe provenir del advisory real; no se fabrica.
- Un advisory nuevo no se resuelve agregándolo a `ignoreGhsas` ni bajando el umbral.
- Si el parche transitivo cabe dentro del rango del paquete padre, se prefiere el cambio mínimo y se valida runtime.
- Si durante la implementación aparece otro advisory o `sharp@0.35.5` rompe build/E2E, se frena y se consulta: no se expande la tarea silenciosamente.

No se agrega numeración AG nueva.
