# Lecciones — PR #251 / T-313

- H09: en Next.js, `getByRole('alert')` a nivel de `page` puede capturar `#__next-route-announcer__`; para verificar errores de un formulario, acotar el locator al componente/landmark dueño del error.
- El cambio de entorno debe revalidarse con artifact/trace, no solo con cantidad de fallos: pasar de 2 alerts a 1 parecía parcial, pero el snapshot mostró que el flujo funcional ya había terminado con éxito.
- No se agrega una regla global nueva todavía; H09 se registra como P07 y se observará reincidencia.
- H10 repite un patrón ya catalogado: después de cada nuevo HEAD funcional, el body debe sustituir evidencia/diagnóstico obsoletos en vez de conservar runs que ya no describen el estado actual. Se reutiliza P15; no se agrega AG nueva.
- Un `INTERNAL_ERROR` deliberadamente agregado como frontera de dominio no permite inferir cuál operación interna falló. Si no hay logs seguros ni acceso al entorno, la revisión debe enumerar todas las ramas posibles y pedir una sonda discriminante; no convertir una de ellas en causa raíz por intuición.
