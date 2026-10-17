# Lecciones — PR #397 · ronda 1

- **PR397-H01 / P08:** más de 200 pgTAP seriales pueden pasar sin comprobar contención multisesión de un mismo saldo. Un requisito de N publicaciones simultáneas necesita barreras y sesiones físicas distintas en CI, no solo un `ledger_consistent()` serial.
- **PR397-H02 / P06:** la idempotencia equivale a la identidad del payload *completo*, incluida nota/auditoría. Un key único no basta para rechazar reintentos semánticamente distintos.
- **PR397-H03 / P06:** fechas futuras dependen de parámetros globales editables. Agendar con un snapshot y autorizar cambios posteriores sin serializar puede superponer derechos. Incluir *settings mutable × derechos programados* en la matriz de pruebas.
- **PR397-H04 / P01:** `now()` representa inicio de la transacción en Postgres. Comparaciones contra expiración ejecutadas mucho después requieren capturar instante real una vez y hacer tests que crucen el límite.
- **PR397-H05 / P05:** `0%` es un valor comercial válido pero no significa que no hubo primera compra. Descuento aplicado y derecho ya consumido son conceptos distintos: almacenar un registro de primera compra incluso con tasa cero.
- **PR397-H06 / P03:** el texto operativo de rollback también es parte del contrato de datos: tablas creadas durante piloto pueden contener créditos o planes administrativamente asentados, y no se borran.

Las decisiones humanas **1-A y 2-A** fueron explícitas el 2026-10-17 y no las tomó el revisor unilateralmente.

No se asigna numeración `AG-` global sin comprobar todas las ramas remotas. Esta ronda abre hallazgos; ninguna corrección está verificada. En nueva ronda, volver a observar el HEAD y probar cada regresión.

## Ronda 2 — PR397-R01

- Un control negativo que **detecta** el comportamiento malo al evaluar la expectativa opuesta no necesariamente prueba que el mismo test GREEN hubiera fallado. `expectInvariant:false` es un interruptor de prueba que evita las aserciones originales y puede dar una certificación RED de apariencia convincente. Requerir ejecución de la prueba idéntica y captura de **AssertionError específico** bajo mutación; no mutar oracle/expectations.
- Las carreras con locks deben distinguir el bloqueo esperado de la operación ya terminada sin convertir un timeout en prueba de invariante. Para H03, `allowDone` puede ser independiente del resultado esperado y los asserts quedar idénticos.
- El CI de concurrencia T-369 sí se ejecutó en dos pasadas; no confundir **probar la función en verde** con **probar sensibilidad del test**.
