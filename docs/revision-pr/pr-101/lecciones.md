# Lecciones — PR #101 / CC-007

## Ronda 3

### Un CI rojo heredado debe separarse de una regresión de PR
La revisión debe demostrar si el fallo existe en la base. En H11, el archivo señalado por el test es idéntico entre rama y develop y la divergencia está entre fichas ya mergeadas y el plan base. Se bloquea el merge por protocolo, pero no se atribuye falsamente a CC-007.

### Rollout sin usuarios reales puede aceptar una ventana intermedia
D09 permite mergear primero la barrera estructural y después conectar T-311 porque no hay cuentas reales ni staging. La condición es explícita: no promocionar el estado intermedio.

### Excepciones de proceso deben quedar acotadas
D10 cierra H07 por decisión del dueño P1, pero la excepción se registra solo para CC-007; no modifica automáticamente el flujo de futuros contract-change.

No se propone AG nueva.
