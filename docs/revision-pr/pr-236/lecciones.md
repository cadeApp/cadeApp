# Lecciones de la PR #236 para `AGENTS.md` y las reglas

**Fuente:** 2 hallazgos, 2 rondas. Datos crudos en [`hallazgos.jsonl`](hallazgos.jsonl).

## Patrón dominante

`PR236-H01` sigue siendo `P08-control-no-cubre-lo-que-dice`, pero R2 afina el diagnóstico: un test puede recorrer los eventos correctos y aun así obtener su RED de una **precondición distinta**.

El test de `Providers` empieza con `navigator.onLine=false`. El cambio de producción añade tanto sincronización inicial como un listener personalizado. Neutralizar ambos a la vez da RED, pero no dice cuál de los dos era necesario.

## Lecciones

No se asigna AG nuevo.

- Refuerza **`pr-82/AG-77`**: un test de framework debe reproducir el estado inicial y la transición que existe en producción.
- Refuerza el principio de mutaciones discriminantes: cuando un arreglo agrega dos comportamientos, una mutación que quita ambos solo prueba el paquete; hace falta quitar uno por vez.
- Antes de reemplazar un listener de framework, comprobar qué hace el listener por defecto. TanStack v5 ya escucha `window.online/offline`; el cambio debe demostrar qué propiedad adicional necesita cadeApp.

## Corrección de la revisión

R1 prescribió `onlineManager.setEventListener` antes de demostrar que el listener por defecto era insuficiente. La instrucción fue demasiado específica.

La corrección de R2 es separar propiedades:

1. sync inicial desde `navigator.onLine`;
2. propagación `window.offline/online`;
3. refetch posterior de una query activa.

Solo después de identificar cuál falla corresponde decidir si `Providers` necesita override global.

## H02

El body del PR quedó atrás del código. No merece una regla nueva; ya está cubierto por `P03-comentario-contradice-codigo`.

## Advertencia que se mantiene

El catch-up de `SUBSCRIBED` puede sumar una GET y volver verde el contador del E2E de reconnect por una razón distinta. El control externo sigue siendo obligatorio, pero no puede ser la única evidencia causal de reconnect.
