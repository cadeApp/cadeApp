# Lecciones — PR #242 / T-325 hotfix

## Ronda 4

H05 confirma un caso de integración temporal: una rama puede quedar técnicamente correcta respecto de su base antigua y perder un contrato nuevo cuando `develop` avanza. La prevención útil no es una AG nueva sino la sincronización final de base + tests discriminantes sobre los consumidores compartidos.

H06 muestra el límite opuesto: un proveedor externo puede impedir la evidencia manual aunque código y CI estén verdes. Eso no autoriza a:
- fabricar capturas;
- reutilizar evidencia de un SHA anterior;
- bajar el DoD visual;
- crear cambios de código innecesarios.

## Sin AG nueva

Los controles existentes cubren ambos casos:
- sincronizar base antes del cierre;
- conservar contratos de ambos lados;
- distinguir evidencia ejecutable de evidencia pendiente por entorno externo.


## Ronda 5

H06 se cerró cuando el proveedor volvió a aceptar deployments. La evidencia final confirmó que no hacía falta ningún cambio de código: el bloqueo era exclusivamente operacional.

La lección es conservar la separación entre:
- **código verificado** por CI/tests;
- **evidencia visual** pendiente por disponibilidad del entorno;
- **fallo externo** de deployment que no justifica debilitar el DoD.

No se propone AG nueva.
