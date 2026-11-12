# Lecciones de PR #698 (T-432) — Ronda 1

No se agrega un AG nuevo. H01/H02 refuerzan el patrón existente **`P08-control-no-cubre-lo-que-dice`** y el barrido de clase de `pr-56/AG-37`: probar cada componente aisladamente no protege su composición.

- **JSON:** verificar ambas variantes de `PushAttemptRecord` (`sent`/`blocked`) no solo en el emisor sino en el límite HTTP que expone el resultado.
- **HTTP:** verificar intersección entre respuesta del transporte (302 no redirigido) y clasificación del consumidor (`sentCount`/`failedCount`/no-borrado); la prueba de uno no sustituye al otro.
- **Proceso:** D01-A aceptada expresamente; no atribuirla a una decisión automática. El autor adelantó fixes durante el armado de la ronda: preservar SHA histórico y verificar arreglo en ronda siguiente, sin reescribir la anterior.
- **Evidencia:** ocho mutaciones del autor cierran su propio DoD; las nuevas H01/H02 requieren oráculos independientes y RED auténtico en la suite correspondiente, sin adulteraciones.

## Ronda 2 · Correcciones y fe de erratas (2026-11-12)

- H01/H02 cerraron los dos huecos de frontera que la ronda 1 detectó: JSON `blocked` sin URL y 3xx → failedCount sin baja. La verificación independiente ejecutada fue **aislada con funciones exactas TypeScript + VM**, no Vitest completo, y lo declaramos para mantener trazabilidad.
- Corregimos nuestro error de atribución en ronda 1: D01-A no se debe describir como «elección expresa de Lautaro073». Según aclaración del agente y bitácora, fue **selección automática bajo autorización permanente declarada**. Se deja ronda 1 histórica intacta y se corrige el registro estructurado.
- El CI de 69fdfd85 presentó `next/font` FAIL sobre `layout.tsx`, fuera del diff incremental, aunque unit/db/typecheck/lint verdes. No confundir «falló un job» con «este cambio causó el fallo». Se exige nuevo verde antes de merge, sin editar el archivo no permitido a ciegas.
- No se crea una regla AG nueva: los hallazgos resuelven el patrón `P08-control-no-cubre-lo-que-dice` ya documentado.
