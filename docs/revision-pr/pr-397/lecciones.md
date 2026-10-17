# Lecciones — PR #397 · ronda 1

- **PR397-H01 / P08:** más de 200 pgTAP seriales pueden pasar sin comprobar contención multisesión de un mismo saldo. Un requisito de N publicaciones simultáneas necesita barreras y sesiones físicas distintas en CI, no solo un `ledger_consistent()` serial.
- **PR397-H02 / P06:** la idempotencia equivale a la identidad del payload *completo*, incluida nota/auditoría. Un key único no basta para rechazar reintentos semánticamente distintos.
- **PR397-H03 / P06:** fechas futuras dependen de parámetros globales editables. Agendar con un snapshot y autorizar cambios posteriores sin serializar puede superponer derechos. Incluir *settings mutable × derechos programados* en la matriz de pruebas.
- **PR397-H04 / P01:** `now()` representa inicio de la transacción en Postgres. Comparaciones contra expiración ejecutadas mucho después requieren capturar instante real una vez y hacer tests que crucen el límite.
- **PR397-H05 / P05:** `0%` es un valor comercial válido pero no significa que no hubo primera compra. Descuento aplicado y derecho ya consumido son conceptos distintos: almacenar un registro de primera compra incluso con tasa cero.
- **PR397-H06 / P03:** el texto operativo de rollback también es parte del contrato de datos: tablas creadas durante piloto pueden contener créditos o planes administrativamente asentados, y no se borran.

Las decisiones humanas **1-A y 2-A** fueron explícitas el 2026-10-17 y no las tomó el revisor unilateralmente.

No se asigna numeración `AG-` global sin comprobar todas las ramas remotas. Esta ronda abre hallazgos; ninguna corrección está verificada. En nueva ronda, volver a observar el HEAD y probar cada regresión.