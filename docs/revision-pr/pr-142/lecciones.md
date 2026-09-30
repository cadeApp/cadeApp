# Lecciones — PR #142 / T-318

## Ronda 2 de la cadena #140 → #142

- **Anti-enumeración no es solo copy.** Si una API upstream fabrica una respuesta sanitizada para que “existente” y “nuevo” no se distingan, convertir una en `ok:false` vuelve a abrir el canal aunque ningún texto diga “ya existe”.
- **Una ficha nueva debe preceder a la implementación.** T-317 ya dejó el precedente en PR #138; crear ficha+runtime en la misma rama vuelve imposible afirmar que la tarea estaba autorizada desde develop.
- **Un control puede exponer una contradicción de alcance.** `verify-fichas` exige la fila del plan; si la ficha no autoriza el plan, la salida correcta es una PR de planificación separada, no tocar el archivo igualmente.

No se agrega una regla nueva: las reglas de ficha previa y alcance ya existen. Lo que falta es que un control detecte que una tarea recién creada no se autoautoriza en la misma PR de implementación.
