# Lecciones — PR #106 / T-122

## Ronda 1

No se propone número AG nuevo todavía. Los problemas encontrados ya caen en reglas/patrones existentes o necesitan una segunda PR para justificar regla nueva.

### Refuerzos

- **AG-37:** el primer enlace roto obligó a enumerar toda la clase de rutas admin; el build mostró que todas las páginas bajo `(admin)` perdieron el segmento esperado.
- **AG-71:** la decisión 2-A no se implementa creando un CC dentro de T-122. El contrato de Table/Tabs/InputOTP se reserva y mergea primero en develop.
- **P11:** dos fronteras tipadas pasan tests porque el mock se detiene antes del contrato real: el cliente de RPC y el input de `admin_verify_document`.
- **P08:** un test que comprueba solo el primer redirect no verifica un flujo de autenticación; hay que seguir el salto hasta la pantalla final.
- **Anti-12px:** el control de T-118 no viajó al alcance admin. Debe extenderse o agregarse un control equivalente para T-122.

### Qué salió bien

El RED inicial no fue una declaración retrospectiva: el job unit del commit inicial ejecutó 13 tests y dejó 7 fallos concretos. Conviene preservar esa forma de evidencia en las correcciones de R2: salida real + mutación reviewer-owned, sin tests falsos ni expectativas debilitadas.


## Ronda 2

- **P08 confirmado otra vez:** probar un helper aislado no verifica el cableado que protege. H03 ya tiene sanitizer correcto, pero falta demostrar que la action lo usa y que el componente navega con el retorno de la action.
- **Regla 25 frontera URL:** un type cast no valida `searchParams`; H07 demuestra que incluso con paginación server-side correcta pueden entrar `Infinity` o enums inexistentes.
- **Control conductual vs búsqueda de texto:** H10 muestra que encontrar `logoutAction` en el source no prueba que el usuario al hacer click cierre sesión.
- H11 mejoró en honestidad: el DoD visual se dejó sin marcar, pero la evidencia sigue siendo requisito de cierre.
