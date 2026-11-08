# Lecciones de PR #657 — CC-047 / T-408

**Fuente:** cuatro hallazgos de la ronda 1, todos por inspección; ver `hallazgos.jsonl`.

## Patrón dominante

El CC enumeró sus policies principales, pero no toda la superficie impactada: se pasó por alto la semántica efectiva de `SECURITY DEFINER` (H01), pruebas históricas de corrección administrativa CC-031 (H02), otra suite que depende de notas (H03) y la insuficiencia de igualdad textual como prueba de procedencia para un backfill destructivo (H04).

## Candidatos a lección para próxima consolidación (sin nuevo número AG)

- **H01:** ante un trigger condicionado al rol SQL, probar `current_user` bajo el modo real de seguridad de la función; no confundir la identidad del invocador con la del propietario.
- **H02/H03:** antes de prometer una lista exhaustiva de pgTAP afectados, recorrer todas las suites y los scripts de integración que escriben o consultan la API modificada, incluidos controles de carrera históricos. No debilitar assertions: migrar al nuevo contrato conservando su propiedad.
- **H04:** prohibir borrados automáticos de datos de usuario cuando su procedencia se infiere solo por coincidencia textual; separar la lista SELECT de candidatos de la decisión humana por ambiente.

**Numeración AG:** no asignada en esta ronda. El entorno no dispone de un clon con todas las referencias remotas para calcular el máximo global de AG; se evita reutilizar un identificador. Revaluar en consolidación cuando se pueda ejecutar el comando de la norma sobre todas las ramas remotas.

## Prioridad de controles

1. pgTAP del trigger con fallo inducido y modo invoker/definer.
2. pgTAP e integración CC-031 compatibles con RPC auditadas y locks.
3. pgTAP de invariante sobre `merchants.notes` con nota enviada a auditoría.
4. Suite de consulta de candidatos sin mutación de notas; evidencia manual por ambiente.

Esta PR es contractual: no se deduce éxito de los futuros tests a partir de que el texto esté corregido.

## Ronda 2 — qué aprendimos (sin agregar AG nuevo)

- **PR657-R01 (P08, regresión):** al intentar incorporar suites faltantes, se usó brace expansion en «Archivos permitidos». `tools/verify-fichas.test.ts` no expande llaves: solo acepta nombres literales o prefijos terminados en `**`. Para 10 rutas explícitas el agente podría salir de alcance sin advertencia; también había un marcador de timestamp desde la ficha original que **la ronda 1 omitió**. Es un nuevo caso de [pr-56/AG-37] (enumerar la clase entera), [pr-62/AG-60] (control que falla en silencio) y [pr-63/AG-68] (demostrar cobertura real de la aserción).
- **PR657-H05 (P05):** la cláusula de excepciones D3=B no se propagó a todo el DoD y checklist de T-408. Eliminar admin WRITE y preservar grants compartidos no son proposiciones contrarias; «no tiene ninguna policy» sí contradice self policies. El checklist además ignoraba la concurrencia de las dos nuevas RPC, aunque DoD la cubría. Leer checklist y DoD en paralelo después de una reconciliación de CC.

No numeramos una regla AG nueva: ambos casos quedan cubiertos por los patrones existentes y el máximo global de las ramas remotas no se pudo auditar en el entorno sin clon. **Las mejoras de revisión** (no una exigencia nueva a la PR) son: probar nombres de archivo reales contra `permite` y buscar frases absolutas que contradicen excepciones D1/D3.

**Advertencia:** este CC es documental; las correcciones H01-H04 son estructurales por inspección, no pgTAP verde. No confundir «listado de pruebas» con «prueba ejecutada».

## Ronda 3 — cierre de R01 y H05

- **PR657-R01 / P08:** se confirmó que el permiso literal del repositorio no interpreta brace expansion ni `<timestamp>`. La mutación independiente en memoria de una ruta individual volvió a crear un caso rechazado. **Regla de proceso:** convertir cada entrada de «Archivos permitidos» en un nombre concreto antes de validarla; no fiarse de que `verify-fichas.test.ts` cubra la lista entera.
- **PR657-H05 / P05:** el CC, checklist y DoD ahora dicen lo mismo respecto de grants compartidos, protección de columnas, locks y D2. **Regla de proceso:** luego de conciliar una decisión, ejecutar el control tanto sobre checklist como sobre DoD y el contrato, no solo buscar la presencia de un término correcto.
- **Lección del revisor:** una primera mutación que reemplazaba «y la auditoría» con «sin auditoría» no ponía rojo el detector, porque conservaba la palabra. La mutación que quita el concepto completamente sí lo hizo. Esto confirma pr-63/AG-68: el detector debe reaccionar a la violación real, no al cambio cosmético. Se corrigió el instrumento antes de cerrarlo.

No se introduce un nuevo AG: R01 y H05 refuerzan patrones existentes (pr-56/AG-37; pr-62/AG-60; pr-63/AG-68). El proyecto contiene numeración AG duplicada entre ramas; no se asigna un ID sin comparar todo el remoto.

**Advertencia:** el estado `arreglado-verificado` de R01/H05 se limita al **contrato documental y al test de rutas**. Las pruebas futuras de seguridad de T-408 no están realizadas ni certificadas por esta revisión.
