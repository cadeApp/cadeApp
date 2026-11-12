# Lecciones de PR #698 (T-432) — Ronda 1

No se agrega un AG nuevo. H01/H02 refuerzan el patrón existente **`P08-control-no-cubre-lo-que-dice`** y el barrido de clase de `pr-56/AG-37`: probar cada componente aisladamente no protege su composición.

- **JSON:** verificar ambas variantes de `PushAttemptRecord` (`sent`/`blocked`) no solo en el emisor sino en el límite HTTP que expone el resultado.
- **HTTP:** verificar intersección entre respuesta del transporte (302 no redirigido) y clasificación del consumidor (`sentCount`/`failedCount`/no-borrado); la prueba de uno no sustituye al otro.
- **Proceso:** D01-A aceptada expresamente; no atribuirla a una decisión automática. El autor adelantó fixes durante el armado de la ronda: preservar SHA histórico y verificar arreglo en ronda siguiente, sin reescribir la anterior.
- **Evidencia:** ocho mutaciones del autor cierran su propio DoD; las nuevas H01/H02 requieren oráculos independientes y RED auténtico en la suite correspondiente, sin adulteraciones.
