# Lecciones — PR #401

- **Reincidencia de AG-36 (proceso):** aunque `approval-policy` se ponga verde, la autorrevisión no equivale a la revisión independiente. Se preservó la pieza del autor como `autorrevision-agy-r0.md`; nueva portada y ronda firmadas por la revisión. No atribuir a quien arregla la verificación de su propio trabajo.
- **P08 / contrato RPC→TS:** tests con rutas canónicas no prueban objetos que el SQL admite en el universo total del bucket. Agregar una muestra de ruta no canónica *dentro* de `courier-docs`.
- **P08 / errores frente a métricas:** comprobar privacidad tanto en respuestas correctas (`console.info`) como en la ruta de excepción que llega a `sendCriticalAlert`; los mensajes del proveedor deben tratarse como datos no confiables.

No se crea un número AG nuevo hasta poder enumerar el máximo en **todas** las ramas remotas; este entorno sólo accede al repo por conector y no dispone de `git fetch` funcional. No se reutiliza ninguna numeración.
