# Lecciones — PR #401

- **Reincidencia de AG-36 (proceso):** aunque `approval-policy` se ponga verde, la autorrevisión no equivale a la revisión independiente. Se preservó la pieza del autor como `autorrevision-agy-r0.md`; nueva portada y ronda firmadas por la revisión. No atribuir a quien arregla la verificación de su propio trabajo.
- **P08 / contrato RPC→TS:** tests con rutas canónicas no prueban objetos que el SQL admite en el universo total del bucket. Agregar una muestra de ruta no canónica *dentro* de `courier-docs`.
- **P08 / errores frente a métricas:** comprobar privacidad tanto en respuestas correctas (`console.info`) como en la ruta de excepción que llega a `sendCriticalAlert`; los mensajes del proveedor deben tratarse como datos no confiables.

No se crea un número AG nuevo hasta poder enumerar el máximo en **todas** las ramas remotas; este entorno sólo accede al repo por conector y no dispone de `git fetch` funcional. No se reutiliza ninguna numeración.

## Ronda 2

- **No confundir CI verde del PR con CI del develop actual:** el job hizo checkout de `pull/401/merge` con base SHA 711a2f, mientras que la rama develop avanzó 45 commits y añadió la UI T-356. Anotar el SHA efectivo del merge ref y volver a integrar con develop antes de declarar lista una PR de Storage.
- **Las mutaciones adicionales deben ser del revisor, no del autor:** se añadieron para H01 la variante `min(128)` y para H02 errores de claim y complete, verificadas sobre el blob exacto con TypeScript AST. Su valor y límite están anotados: la verificación estática no reemplaza el runtime y nunca se presenta como si lo hiciera.

- El resultado `mergeable:true` puede caducar mientras entran PR de otros. La PR #401 pasó a `mergeable:false/dirty` al entrar T-369; además de revisar `behind_by`, verificar el `mergeable_state` antes de publicar.

- El merge limpio de develop fue realizado por el agente durante la revisión. Los tres archivos coincidentes conservaron los dos contratos y suites. La evidencia de merge y el CI nuevo son el cierre del gate; si CI falla, sólo queda pendiente el fallo real, no el merge anterior.

- El merge que durante el análisis produjo `mergeable_state:dirty` se resolvió en d88e01c1 y el CI integrado pasó 2668 unit y 2735 pgTAP. No dejar un gate cronológico como bloqueante final cuando la evidencia posterior lo cerró.
