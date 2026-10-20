# Lecciones — PR #452 / ronda 1

## No se propone nuevo número AG

Los hallazgos están cubiertos por patrones existentes (P08 y P10) y por la necesidad de verificar la rama que realmente contiene cada ficha. Repetir números AG sin barrer todas las ramas no es confiable. No se agrega una nueva regla al proyecto por un único episodio documental.

## 1. Un CC mergeado y una RPC aplicada son estados distintos

CC-033 está mergeado y habilita **la implementación de T-384**, pero no habilita por sí solo **la UI de T-376**. CC-034/035 ni siquiera están mergeados; T-385/T-386 se bloquean hasta #448, y T-380/T-383 hasta las respectivas implementaciones y sus migraciones aplicadas en Develop. Una fila con «CC-xxx obligatorio» no comunica esos dos gates.

## 2. El tablero reconoce T-xxx, no CC-xxx

`board-sync.mjs`, `parseDependencies`, agrega identificadores `T-xxx`, no `CC-xxx`. La opción elegida fue añadir aristas entre tareas sin tocar el workflow: T-376→T-384, T-380→T-385, T-383→T-386. Esto resuelve el gate de implementación en la UI, pero NO automatiza por sí solo el bloqueo previo de T-385/T-386 por #448: debe quedar explícito en la documentación y respetarse operativamente.

## 3. Modificar la rama que tiene el archivo canónico

Las fichas T-380/T-383 solo están en #448. La alternativa correcta no es copiar esos archivos no mergeados a #452: el ajuste documental debe aplicarse en #448, o una vez mergeada en `develop`, con sincronización convencional y comparación del plan. Evita duplicados y conflictos semánticos.

## 4. Verificación documental no es un CI de aplicación

La ronda leyó 4 archivos cambiados y contrastó los 3 CCs y 3 tareas consumidoras. No corrió tests de runtime, ni simuló concurrencia o RLS. Las obligaciones RED→GREEN de pruebas de base pertenecen a los PR de implementación posteriores. Al dejar evidencias de texto, las señales deben distinguir qué se comprobó y qué sigue pendiente.

## Mejora a futuro

Considerar un verificador documental que valide aristas `T-xxx` y gates de implementación frente a la fila del plan, en una tarea separada con revisión propia. No agregar tests artificiales ni ampliar el diff de esta PR para lograr un número de checks verde.

## Ronda 2 — el estado cambió legítimamente

El arnés de la ronda 1 pedía literalmente «BLOQUEADA a #448» y devolvió cuatro FAIL tras merge de #448. Esos cuatro falsos negativos **no son defectos del autor**. La propiedad que había que preservar es «reflejar correctamente si el contrato está mergeado»; cuando cambió el hecho, cambió el resultado correcto. La ronda 2 usa una condición dependiente del estado confirmado de GitHub, **sin editar el arnés anterior ni reescribir la ronda 1**.

Se verificó el merge `d672f885`, el merge convencional de develop en #452 (commit de dos padres `d51c5e73`) y los CC en develop. Los dos hallazgos previos se cierran por nuevas comprobaciones sobre `ff7b9d70`.

## Una arista en la ficha no basta si el issue no es identificable

La lectura del `board-sync.mjs` detectó que el tablero empieza por `extractTaskId(issue.title)`. Las issues #442 y #447 no tenían un T-id en sus títulos, de modo que ni siquiera llegaban al bloque de parseo de dependencias. En esta revisión se aplicó un **arreglo mínimo fuera de la PR** a metadatos: el prefijo `[T-380]` y `[T-383]`, conservando `[QA]` y las descripciones originales. No se alteró `board-sync`, ni se disparó CI. La sincronización ordinaria tras merge deberá consumir las fichas ya integradas a develop. Esta es una advertencia de coordinación reutilizable; no se asigna nuevo AG.
