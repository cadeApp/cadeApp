# Lecciones — PR #213

## Ronda 1

El defecto principal no está en SQL sino en la identidad del cambio: un número de contract-change se reutilizó y los checks automáticos no detectan colisiones entre contratos históricos.

Se clasifica como P10 porque la implementación siguió una referencia operativa obsoleta sin reconciliarla contra el issue vigente y el historial.

## Candidato futuro

Si vuelve a ocurrir en otra PR, conviene agregar un control que asegure que:
- cada `docs/contracts/CC-NNN.md` representa un solo contract-change histórico;
- migraciones `*_ccNNN_*` y issue/título no reutilicen un NNN ya asignado a otro contrato.

Con un solo incidente no se propone todavía una regla nueva en AGENTS.

H02 usa P21 ya catalogado: verificar códigos/constraints, no wording incidental de PostgreSQL.


## Evidencia RED en cambios de esquema

H03 muestra que “no tengo Docker local” no debe cancelar una mutación requerida cuando CI ya provee una base efímera. Si este patrón reaparece en otra PR, conviene documentar en la regla de DB que las mutaciones de pgTAP pueden demostrarse mediante commits temporales y runs de CI.
