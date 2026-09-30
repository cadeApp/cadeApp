# Lecciones de la PR #140

**Fuente:** 5 hallazgos de Ronda 1.

## Contraste con los checks

La implementación llega con CI técnico verde (1396 tests, typecheck, lint, db-tests y build), pero eso no cubre tres clases de riesgo observadas acá:

1. **Identidad de la tarea/proceso:** un PR puede compilar perfecto y aun así no pertenecer a una tarea activa.
2. **Semántica de privacidad del proveedor:** una forma de respuesta que parece útil para UX puede existir precisamente para no revelar información.
3. **Enumeración de errores externos:** mapear “todo lo demás” a un error de usuario vuelve engañosos los mensajes cuando el proveedor falla.

## Patrones

- **P10** en H01: la disciplina de una tarea=issue=rama=PR necesita control si se quiere impedir reutilización de ids cerrados.
- **P20** en H02: una decisión de UX que cambia una protección de privacidad debe quedar escrita como decisión, no inferida del shape de una API.
- **P06** en H03: los errores de un SDK externo necesitan allowlist por semántica; un default amplio suele mezclar errores de usuario e infraestructura.
- **P08** en H04/H05: CI verde no prueba una rama excepcional que nunca se ejecuta ni que la evidencia/bitácora esté completa.

## Regla nueva

No se agrega numeración AG en esta ronda. H01 requiere primero una decisión de proceso de Lautaro073 y H02 una decisión de seguridad/producto.
