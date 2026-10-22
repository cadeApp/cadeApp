# Lecciones — PR #112

## Ronda 1

- Una fase RED válida no se mide por cantidad de tests rojos: hay que comprobar que cada requisito diferenciador tenga un control que pueda fallar por la regresión concreta.
- Action-level coverage no reemplaza UI wiring: que `pilot_active` sea válido en la action no prueba que A04 exponga el switch.
- “Conserva filtros” debe enumerar la clase completa de filtros; probar dos de tres deja una regresión silenciosa.
- Los modos de negocio de un mismo modal (“Extender piloto” vs “Marcar mes pagado”) necesitan asserts de payload distintos.
- D05-B es una excepción humana explícita a una regla global; debe documentarse como deuda, no transformarse retrospectivamente en cumplimiento.


## Ronda 2

- La fase RED puede cerrarse aunque el job unit global esté rojo, siempre que el rojo sea intencional, acotado a la tarea y el resto de suites mantenga su baseline verde.
- Para formularios de settings conviene enumerar toda la clase de claves en UI, no confiar en cobertura de la Server Action.
- Los tests estructurales de wiring complementan a los componentes: un panel puede estar bien testeado y aun así nunca renderizarse desde la page.
- Una limitación de tooling del reviewer debe declararse; nunca reemplazar una mutation battery real por una afirmación no ejecutada.

## Ronda 3

- Un Dialog puede estar cubierto funcionalmente y seguir teniendo un agujero de accesibilidad: apertura y submit no demuestran cierre por Escape ni retorno de foco.
- En un Dialog controlado abierto desde fuera de `DialogTrigger`, el test debe conservar la referencia al disparador y exigir `document.activeElement === trigger` después del cierre.
- Las evidencias visuales diferidas deben registrarse como aceptadas/diferidas, nunca transformarse en “verificadas” por ausencia de entorno.

## Ronda 4

- Para una regresión de foco, conservar la referencia DOM del disparador y asertar `document.activeElement` después de desmontar el Dialog cubre la propiedad relevante mejor que comprobar solo que el modal desaparece.
- Si el código base ya implementa correctamente el comportamiento, un hallazgo de cobertura puede cerrarse agregando únicamente el test; no hay que forzar un cambio de producción innecesario.
- Una limitación del entorno de revisión debe quedar separada de la evidencia que sí se verificó: CI e inspección del SHA pueden ser verificables aunque una mutación local no pueda reejecutarse.
