# Lecciones — PR #251 / T-313

- H09: en Next.js, `getByRole('alert')` a nivel de `page` puede capturar `#__next-route-announcer__`; para verificar errores de un formulario, acotar el locator al componente/landmark dueño del error.
- El cambio de entorno debe revalidarse con artifact/trace, no solo con cantidad de fallos: pasar de 2 alerts a 1 parecía parcial, pero el snapshot mostró que el flujo funcional ya había terminado con éxito.
- No se agrega una regla global nueva todavía; H09 se registra como P07 y se observará reincidencia.
