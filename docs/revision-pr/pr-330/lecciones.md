# Lecciones — PR #330 ronda 1

El E2E debe ejercer el actor real: no usar service-role para fabricar la oferta que quiere probar.
Una secuencia de PostgREST no es una transacción. No declarar rollback/atomicidad si los unit solo verifican el resultado de error.
Adición de RPC requiere contrato aprobado, seguridad por actor, idempotencia, permisos, concurrencia, migración y rollout; no duplicar reglas de publish_request.
Los non-null assertions violan AGENTS.md §4 aunque pasen TypeScript.
No se asignó número AG nuevo: faltaría inspeccionar todas las ramas remotas para evitar colisiones.
- Ronda 2: un nuevo E2E que compara el valor que calcula el propio test no es un oráculo; verificar el valor del lector/UI del producto.
- Los cambios en DOM requieren revalidar selectores E2E históricos, no silenciar expectativas.
- Un runner Docker con puerto ocupado no representa una regresión PostgreSQL; registrar infraestructura separadamente y revalidar, sin falsificar PASS.
- Ronda 3: la idempotencia requiere verificar no solo «mismo UUID entre reintentos» sino también **igualdad de payload** y respuesta incierta con edición. Un test de reintento sin cambios no cubre ese escenario (P08).
- Los resultados CI deben transcribirse desde el job y el SHA real (Files/Tests/Result), no del conteo anticipado: 2039 != 1980. No se atribuye engaño deliberado.
- No sumar número AG porque no se verificó el máximo de TODAS las ramas remotas; mantener como lección sin identificador nuevo.
- Ronda 4: cerrando una dependencia entre PRs, verificar 3 cosas por separado: merge a develop, `migrate-develop` SUCCESS con migración exacta y checkpoint de RPC/legacy en vivo. Los dos primeros NO implican el tercero.
- Un E2E `success` de un workflow con el job importante SKIPPED no es un E2E real; mirar jobs y SHA, no el color verde de la ejecución.
- Mantener una sola fuente de instrucciones activa tras merge de backend: ya no pedir crear RPC, solo integrarla mediante wrapper tipado y sustituir inserts seriales del writer.
- Ronda 4: un merge funcional puede bloquear otra PR por una bitácora compartida; conservar ambas sesiones sin perder datos, usando merge normal, nunca rebase/force.
- Ronda 5: el backend atómico puede estar correctamente instalado y el flujo UI E2E verde, pero una ruta opcional de ID en la frontera Server Action contradice la garantía de idempotencia. Testear el ID ausente y no permitir generarlo del lado servidor, incluso si la UI siempre lo adjunta (P05).
- Ronda 5: mutante que falla por `TypeError: .insert is not a function` en un stub truncado NO demuestra RED de ausencia de INSERT. Un test de negocio debe tener stub suficiente para llegar a su aserción explícita y fallar ahí (P08).
- Diferenciar cobertura de CI/E2E sobre HEAD de reviewer del ejercicio de mutaciones propio; logs del autor no sustituyen batría mutacional independiente. Sin clon, registrar alcance honestamente.
