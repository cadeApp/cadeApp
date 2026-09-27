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
