# Lecciones — PR #457 / T-386

Dos patrones existentes reaparecen por inspección, sin mutaciones propias ejecutadas todavía.

- **P01 / validación SQL de JSONB:** `->>` textualiza números y booleanos. El servidor SQL debe validar `jsonb_typeof` explícitamente antes de regex para cumplir el contrato, independientemente del wrapper y del fake.
- **P08 / el oráculo mide un proxy:** dos auditorías y dueño final B no demuestran que la segunda transición auditó A→B. Las carreras sobre ownership necesitan inspeccionar `before` y `after` fila por fila, y mutar el lock concreto.

**No se asigna AG nuevo** hasta reproducir RED independiente y reconciliar la numeración global de todas las ramas. El hallazgo menor H03 es una asociación de comentario incorrecta. No tocar AGENTS.md ni catálogo global en esta ronda.

**Siguiente revisión:** comprobar el RED de datos JSON no textuales y del mutante sin `FOR UPDATE`, y verificar el GREEN del mismo SHA tras restaurar el código.

## Ronda 2 — qué quedó demostrado

- **H01/P01:** el nuevo `jsonb_typeof` y los negativos pgTAP detectaron realmente el tipo JSON inválido; test 16/17 RED previo al fix y 41/41 GREEN después. La inspección propia comprueba que las guardas están **antes** de `->>`.
- **H02/P08:** el oráculo pasó de contar eventos a comprobar la transición `before/after`; el modo del autor ensayó la eliminación del lock con DB real y registró el historial erróneo exacto, luego la restauración. Las mutaciones estáticas adicionales de la revisión detectan la desaparición de las aserciones del oráculo, **pero no sustituyen** reproducir la carrera.
- **H03/P03:** el comentario quedó sobre el símbolo correcto.
- **Lección de trazabilidad:** distinguir `HEAD` documental (`adae6466`) de SHA con cambios funcionales (`d1b903a6`), y no exigir más CI por documentación. El cuerpo de la PR se actualizó a `41` aserciones y a las dos mutaciones.

No se numeró un AG nuevo: los patrones ya constan en el catálogo. Sin ajustes a `AGENTS.md`.
