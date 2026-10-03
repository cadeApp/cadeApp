# Lecciones — PR #228

- **El hueco se heredó al copiar.** La aserción de request-states (#207) solo pedía que el bloque existiera en el job,
  no que estuviera antes de la invocación. La #228 la copió para notifications y el hueco se duplicó. Cuando un test
  protege que algo «se ejecute», tiene que fijar la posición respecto de quien ejecuta, no solo que esté presente.
  Patrón `P08-control-no-cubre-lo-que-dice`. Si aparece en otra PR, se puede pasar a una regla.
- **Un fix de infraestructura «chico» también lleva ficha y bitácora.** Esta es la segunda vez que pasa (#207, #228):
  una PR separada toca un archivo que la ficha citada pone fuera de alcance. Las dos veces el cambio estaba bien; lo
  que faltó fue el respaldo documental. `approval-policy` atajó el informe que faltaba, pero nada atajó el desvío
  de alcance.


## Ronda 2

- **El parser del informe también es contrato.** Tener todas las frases correctas no alcanza si el heading que delimita la sección no coincide con el formato que consume `approval-policy`. El check hizo bien en fallar; el fix debe ser del cuerpo, no del check.
- **Sincronizar antes del cierre evita validar sobre una base vieja.** La rama estaba 15 commits detrás, aunque sin solapamiento. La revisión hizo merge normal y revalidó sobre `develop@abf89d8`.
- **Los tests de workflow deben comprobar relación causal, no mera presencia.** H01 queda verificado porque el helper ahora falla cuando el bloque opcional se mueve después del comando que consume el array.
