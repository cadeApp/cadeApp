# Lecciones — PR #697 · ronda 1

No se asigna un nuevo número `AG`, porque los fallos de cobertura se explican con lecciones existentes y la clase de timeout queda abierta hasta verificar la implementación.

## H01 — Se necesitan controles separados para barreras independientes

La prohibición de INSERT/UPDATE depende de **grants Y RLS**. Restituir un grant no atraviesa una policy cerrada: el bypass funcional puede permanecer verde aunque la mutación haya debilitado una barrera. Para probar defensa en profundidad, cada barrera necesita un test directo que se ponga rojo ante su propia mutación. Es la manifestación de `pr-63/AG-68` y `pr-63/AG-70` en seguridad por capas.

## H02 — La prueba no puede hacer ella misma el trabajo de la migración

Una prueba que ejecuta de nuevo el DELETE demuestra que ese DELETE funciona, pero no que estuvo en la migración. Si la operación es destructiva, esta falsa cobertura es especialmente cara. Antes de atribuir un resultado al proceso de migración, hay que sembrar estado antes, ejecutar el artefacto real y verificar el estado después. D5-C evita destruir datos sin inventario y vuelve obligatorio documentar el punto de decisión de saneamiento.

## H03 — Timeout por inactividad y duración máxima no son equivalentes

Un timeout del socket puede no saltar si llegan bytes periódicamente. En `web-push@3.6.7` se configura `https.request` de esa manera; para el objetivo de bloquear un emisor retenido, se necesita un deadline global con destrucción de la solicitud. `Promise.race` solo limita la espera del llamador si la red continúa activa. La prueba debe dejar un flujo activo que exceda el plazo, no solo un socket que jamás responda.

## H04 — Un requisito de privacidad afecta también al tipo de salida

Pedir `sin endpoint` es un cambio de contrato del registro de intentos: `PushAttemptRecord.endpoint` hoy es obligatorio. La PR documental debe especificar el discriminante y los consumidores, no dejar que el compilador guíe un centinela o una propiedad opcional ambiguos. Es una instancia de `P11-api-publica-inconsistente`.

## Recomendación de proceso

La PR de CC debe incluir **mutaciones que prueben qué mide cada control**, no solo una lista de tests futuros. Cuando aún no existe implementación, describir el experimento y marcarlo como **no ejecutado** es correcto; registrar un rojo hipotético como observado no lo es.

---

## Ronda 2 — H02 / H05

No se asigna un AG nuevo porque no se verificó el máximo de todas las ramas remotas.

**H02 (pr-63/AG-68, AG-70):** la condición temporal importa. Probar reaplicación después de introducir fixtures no protege la **primera aplicación**; una migración que borre datos solo en el primer despliegue puede dejar el test en verde. El control de conservación debe crear el dato **antes** de la migración real, aplicarla, medir después y mutar en ese mismo instante.

**H05 (P15):** un contrato de “fixture compartido” entre pgTAP SQL y Vitest TypeScript necesita un mecanismo de transporte explícito. Dentro de los archivos permitidos, una tabla canónica de URLs y expectativas en el CC, reflejada con valores fijos en ambas suites, es verificable; una referencia genérica a “casos compartidos” no lo es.

**Alcance:** son lecciones de diseño de pruebas, no evidencia de tests reales de T-432, cuya implementación todavía va en otra PR.

---

## Ronda 3 — `pr-63/AG-68` desde el lado de las columnas

H02 mejoró sustancialmente: el control ya se ubica en la primera aplicación y no en la segunda. El residuo es de **enumeración de fila**: un test que verifica los seis campos nombrados puede dejar fuera `created_at` y `last_seen_at`, pese a que el esquema guarda ocho. Una migración mutada que solo pisa esos timestamps no altera los seis campos y pasa en verde. La defensa es comparar **la fila completa** y sembrar timestamps sentinela distintos de los defaults y de `now()`; después matar una mutación que solo toca uno de ellos. Es el patrón `P08` aplicado a una proyección incompleta.

H05 quedó bien cerrada con una tabla de 19 pares literales en el CC y réplica con expected fijo en SQL/TS. La lección es que una matriz de pruebas contractual necesita **IDs, ejemplos específicos y oráculo independiente**, y no solo nombres de clases de URL. Cinco mutaciones independientes sobre esos pares dieron rojo en un arnés local Node, sin confundirlo con los tests aún futuros.

---

## Ronda 4 — cierre H02 (sin nuevo AG)

**Corrección de un agujero señalado por la propia revisión previa:** en ronda 3 se pasó de la reaplicación a la primera aplicación, pero recién allí se detectó que verificar seis campos no equivale a preservar una fila de ocho columnas. La ronda 4 exige instantánea de fila completa, sentinels históricos en los timestamps y una mutación independiente que demuestre que el oráculo captura un UPDATE que no destruye filas.

**Disciplina probatoria:** las tres mutaciones RED ejecutadas son **del texto del contrato**, no de PostgreSQL. En una PR documental es válido usar este tipo de control para decidir si el DoD está especificado; sería incorrecto tratarlo como GREEN de la migración. La PR de implementación debe traer su propia evidencia SQL y transporte, incluyendo RED-DELETE/RED-TIMESTAMP reales.

**Ronda 4 cerrada sin bloqueantes:** no agregar reglas globales por un único caso, no reabrir D1–D5, y no pedir otro CI GREEN solo porque la revisión añadió archivos a `docs/revision-pr/**`.
