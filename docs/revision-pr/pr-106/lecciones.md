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


## Ronda 3

- **Alcance lo decide Lautaro:** la revisión no puede “autorizar” por sí sola un archivo fuera de ficha. D03 corrige ese error de proceso y formaliza `admin-nav.test.tsx`.
- **Aceptado ≠ verificado:** D04-B mueve H11 a T-300; el estado correcto es `aceptado`, con seguimiento, no `arreglado-verificado`.
- **Service role en lecturas es una señal roja:** si existen policies RLS para el actor, `queries.ts` no debe convertirlas en decoración usando un cliente privilegiado.
- **Revisar el diseño pantalla por pantalla:** comprobar solo los hallazgos anteriores dejó escapar Tabs/Dialog/motivo en A02 y countdown en A00.
- **Green CI no sustituye reglas de arquitectura/UI:** Toaster duplicado, estilos inline y ausencia de RHF/Zod pueden convivir con 647 tests verdes.
- **Clase completa, no instancia:** después del primer valor arbitrario se barrió todo el alcance admin y se enumeraron Toaster, estilos, skeletons, formateadores y copy.


## Ronda 4

- Un archivo `copy.ts` no cumple por sí solo la regla: hay que comprobar que la UI realmente lo consuma y que no exponga enums internos en inglés.
- Las primitivas correctas no bastan si el wiring específico no se prueba: un Dialog controlado sin DialogTrigger necesita verificar Escape y retorno de foco en la feature.
- Las clases Tailwind dinámicas deben pertenecer a la escala real del repo. `rotate-270` pasó typecheck/build porque Tailwind simplemente no genera una utilidad inexistente.
- Al corregir estilos inline no hay que sustituirlos por transiciones locales si Regla 60 reserva las animaciones a Motion.


## Ronda 5

- H14 confirmó que la accesibilidad de una primitiva no se presume: el wiring real debe probar orientación, Escape y retorno de foco.
- Las clases dinámicas de Tailwind deben validarse contra la escala instalada; una clase inexistente puede compilar y fallar solo visualmente.
- Centralizar copy significa consumirlo de verdad en la UI, no solo crear el archivo.
- Los códigos de dominio deben conservar semántica hasta la UI mediante `getDomainErrorMessage`; un mensaje genérico borra información útil.
- Con H14/H16 cerrados y CI completo verde, no quedan bloqueantes técnicos en T-122.
