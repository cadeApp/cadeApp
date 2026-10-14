# Lecciones — PR #330 ronda 1

El E2E debe ejercer el actor real: no usar service-role para fabricar la oferta que quiere probar.
Una secuencia de PostgREST no es una transacción. No declarar rollback/atomicidad si los unit solo verifican el resultado de error.
Adición de RPC requiere contrato aprobado, seguridad por actor, idempotencia, permisos, concurrencia, migración y rollout; no duplicar reglas de publish_request.
Los non-null assertions violan AGENTS.md §4 aunque pasen TypeScript.
No se asignó número AG nuevo: faltaría inspeccionar todas las ramas remotas para evitar colisiones.
- Ronda 2: un nuevo E2E que compara el valor que calcula el propio test no es un oráculo; verificar el valor del lector/UI del producto.
- Los cambios en DOM requieren revalidar selectores E2E históricos, no silenciar expectativas.
- Un runner Docker con puerto ocupado no representa una regresión PostgreSQL; registrar infraestructura separadamente y revalidar, sin falsificar PASS.
