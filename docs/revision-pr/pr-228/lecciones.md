# Lecciones — PR #228

- **El hueco se heredó al copiar.** La aserción de request-states (#207) solo pedía que el bloque existiera en el job,
  no que estuviera antes de la invocación. La #228 la copió para notifications y el hueco se duplicó. Cuando un test
  protege que algo «se ejecute», tiene que fijar la posición respecto de quien ejecuta, no solo que esté presente.
  Patrón `P08-control-no-cubre-lo-que-dice`. Si aparece en otra PR, se puede pasar a una regla.
- **Un fix de infraestructura «chico» también lleva ficha y bitácora.** Esta es la segunda vez que pasa (#207, #228):
  una PR separada toca un archivo que la ficha citada pone fuera de alcance. Las dos veces el cambio estaba bien; lo
  que faltó fue el respaldo documental. `approval-policy` atajó el informe que faltaba, pero nada atajó el desvío
  de alcance.
