# Lecciones — PR #469

No se detectaron fallas de código ni se asigna un AG nuevo sin evidencia de patrón repetido.

- El timeout de job y el rate limit de un registry son problemas distintos. Un timeout mayor es un margen operativo útil, no un sustituto de corregir las descargas y/o su autenticación. La nota PR54-H02 ya lo advertía en el mismo workflow.
- Una prueba que verifica un cambio declarativo de YAML debe aislar el job correcto. La nueva aserción lo hace con `job()` y dio RED ante mutaciones independientes.
- Los fixes operativos `CI-468` / `SEC-466` usan issues sin fichas `T-xxx`, mientras `approval-policy` reconoce solo el patrón `T-\d{3}`. El alias documental debe decir explícitamente que no afirma la existencia de una ficha. Si se formalizan parches de incidente, adaptar la política de informes en una tarea independiente.
- Nunca interpretar "audit advisory" como gate verde cuando el job figura `failure`. Separar causalidad del parche y aptitud real para merge.

No tocar `AGENTS.md` por esta revisión aislada.
