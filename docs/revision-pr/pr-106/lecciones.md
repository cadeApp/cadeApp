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
