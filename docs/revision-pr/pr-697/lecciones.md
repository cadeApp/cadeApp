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
