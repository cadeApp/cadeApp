# Lecciones — PR332
- No declarar una decisión de producto como aprobada hasta registrar la elección exacta del dueño.
- UUID estable del browser y `status` real son dimensiones separadas de idempotencia; comparar datos de negocio originales inmutables, no estados de viaje.
- No duplicar PII en proyecciones legacy por conveniencia sin un consumidor vigente demostrado.
- Un CC exclusivamente documental no despliega SQL; gates separados para CC, backend y writer.
- Sin nuevo número AG: no se obtuvo el máximo de todas las ramas remotas.
- Ronda 2: comparar literalmente contrato y ficha antes de dar por subsanado H04; los gates de rollout son evidencia documental, no de despliegue real.
- Un CC puede quedar sin bloqueantes técnicos aunque P2/autorrevisión/policy continúen pendientes; no confundir el dictamen técnico con autorización para merge.
